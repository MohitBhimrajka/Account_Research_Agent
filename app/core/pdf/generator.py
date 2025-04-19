# FILE: app/core/pdf/generator.py

"""PDF Generator Module."""

import os
from pathlib import Path
import markdown
from markdown.extensions import fenced_code, tables, toc, attr_list, def_list, footnotes
from markdown.extensions.codehilite import CodeHiliteExtension
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
from jinja2 import Environment, FileSystemLoader, select_autoescape
from datetime import datetime
import yaml
from bs4 import BeautifulSoup, Comment
import re # Added import
from typing import Optional, Dict, List, Tuple, Any
from config import SECTION_ORDER, PDF_CONFIG
from pydantic import BaseModel
import traceback # Added import for better error logging

# Configure logging (optional, if you want logging within this module)
# import logging
# logger = logging.getLogger(__name__)

class PDFSection(BaseModel):
    """Model for a section in the PDF."""

    id: str
    title: str
    raw_content: str  # Raw Markdown content
    main_markdown_content: str = ""  # Main content before sources
    sources_markdown_content: str = ""  # Sources section markdown
    html_content: str = ""  # Processed HTML content (use main_html_content)
    main_html_content: str = ""  # HTML for main content
    sources_html_content: str = ""  # HTML for sources
    intro: str = ""
    key_topics: List[str] = []
    metadata: Dict = {}  # YAML frontmatter metadata
    reading_time: int = 0  # Estimated reading time in minutes
    subsections: List[Any] = []  # Subsections of this section


class EnhancedPDFGenerator:
    """Enhanced PDF Generator with better markdown support and styling."""

    def __init__(self, template_path: Optional[str] = None):
        """Initialize the PDF generator with an optional custom template path."""
        # Reliably determine project root
        self.project_root = Path(__file__).resolve().parent.parent.parent.parent
        print(f"Project root determined as: {self.project_root}")

        if template_path:
            self.template_dir = str(Path(template_path).parent)
            self.template_name = Path(template_path).name
        else:
            # Use project_root for template directory
            self.template_dir = str(self.project_root / "templates")
            self.template_name = "enhanced_report_template.html"

        self.env = Environment(
            loader=FileSystemLoader(self.template_dir),
            autoescape=select_autoescape(["html", "xml"]),
        )
        self.template = self.env.get_template(self.template_name)

        # Initialize the markdown processor once for reuse
        self._markdown_processor = self._create_markdown_processor()

    def _extract_section_metadata(self, content: str) -> Tuple[Dict, str]:
        """Extract YAML frontmatter and content from a markdown section."""
        metadata = {}
        content = content.lstrip()  # Remove leading whitespace
        if content.startswith("---"):
            try:
                # Split carefully, expecting '---', yaml block, '---', content
                parts = content.split("---", 2)
                if len(parts) >= 3:
                    frontmatter = parts[1]
                    markdown_content = parts[2]
                    loaded_meta = yaml.safe_load(frontmatter)
                    # Ensure it's a dict, handle empty frontmatter gracefully
                    metadata = loaded_meta if isinstance(loaded_meta, dict) else {}
                    return metadata, markdown_content.strip()
            except (yaml.YAMLError, IndexError, ValueError) as e:
                # If debugging needed: print(f"Failed to parse YAML frontmatter: {e}")
                pass
        return metadata, content.strip()

    def _estimate_reading_time(self, content: str) -> int:
        """Estimate reading time in minutes based on word count."""
        words = len(content.split())
        # Assuming faster reading speed (300 words per minute) and capping at 5 minutes
        estimated_time = min(5, max(1, round(words / 300)))
        return estimated_time

    def _extract_key_topics(self, html_content: str, max_topics: int = None) -> List[str]:
        """Extract key topics from the HTML content based on headings.

        This extracts the subsection headings (h2, h3) from the HTML content to build
        a table of contents.

        Args:
            html_content: The HTML content to extract topics from (already converted from markdown)
            max_topics: Optional maximum number of topics to extract

        Returns:
            List of topic strings
        """
        if not html_content.strip():
            return []  # Return empty list for empty content

        # Parse the HTML with BeautifulSoup
        soup = BeautifulSoup(html_content, "html.parser")

        # Only consider h2 and h3 headings for key topics
        headings = soup.find_all(["h2", "h3"])
        topics = []

        # Skip the first h2 if it exists and looks like a title
        starting_index = 0
        # Corrected: Check if the first heading is the section title
        # A simple heuristic: skip the first h2 if it exists
        if headings and headings[0].name == "h2":
             starting_index = 1

        for heading in headings[starting_index:]:
            # Get the clean text without numbers
            text = heading.get_text().strip()

            # Remove any leading numbers like "1. " or "1.1. " that might be present
            clean_text = re.sub(r"^\d+(\.\d+)*\.\s+", "", text)

            # Remove section numbers like "1." or "1.1 " at the start
            clean_text = re.sub(r"^\d+(\.\d+)*\s+", "", clean_text).strip()


            # Add only if not empty after cleaning
            if clean_text:
                topics.append(clean_text)

            # Only limit if max_topics is specified
            if max_topics and len(topics) >= max_topics:
                break

        return topics

    def _create_markdown_processor(self):
        """Create a markdown processor with all necessary extensions."""
        md = markdown.Markdown(
            extensions=[
                "extra",  # Includes tables, fenced_code, footnotes, etc.
                "meta",
                "codehilite",
                "admonition",
                "attr_list",
                "toc",
                "def_list",  # Definition lists
                "footnotes",  # Footnotes support
                "abbr",  # Abbreviation support
                "md_in_html",  # Markdown inside HTML
                "sane_lists",  # Better list handling
                "nl2br",  # Convert newlines to <br> tags for proper line breaks
            ],
            extension_configs={
                "codehilite": {"css_class": "highlight", "guess_lang": False},
                "toc": {"permalink": False},  # Disable permalinks to remove ¶
                "footnotes": {"BACKLINK_TEXT": "↩"},
            },
        )
        return md

    def _process_headings(self, soup):
        """Add classes and IDs to headings for better navigation without visible permalinks."""
        # Process all headings for better styling and navigation
        for h_tag in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
            # Add classes based on heading level
            h_tag["class"] = h_tag.get("class", []) + [f"heading-{h_tag.name}"]

            # Generate an ID from the heading text if it doesn't have one
            if not h_tag.get("id"):
                heading_text = h_tag.get_text().strip()
                # Remove leading numbers like "1. " or "1.1." for ID generation
                cleaned_text = re.sub(r"^\d+(\.\d+)*\.\s*", "", heading_text)
                heading_id = re.sub(r"[^\w\s-]", "", cleaned_text.lower()) # Use cleaned text
                heading_id = re.sub(r"[\s-]+", "-", heading_id)
                if heading_id: # Ensure ID is not empty
                    h_tag["id"] = heading_id
                else: # Fallback if ID becomes empty
                     h_tag["id"] = f"heading-{h_tag.name}-{hash(heading_text)}"


            # We no longer add the visible paragraph symbol anchor
            # Just ensure the heading has an ID for internal linking

    def _markdown_to_styled_html(self, markdown_content: str) -> str:
        """
        Convert markdown content to HTML with enhanced styling.

        Args:
            markdown_content: The markdown string to convert

        Returns:
            A processed HTML string with styling applied
        """
        if not markdown_content.strip():
            print("Warning: Empty markdown content passed to _markdown_to_styled_html")
            return ""  # Return empty string for empty content

        # Convert markdown to HTML using the initialized processor
        html = self._markdown_processor.convert(markdown_content)

        # Reset the markdown processor to clear its state
        # This is important, especially for TOC and other extensions that maintain state
        self._markdown_processor.reset()

        soup = BeautifulSoup(html, "html.parser")

        # Process headings to add anchors for TOC
        self._process_headings(soup)

        # Process lists - first-level lists
        for ul in soup.find_all(["ul", "ol"], recursive=False):
            self._process_list(ul, level=1, soup=soup)

        # Find any lists that may be inside other elements (not directly under body)
        for container in soup.find_all(["div", "blockquote", "td"]):
            for ul in container.find_all(["ul", "ol"], recursive=False):
                self._process_list(ul, level=1, soup=soup)

        # Process tables
        for table in soup.find_all("table"):
            self._process_table(table, soup)

        result = str(soup)

        # Log the first 200 chars of the result for debugging
        if len(result) > 0:
            preview = result[:min(200, len(result))]
            # print(f"HTML conversion result preview: {preview}...") # Optionally uncomment for deep debugging
        else:
            print("Warning: HTML conversion resulted in empty string!")

        return result

    def _process_list(self, list_tag, level=1, soup=None):
        """Add classes to list elements for better styling."""
        # Add classes based on list type and level
        list_type = "ul" if list_tag.name == "ul" else "ol"
        list_tag["class"] = list_tag.get("class", []) + [f"{list_type}-level-{level}", "enhanced-list"]

        # Process all list items
        for li in list_tag.find_all("li", recursive=False):
            li["class"] = li.get("class", []) + [f"li-level-{level}", "enhanced-list-item"]

            # Recursively process nested lists with increased level
            for nested_list in li.find_all(["ul", "ol"], recursive=False):
                nested_list["class"] = nested_list.get("class", []) + ["nested-list"]
                for nested_li in nested_list.find_all("li", recursive=False):
                     nested_li["class"] = nested_li.get("class", []) + ["nested-list-item"]
                self._process_list(nested_list, level=level + 1, soup=soup)

    def _process_table(self, table, soup):
        """
        Add classes and structure to tables for better styling.

        Args:
            table: The BeautifulSoup table element to process
            soup: The BeautifulSoup object for creating new tags
        """
        # Add styling classes to the table
        table_classes = ["table", "table-striped", "table-hover"]

        # Add custom class from config if available
        if "STYLING" in PDF_CONFIG and "TABLE_CLASS" in PDF_CONFIG["STYLING"]:
            table_classes.append(PDF_CONFIG["STYLING"]["TABLE_CLASS"])

        table["class"] = table.get("class", []) + table_classes

        # If the table has a thead, add a class to it
        thead = table.find("thead")
        if thead:
            thead["class"] = thead.get("class", []) + ["thead-dark"]

        # If the first row contains th elements, it's a header row
        # Create a thead if it doesn't exist
        first_row = table.find("tr")
        if first_row and first_row.find("th") and not thead:
            thead = soup.new_tag("thead")
            thead["class"] = ["thead-dark"]
            table.insert(0, thead)
            thead.append(first_row)

        # Add page-break control for WeasyPrint
        # This helps ensure tables don't break across pages in awkward ways
        if "STYLING" in PDF_CONFIG and "AVOID_PAGE_BREAK_ELEMENTS" in PDF_CONFIG["STYLING"]:
            if "table" in PDF_CONFIG["STYLING"]["AVOID_PAGE_BREAK_ELEMENTS"]:
                # Add inline style to avoid page breaks inside table
                table['style'] = (table.get('style', '') + '; page-break-inside: avoid;').strip()

        # Add a wrapper div if table is wide to handle overflow
        width = table.get('width')
        # Relax width condition to wrap more tables
        # Check if table might be wider than standard content area
        # This is a heuristic, might need adjustment
        wrap_table = False
        if width:
             if width.endswith('%') and int(width[:-1]) > 90: # Wrap if > 90% width
                 wrap_table = True
        elif len(table.find_all('th')) > 5: # Wrap if more than 5 columns (heuristic)
            wrap_table = True

        if wrap_table:
            # Create a wrapper div for the table
            wrapper = soup.new_tag('div')
            wrapper['class'] = ['table-responsive']
            # Move the table inside the wrapper
            table.wrap(wrapper)


    def _generate_toc(self, sections):
        """Generate a table of contents from the sections."""
        toc_html = '<div class="table-of-contents"><h2 class="toc-title">Table of Contents</h2><div class="toc-entries">'

        for idx, section in enumerate(sections, 1):
            # Skip empty sections
            if not section.main_html_content.strip(): # Check main HTML content
                continue

            # Create a link to the section
            section_id = section.id.lower().replace(" ", "-")
            # Ensure section ID is valid HTML ID
            section_id = re.sub(r'[^a-zA-Z0-9_-]', '', section_id)

            # Create link to the section *content* which follows the cover
            content_anchor_id = f"section-{section.id}" # Match the ID in the template

            toc_html += f'<div class="toc-entry"><a href="#{content_anchor_id}" class="toc-link">{section.title}</a></div>' # Page number handled by CSS ::after

            # If the section has key topics, add them as nested links
            if section.key_topics:
                toc_html += '<div class="toc-subsections">'
                for topic in section.key_topics:
                    # Generate a safe ID for the topic based on heading IDs generated in _process_headings
                    topic_id_base = re.sub(r"[^\w\s-]", "", topic.lower()).replace(" ", "-")
                    topic_id = re.sub(r'[^a-zA-Z0-9_-]', '', topic_id_base)

                    # Fallback ID generation if cleaned ID is empty
                    if not topic_id:
                         topic_id = f"topic-{hash(topic)}"

                    toc_html += f'<div class="toc-subsection"><a href="#{topic_id}" class="toc-sublink">{topic}</a></div>' # Page number handled by CSS ::after
                toc_html += "</div>"

        toc_html += "</div></div>" # Close toc-entries and table-of-contents
        return toc_html

    def _process_sections(self, sections):
        """Process all sections to extract metadata, split content and generate HTML."""
        processed_sections = []
        all_sources_html = ""

        print(f"\nProcessing {len(sections)} section objects...")

        for idx, section_obj in enumerate(sections, 1):
            print(f"\nProcessing section {idx}: {section_obj.title} (ID: {section_obj.id})")

            # Check the raw content
            if not section_obj.raw_content.strip():
                print(f"[yellow]Warning: Section {section_obj.id} has empty raw_content![/yellow]")
                # Add the empty section object anyway so it appears in TOC (but won't render content)
                processed_sections.append(section_obj)
                continue # Skip further processing for empty sections
            else:
                raw_chars = len(section_obj.raw_content)
                print(f"Raw content length: {raw_chars} characters")

            # Extract section metadata and clean content
            metadata, content_after_meta = self._extract_section_metadata(section_obj.raw_content)
            section_obj.metadata = metadata

            print(f"Metadata extracted: {list(metadata.keys())}")

            # Split content into main part and sources part
            section_obj.main_markdown_content, section_obj.sources_markdown_content = self._split_main_and_sources(content_after_meta)

            print(f"Main markdown length: {len(section_obj.main_markdown_content)} characters")
            print(f"Sources markdown length: {len(section_obj.sources_markdown_content)} characters")

            # Process main content - convert to HTML first
            if section_obj.main_markdown_content.strip():
                 section_obj.main_html_content = self._markdown_to_styled_html(section_obj.main_markdown_content)
                 print(f"Main HTML content length: {len(section_obj.main_html_content)} characters")
                 # Extract intro paragraph for section summaries (from main markdown content)
                 section_obj.intro = self._extract_intro(section_obj.main_markdown_content)
                 # Extract key topics/subsections for TOC and summaries (from main HTML content)
                 section_obj.key_topics = self._extract_key_topics(section_obj.main_html_content, max_topics=5)
                 print(f"Extracted key topics: {section_obj.key_topics}")
                 # Estimate reading time (based on main markdown content)
                 section_obj.reading_time = self._estimate_reading_time(section_obj.main_markdown_content)
            else:
                 print("[yellow]Warning: Main markdown content is empty after splitting.[/yellow]")
                 section_obj.main_html_content = "" # Ensure it's empty string
                 section_obj.key_topics = []
                 section_obj.intro = ""
                 section_obj.reading_time = 0


            # Process sources content if exists
            if section_obj.sources_markdown_content.strip():
                print(f"Processing sources for section {section_obj.id}")
                # Clean up potential empty lines before conversion
                cleaned_sources_md = section_obj.sources_markdown_content.strip()
                if cleaned_sources_md:
                    # Convert sources markdown to basic HTML
                    basic_sources_html = markdown.markdown(
                        cleaned_sources_md,
                        extensions=["extra", "footnotes", "nl2br"]
                    )

                    # Process the sources HTML with the dedicated helper
                    processed_sources_html = self._process_sources_html(basic_sources_html)

                    # Store the processed HTML
                    section_obj.sources_html_content = processed_sources_html

                    source_html_len = len(processed_sources_html)
                    print(f"Processed sources HTML length: {source_html_len} characters")

                    # Append to global sources HTML collection
                    if processed_sources_html.strip():
                        all_sources_html += processed_sources_html + "\n\n" # Add newline between sources from different sections
                        print(f"Added to all_sources_html (now {len(all_sources_html)} characters)")

            # Keep the html_content field for backward compatibility (use main content)
            section_obj.html_content = section_obj.main_html_content

            processed_sections.append(section_obj)

        # Final summary
        print(f"\nProcessing complete. {len(processed_sections)} sections processed.")
        print(f"Total all_sources_html length: {len(all_sources_html)} characters")

        # Save HTML to files for debugging if needed
        debug_output = Path("debug_output")
        save_debug_files = False # Set to True to enable debug file saving

        if save_debug_files and (debug_output.exists() or (not debug_output.exists() and (len(all_sources_html) > 0 or any(s.main_html_content for s in processed_sections)))):
            try:
                debug_output.mkdir(exist_ok=True)

                # Save all sources HTML
                if all_sources_html.strip():
                    with open(debug_output / "all_sources.html", "w", encoding="utf-8") as f:
                        f.write(all_sources_html)
                    print(f"Saved all_sources.html to {debug_output}")

                # Save main content from each section
                for idx, section in enumerate(processed_sections, 1):
                    if section.main_html_content.strip():
                         with open(debug_output / f"section_{idx}_{section.id}_main.html", "w", encoding="utf-8") as f:
                             f.write(section.main_html_content)
                         print(f"Saved section_{idx}_{section.id}_main.html to {debug_output}")
                    if section.sources_html_content.strip():
                        with open(debug_output / f"section_{idx}_{section.id}_sources.html", "w", encoding="utf-8") as f:
                             f.write(section.sources_html_content)
                        print(f"Saved section_{idx}_{section.id}_sources.html to {debug_output}")

            except Exception as e:
                print(f"Error saving debug HTML: {str(e)}")

        return processed_sections, all_sources_html

    def _extract_intro(self, content: str) -> str:
        """Extract the first paragraph for use as an introduction/summary."""
        # Find the first non-heading paragraph
        lines = content.split("\n")
        paragraph = []
        in_paragraph = False

        for line in lines:
            line_strip = line.strip()
            # Skip lines that look like headings, YAML markers, lists, or blockquotes
            if line_strip.startswith(("#", "---", "* ", "- ", "+ ", ">", "|", "`")):
                if in_paragraph: # Break if we hit a non-paragraph element after starting
                     break
                continue

            # If we find a non-empty line, start collecting
            if line_strip and not in_paragraph:
                paragraph.append(line_strip)
                in_paragraph = True
            # Add more lines if we've already started a paragraph and it's not empty
            elif in_paragraph and line_strip:
                paragraph.append(line_strip)
            # Break when we hit an empty line after collecting some content
            elif in_paragraph and not line_strip:
                break

        intro = " ".join(paragraph)

        # If the intro is very long, truncate it
        max_length = 250 # Slightly longer intro allowed
        if len(intro) > max_length:
            intro = intro[:max_length].rsplit(" ", 1)[0] + "..."

        return intro

    def generate_pdf(
        self, sections_data: List[PDFSection], output_path: str, metadata: Dict
    ) -> Path:
        """
        Generate a PDF from a list of processed sections.

        Args:
            sections_data: List of PDFSection objects with content already processed
            output_path: Path where the PDF should be saved
            metadata: Dict of metadata for the report (company name, language, etc.)

        Returns:
            Path to the generated PDF file
        """
        print("\n=== Starting PDF Generation ===")

        # Make sure output directory exists
        output_dir = Path(output_path).parent
        output_dir.mkdir(parents=True, exist_ok=True)
        print(f"Output directory: {output_dir}")

        # Process all sections to generate HTML content
        print(f"Processing {len(sections_data)} section objects for HTML generation...")
        processed_sections, all_sources_html = self._process_sections(sections_data)

        # Verify processed sections have HTML content
        valid_sections_count = sum(1 for s in processed_sections if s.main_html_content.strip())
        print(f"Number of sections with non-empty main HTML content: {valid_sections_count}")
        if valid_sections_count == 0:
            print("[red]Error: No sections have valid HTML content to render. Aborting PDF generation.[/red]")
            return None

        # Use project_root consistently for all paths
        base_url = self.project_root.as_uri()
        print(f"Base URL for assets: {base_url}")

        # Get paths for logo and favicon from metadata or defaults
        logo_path = metadata.get("logo") or self.project_root / "templates/assets/supervity_logo.png"
        favicon_path = metadata.get("favicon") or self.project_root / "templates/assets/supervity_favicon.png"

        # Convert to file:// URLs after checking existence
        logo_file_url = Path(logo_path).as_uri() if Path(logo_path).exists() else None
        favicon_file_url = Path(favicon_path).as_uri() if Path(favicon_path).exists() else None

        print(f"Using logo URL: {logo_file_url}")
        print(f"Using favicon URL: {favicon_file_url}")

        # Generate TOC HTML
        print("Generating table of contents HTML...")
        toc_html = self._generate_toc(processed_sections)
        print(f"TOC HTML length: {len(toc_html)} characters")

        # Prepare template variables
        now = datetime.now()
        formatted_date = metadata.get("generation_date", now.strftime("%Y-%m-%d"))

        print("Rendering HTML template...")
        template_vars = {
            "title": f"{metadata.get('company_name', 'Company')} {metadata.get('report_type', 'Analysis')}",
            "company_name": metadata.get("company_name", "Company"),
            "language": metadata.get("language", "English"),
            "date": formatted_date, # Use formatted date from metadata or now
            "sections": processed_sections, # Pass processed sections with HTML content
            "toc": toc_html,
            "logo_url": logo_file_url,
            "favicon_url": favicon_file_url,
            "section_order": SECTION_ORDER, # Keep if template uses it
            "pdf_config": PDF_CONFIG, # Keep if template uses it
            "all_sources_html": all_sources_html,
            "generation_date": formatted_date,
        }

        # print(f"Template variables: {list(template_vars.keys())}") # Optional debug print
        html_content = self.template.render(**template_vars)

        print(f"Rendered HTML length: {len(html_content)} characters")

        # Save the full HTML for debugging
        debug_output = Path("debug_output")
        save_debug_files = False # Set to True to enable debug file saving

        if save_debug_files and (debug_output.exists() or (not debug_output.exists() and len(html_content) > 0)):
            try:
                debug_output.mkdir(exist_ok=True)
                with open(debug_output / "rendered_template.html", "w", encoding="utf-8") as f:
                    f.write(html_content)
                print(f"Saved rendered template to {debug_output / 'rendered_template.html'}")
            except Exception as e:
                print(f"Error saving rendered template: {str(e)}")

        # Generate the PDF file from HTML
        print("Generating PDF from rendered HTML...")
        font_config = FontConfiguration()
        html = HTML(string=html_content, base_url=base_url)

        # Define CSS for the PDF using project_root for path resolution
        css_files = [
            (self.project_root / "templates/css/pdf.css"),
            (self.project_root / "templates/css/github-markdown.css"),
            (self.project_root / "templates/css/highlight.css"),
        ]

        css = []
        css_files_found = []
        for css_file in css_files:
            if css_file.exists():
                try:
                    css.append(CSS(filename=str(css_file)))
                    css_files_found.append(css_file.name)
                except Exception as e:
                    print(f"[yellow]Warning: Could not load CSS file {css_file}: {e}[/yellow]")
            else:
                print(f"[yellow]Warning: CSS file not found: {css_file}[/yellow]")

        if css_files_found:
            print(f"Using CSS files: {', '.join(css_files_found)}")
        else:
            print("[yellow]Warning: No custom CSS files found or loaded. PDF styling might be basic.[/yellow]")
            # Optionally add default CSS here if needed

        # Generate the PDF with proper error handling
        try:
            print(f"Writing PDF to: {output_path}")
            html.write_pdf(output_path, stylesheets=css, font_config=font_config)
            output_path_obj = Path(output_path)
            if output_path_obj.exists() and output_path_obj.stat().st_size > 1000: # Basic check for non-empty PDF
                print(f"[green]PDF generated successfully: {output_path}[/green]")
                return output_path_obj
            else:
                print(f"[red]Error: PDF generation failed or created an empty/small file at {output_path}[/red]")
                if output_path_obj.exists():
                     print(f"File size: {output_path_obj.stat().st_size} bytes")
                return None

        except Exception as e:
            print(f"[red]Error during WeasyPrint PDF generation: {str(e)}[/red]")
            traceback.print_exc()
            # Return the path anyway in case the file was partially created
            return Path(output_path) if Path(output_path).exists() else None

    def _cleanup_raw_markdown(self, content: str) -> str:
        """Clean up raw markdown content before processing."""
        # Replace Windows-style line endings with Unix style
        content = content.replace("\r\n", "\n")

        # Ensure there's a newline at the end of each file
        if not content.endswith("\n"):
            content += "\n"

        # Remove potential leading/trailing whitespace from the entire content
        content = content.strip()

        return content

    def _split_main_and_sources(self, content_with_sources: str) -> Tuple[str, str]:
        """
        Splits markdown content into main part and sources part.

        Args:
            content_with_sources: Markdown content (after metadata extraction)

        Returns:
            Tuple of (main_content, sources_content)
        """
        main_content = content_with_sources
        sources_content = ""

        # Use patterns from config
        source_patterns = PDF_CONFIG["SOURCES"]["SOURCE_HEADING_PATTERNS"]

        # Regex pattern to find any of the source headings
        # This pattern matches headings like:
        # # Sources
        # ## Sources
        # **Sources**
        # at the start of a line with optional space before/after
        # Ensure it captures the heading itself and the content below it

        # --- CORRECTED LINE ---
        # Calculate the joined patterns separately for clarity
        joined_patterns = "|".join(re.escape(p) for p in source_patterns)
        # Use an f-string and escape the literal curly braces for the regex quantifier
        pattern_str = rf"(?im)^([ \t]*(?:#{{1,6}}\s*|(?:\*\*)?)(?:{joined_patterns})(?:(?:\*\*)?)\s*)$"
        # --- END CORRECTED LINE ---


        # Find all potential matches
        matches = list(re.finditer(pattern_str, content_with_sources))

        if matches:
             # Find the last occurrence of a source heading
             last_match = matches[-1]
             split_index = last_match.start()
             main_content = content_with_sources[:split_index].strip()
             sources_content = content_with_sources[split_index:].strip()
             # print(f"Split content at index {split_index} based on heading: '{last_match.group(1).strip()}'") # Debug print
        # else: # Debug print
        #     print("No source heading found matching patterns:", source_patterns)


        return main_content, sources_content

    def _process_sources_html(self, sources_html: str) -> str:
        """
        Apply styling and transformations to the sources HTML content.

        Args:
            sources_html: The HTML string of sources content

        Returns:
            Processed HTML string with appropriate styling classes applied
        """
        if not sources_html.strip():
            return ""

        soup = BeautifulSoup(sources_html, "html.parser")

        # Remove the main "Sources" heading if it was included from markdown
        source_heading_patterns = PDF_CONFIG["SOURCES"]["SOURCE_HEADING_PATTERNS"]
        for h_tag in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
            if h_tag.get_text(strip=True) in source_heading_patterns:
                h_tag.decompose()
                break # Assume only one main heading

        # Apply sources list class to all top-level lists in the sources
        if "STYLING" in PDF_CONFIG and "SOURCES_LIST_CLASS" in PDF_CONFIG["STYLING"]:
            sources_list_class = PDF_CONFIG["STYLING"]["SOURCES_LIST_CLASS"]
            for list_tag in soup.find_all(["ul", "ol"], recursive=False): # Only top-level
                list_tag['class'] = list_tag.get('class', []) + [sources_list_class]

        # Process links for long URLs
        if "SOURCES" in PDF_CONFIG and "MAX_URL_DISPLAY_LENGTH" in PDF_CONFIG["SOURCES"]:
            max_display_len = PDF_CONFIG["SOURCES"]["MAX_URL_DISPLAY_LENGTH"]
            long_url_class = PDF_CONFIG.get("STYLING", {}).get("LONG_URL_CLASS", "long-url") # Get class or use default

            for a in soup.find_all("a"):
                url_text = a.get_text(strip=True)
                href = a.get('href', '')

                # Check if the text content IS the URL itself and is long
                if url_text == href and len(url_text) > max_display_len and url_text.startswith(("http://", "https://")):
                    # Store original URL as title for hover
                    a['title'] = url_text
                    # Truncate the displayed text
                    truncated_text = url_text[:max_display_len-3] + "..."
                    a.string = truncated_text
                    # Add class for long URLs
                    a['class'] = a.get('class', []) + [long_url_class]

        # Handle paragraph to list conversion if enabled
        if "SOURCES" in PDF_CONFIG and PDF_CONFIG["SOURCES"].get("AUTO_CONVERT_PARAGRAPH_TO_LIST", False):
            # Find paragraphs that look like they should be list items (starting with "•", "-", "*")
            converted_paragraphs = []
            for p in soup.find_all("p"):
                text = p.get_text().strip()
                # More robust check for list-like items
                if re.match(r"^[*\-•]\s+", text) or re.match(r"^\d+\.\s+", text):
                    # Create a new list item
                    li = soup.new_tag("li")
                    # Copy the paragraph content, removing the bullet/number character
                    li.string = re.sub(r"^[*\-•\d\.]+\s+", "", text).strip()

                    # Find or create the appropriate list (ul or ol)
                    list_type = "ol" if re.match(r"^\d+\.\s+", text) else "ul"
                    target_list = None

                    # Look for a nearby list of the same type
                    prev_sibling = p.find_previous_sibling(list_type)
                    next_sibling = p.find_next_sibling(list_type)

                    if prev_sibling:
                        target_list = prev_sibling
                        target_list.append(li)
                    elif next_sibling:
                        target_list = next_sibling
                        target_list.insert(0, li)
                    else:
                        # Create a new list
                        target_list = soup.new_tag(list_type)
                        # Apply sources list class if configured
                        if "STYLING" in PDF_CONFIG and "SOURCES_LIST_CLASS" in PDF_CONFIG["STYLING"]:
                            target_list['class'] = [PDF_CONFIG["STYLING"]["SOURCES_LIST_CLASS"]]
                        target_list.append(li)
                        p.replace_with(target_list) # Replace paragraph with new list

                    if target_list:
                        p.decompose() # Remove original paragraph if added to a list
                        converted_paragraphs.append(p) # Mark as converted


        # Return only the inner content, excluding the top-level body/html tags added by BS4
        if soup.body:
            return soup.body.decode_contents()
        elif soup.html:
             return soup.html.decode_contents()
        else:
             return str(soup)


# --- Corrected Function ---
def process_markdown_files(
    base_dir: Path,
    company_name: str,
    language: str,
    template_path: Optional[str] = None,
) -> Optional[Path]:
    """
    Process markdown files in the specified directory and generate a PDF report.

    Args:
        base_dir: Path to the base directory containing the markdown directory
        company_name: Name of the company for the report
        language: Language of the report
        template_path: Optional path to a custom template

    Returns:
        Path to the generated PDF, or None if an error occurred
    """
    try:
        markdown_dir = base_dir / "markdown"
        pdf_dir = base_dir / "pdf"

        # Ensure PDF directory exists
        pdf_dir.mkdir(parents=True, exist_ok=True)

        # Create a PDF generator
        pdf_generator = EnhancedPDFGenerator(template_path)

        # Collect all sections based on the defined order
        sections = []
        print(f"Looking for markdown files in: {markdown_dir}")

        # --- CORRECTED LOOP ---
        # Iterate through the SECTION_ORDER tuples correctly
        for section_id_str, section_title_str in SECTION_ORDER:
            section_file = markdown_dir / f"{section_id_str}.md"
            print(f"Checking for section file: {section_file} ... ", end="")

            if not section_file.exists():
                print("[yellow]Not found, skipping.[/yellow]")
                continue

            print("[green]Found.[/green]")

            # Read the content
            try:
                content = section_file.read_text(encoding="utf-8")
            except Exception as read_err:
                print(f"[red]Error reading file {section_file}: {read_err}[/red]")
                continue # Skip this section if file cannot be read

            # Clean up the raw content (optional but good practice)
            cleaned_content = pdf_generator._cleanup_raw_markdown(content)

            # Create a section object using the correct ID and Title from the tuple
            section = PDFSection(
                id=section_id_str,
                title=section_title_str,
                raw_content=cleaned_content
            )
            sections.append(section)
        # --- END CORRECTED LOOP ---

        if not sections:
            print("[red]Error: No markdown files found matching SECTION_ORDER. Cannot generate PDF.[/red]")
            return None

        print(f"Collected {len(sections)} sections for PDF generation.")

        # Output file path
        # Sanitize company name for filename
        safe_company_name = re.sub(r'[\\/*?:"<>|]', "", company_name) # Remove invalid filename characters
        output_filename = f"{safe_company_name}_{language}_Report.pdf"
        output_path = pdf_dir / output_filename

        # Prepare metadata for the PDF generator
        pdf_metadata = {
            "company_name": company_name,
            "language": language,
            "report_type": "Analysis",
            "generation_date": datetime.now().strftime("%Y-%m-%d"),
            # Pass resolved paths for logo/favicon if they exist
            "logo": pdf_generator.project_root / "templates/assets/supervity_logo.png",
            "favicon": pdf_generator.project_root / "templates/assets/supervity_favicon.png",
        }


        # Generate the PDF
        print(f"Generating PDF for {company_name} ({language})...")
        pdf_path = pdf_generator.generate_pdf(
            sections,
            str(output_path),
            pdf_metadata,
        )

        if pdf_path and pdf_path.exists():
             print(f"[green]PDF generated successfully at: {pdf_path}[/green]")
        else:
             print(f"[red]PDF generation failed or file not found at expected path: {output_path}[/red]")

        return pdf_path

    except Exception as e:
        print(f"[red]Error in process_markdown_files: {str(e)}[/red]")
        traceback.print_exc()
        return None