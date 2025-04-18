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
import re
from typing import Optional, Dict, List, Tuple, Any
from config import SECTION_ORDER, PDF_CONFIG
from pydantic import BaseModel


class PDFSection(BaseModel):
    """Model for a section in the PDF."""

    id: str
    title: str
    raw_content: str  # Raw Markdown content (renamed from content)
    main_markdown_content: str = ""  # Main content before sources
    sources_markdown_content: str = ""  # Sources section markdown
    html_content: str = ""  # Processed HTML content (will be replaced later)
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
        if headings and headings[0].name == "h2":
            # Check if it's the section title (usually matches the section.title)
            starting_index = 1

        for heading in headings[starting_index:]:
            # Get the clean text without numbers
            text = heading.get_text().strip()

            # Remove any leading numbers like "1. " or "1.1. " that might be present
            clean_text = re.sub(r"^\d+(\.\d+)*\.\s+", "", text)

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
                heading_id = re.sub(r"[^\w\s-]", "", heading_text.lower())
                heading_id = re.sub(r"[\s-]+", "-", heading_id)
                h_tag["id"] = heading_id

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
            print(f"HTML conversion result preview: {preview}...")
        else:
            print("Warning: HTML conversion resulted in empty string!")
        
        return result

    def _process_list(self, list_tag, level=1, soup=None):
        """Add classes to list elements for better styling."""
        # Add classes based on list type and level
        list_type = "ul" if list_tag.name == "ul" else "ol"
        list_tag["class"] = list_tag.get("class", []) + [f"{list_type}-level-{level}"]

        # Process all list items
        for li in list_tag.find_all("li", recursive=False):
            li["class"] = li.get("class", []) + [f"li-level-{level}"]

            # Recursively process nested lists with increased level
            for nested_list in li.find_all(["ul", "ol"], recursive=False):
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
        if width and (width.endswith('%') and int(width[:-1]) > 95):
            # Create a wrapper div for the table
            wrapper = soup.new_tag('div')
            wrapper['class'] = ['table-responsive']
            # Move the table inside the wrapper
            table.wrap(wrapper)

    def _generate_toc(self, sections):
        """Generate a table of contents from the sections."""
        toc_html = '<div class="toc-container"><div class="toc-header">Table of Contents</div><ul class="toc-list">'

        for idx, section in enumerate(sections, 1):
            # Skip empty sections
            if not section.html_content.strip():
                continue

            # Create a link to the section
            section_id = section.id.lower().replace(" ", "-")
            toc_html += f'<li class="toc-item"><a href="#{section_id}" class="toc-link">{section.title}</a>'

            # If the section has key topics, add them as nested links
            if section.key_topics:
                toc_html += '<ul class="toc-sublist">'
                for topic in section.key_topics:
                    topic_id = re.sub(r"[^\w\s-]", "", topic.lower()).replace(" ", "-")
                    toc_html += f'<li class="toc-subitem"><a href="#{topic_id}" class="toc-sublink">{topic}</a></li>'
                toc_html += "</ul>"

            toc_html += "</li>"

        toc_html += "</ul></div>"
        return toc_html

    def _process_sections(self, sections):
        """Process all sections to extract metadata, split content and generate HTML."""
        processed_sections = []
        all_sources_html = ""
        
        print(f"\nProcessing {len(sections)} sections...")

        for idx, section in enumerate(sections, 1):
            print(f"\nProcessing section {idx}: {section.title} (ID: {section.id})")
            
            # Check the raw content
            if not section.raw_content.strip():
                print(f"Warning: Section {section.id} has empty raw_content!")
            else:
                raw_chars = len(section.raw_content)
                print(f"Raw content length: {raw_chars} characters")
            
            # Extract section metadata and clean content
            metadata, content_after_meta = self._extract_section_metadata(section.raw_content)
            section.metadata = metadata
            
            print(f"Metadata extracted: {list(metadata.keys())}")
            
            # Split content into main part and sources part
            section.main_markdown_content, section.sources_markdown_content = self._split_main_and_sources(content_after_meta)
            
            print(f"Main markdown length: {len(section.main_markdown_content)} characters")
            print(f"Sources markdown length: {len(section.sources_markdown_content)} characters")
            
            # Process main content - convert to HTML first
            section.main_html_content = self._markdown_to_styled_html(section.main_markdown_content)
            
            print(f"Main HTML content length: {len(section.main_html_content)} characters")
            
            # Extract intro paragraph for section summaries (from main markdown content)
            section.intro = self._extract_intro(section.main_markdown_content)
            
            # Extract key topics/subsections for TOC and summaries (from main HTML content)
            section.key_topics = self._extract_key_topics(section.main_html_content, max_topics=5)
            print(f"Extracted key topics: {section.key_topics}")
            
            # Estimate reading time (based on main markdown content)
            section.reading_time = self._estimate_reading_time(section.main_markdown_content)
            
            # Process sources content if exists
            if section.sources_markdown_content:
                print(f"Processing sources for section {section.id}")
                # Clean up potential empty lines before conversion
                cleaned_sources = section.sources_markdown_content.strip()
                if cleaned_sources:
                    # Convert sources markdown to basic HTML
                    basic_sources_html = markdown.markdown(
                        cleaned_sources, 
                        extensions=["extra", "footnotes", "nl2br"]
                    )
                    
                    # Process the sources HTML with the dedicated helper
                    processed_sources_html = self._process_sources_html(basic_sources_html)
                    
                    # Store the processed HTML
                    section.sources_html_content = processed_sources_html
                    
                    source_html_len = len(processed_sources_html)
                    print(f"Processed sources HTML length: {source_html_len} characters")
                    
                    # Append to global sources HTML collection
                    if processed_sources_html.strip():
                        all_sources_html += processed_sources_html + "\n\n"
                        print(f"Added to all_sources_html (now {len(all_sources_html)} characters)")
            
            # Keep the html_content field for backward compatibility (use main content)
            section.html_content = section.main_html_content
            
            processed_sections.append(section)
        
        # Final summary
        print(f"\nProcessing complete. {len(processed_sections)} sections processed.")
        print(f"Total all_sources_html length: {len(all_sources_html)} characters")
        
        # Save HTML to files for debugging if needed
        debug_output = Path("debug_output")
        if debug_output.exists() or (not debug_output.exists() and len(all_sources_html) > 0):
            try:
                debug_output.mkdir(exist_ok=True)
                
                # Save all sources HTML
                with open(debug_output / "all_sources.html", "w", encoding="utf-8") as f:
                    f.write(all_sources_html)
                print(f"Saved all_sources.html to {debug_output}")
                
                # Save main content from each section
                for idx, section in enumerate(processed_sections, 1):
                    with open(debug_output / f"section_{idx}_{section.id}.html", "w", encoding="utf-8") as f:
                        f.write(section.main_html_content)
                    print(f"Saved section_{idx}_{section.id}.html to {debug_output}")
            except Exception as e:
                print(f"Error saving debug HTML: {str(e)}")

        return processed_sections, all_sources_html

    def _extract_intro(self, content: str) -> str:
        """Extract the first paragraph for use as an introduction/summary."""
        # Find the first non-heading paragraph
        lines = content.split("\n")
        paragraph = []

        for line in lines:
            # Skip lines that look like headings or YAML markers
            if line.startswith("#") or line.startswith("---"):
                continue

            # If we find a non-empty line, start collecting
            if line.strip() and not paragraph:
                paragraph.append(line.strip())
            # Add more lines if we've already started a paragraph
            elif paragraph and line.strip():
                paragraph.append(line.strip())
            # Break when we hit an empty line after collecting some content
            elif paragraph and not line.strip():
                break

        intro = " ".join(paragraph)

        # If the intro is very long, truncate it
        max_length = 200
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

        # Process all sections
        print(f"Processing {len(sections_data)} section objects...")
        processed_sections, all_sources_html = self._process_sections(sections_data)
        
        # Verify processed sections
        for idx, section in enumerate(processed_sections, 1):
            print(f"Section {idx}: {section.title} - Main HTML length: {len(section.main_html_content)} characters")
        
        print(f"All sources HTML length: {len(all_sources_html)} characters")

        # Use project_root consistently for all paths
        base_url = self.project_root.as_uri()
        print(f"Base URL: {base_url}")
        
        # Get paths for logo and favicon
        logo_path = self.project_root / "templates/assets/supervity_logo.png"
        favicon_path = self.project_root / "templates/assets/supervity_favicon.png"
        
        # Override with metadata if provided
        if metadata.get("logo"):
            custom_logo = Path(metadata.get("logo"))
            if custom_logo.exists():
                logo_path = custom_logo.resolve()
            else:
                print(f"Warning: Logo path {custom_logo} does not exist, using default")
                
        if metadata.get("favicon"):
            custom_favicon = Path(metadata.get("favicon"))
            if custom_favicon.exists():
                favicon_path = custom_favicon.resolve()
            else:
                print(f"Warning: Favicon path {custom_favicon} does not exist, using default")
        
        # Convert to file:// URLs after checking existence
        logo_file_url = logo_path.as_uri() if logo_path.exists() else None
        favicon_file_url = favicon_path.as_uri() if favicon_path.exists() else None
        
        print(f"Using logo URL: {logo_file_url}")
        print(f"Using favicon URL: {favicon_file_url}")

        # Generate TOC
        print("Generating table of contents...")
        toc_html = self._generate_toc(processed_sections)
        print(f"TOC HTML length: {len(toc_html)} characters")

        # Generate the HTML content from the template
        now = datetime.now()
        formatted_date = now.strftime("%Y-%m-%d")
        
        print("Rendering HTML template...")
        template_vars = {
            "title": f"{metadata.get('company_name', 'Company')} {metadata.get('report_type', 'Analysis')}",
            "company_name": metadata.get("company_name", "Company"),
            "language": metadata.get("language", "English"),
            "date": formatted_date,
            "sections": processed_sections,
            "toc": toc_html,
            "logo_url": logo_file_url,
            "favicon_url": favicon_file_url,
            "section_order": SECTION_ORDER,
            "pdf_config": PDF_CONFIG,
            "all_sources_html": all_sources_html,
            "generation_date": formatted_date,
        }
        
        print(f"Template variables: {list(template_vars.keys())}")
        html_content = self.template.render(**template_vars)
        
        print(f"Rendered HTML length: {len(html_content)} characters")
        
        # Save the full HTML for debugging
        debug_output = Path("debug_output")
        if debug_output.exists() or (not debug_output.exists() and len(html_content) > 0):
            try:
                debug_output.mkdir(exist_ok=True)
                with open(debug_output / "rendered_template.html", "w", encoding="utf-8") as f:
                    f.write(html_content)
                print(f"Saved rendered template to {debug_output / 'rendered_template.html'}")
            except Exception as e:
                print(f"Error saving rendered template: {str(e)}")

        # Generate the PDF file from HTML
        print("Generating PDF from HTML...")
        font_config = FontConfiguration()
        html = HTML(string=html_content, base_url=base_url)

        # Define CSS for the PDF using project_root for path resolution
        css_files = [
            (self.project_root / "templates/css/pdf.css"),
            (self.project_root / "templates/css/github-markdown.css"),
            (self.project_root / "templates/css/highlight.css"),
        ]

        css = [
            CSS(filename=str(css_file)) for css_file in css_files if css_file.exists()
        ]
        
        css_files_found = [css_file.name for css_file in css_files if css_file.exists()]
        if css_files_found:
            print(f"Using CSS files: {', '.join(css_files_found)}")
        else:
            print("No CSS files found, using default styles with debugging CSS")
        
        # Add debugging CSS if no custom CSS files exist
        # This helps visualize section boundaries, content areas, etc.
        if not css:
            debug_css_string = """
            /* Debug styles to help visualize content areas */
            .section-content {
                border: 1px solid rgba(0, 0, 255, 0.2);
                background-color: rgba(240, 240, 255, 0.1);
                padding: 10px;
            }
            .final-sources-section {
                border: 1px solid rgba(255, 0, 0, 0.2);
                background-color: rgba(255, 240, 240, 0.1);
                padding: 10px;
            }
            h2, h3, h4, h5, h6 {
                border-bottom: 1px dashed rgba(0, 0, 0, 0.1);
            }
            table {
                border: 1px solid rgba(0, 255, 0, 0.2) !important;
            }
            """
            
            default_css = CSS(
                string="""
                @page {
                    margin: 1cm;
                    @top-center {
                        content: string(title);
                        font-size: 9pt;
                        font-weight: bold;
                    }
                    @bottom-right {
                        content: counter(page);
                        font-size: 9pt;
                    }
                }
                html {
                    font-size: 11pt;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
                }
                h1 {
                    color: #333;
                    font-size: 2.0em;
                    margin-top: 1.5em;
                    string-set: title content();
                }
                h2 {
                    color: #333;
                    font-size: 1.75em;
                    margin-top: 1.2em;
                    border-bottom: 1px solid #eaecef;
                    padding-bottom: 0.3em;
                }
                h3 {
                    font-size: 1.5em;
                    margin-top: 1.1em;
                }
                h4 {
                    font-size: 1.25em;
                    margin-top: 1em;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 1em 0;
                }
                table, th, td {
                    border: 1px solid #eaecef;
                }
                th {
                    background-color: #f6f8fa;
                    padding: 8px;
                    text-align: left;
                }
                td {
                    padding: 8px;
                }
                li {
                    margin: 0.5em 0;
                }
                .page-break {
                    page-break-after: always;
                }
                .section-cover {
                    text-align: center;
                    margin-top: 33vh;
                }
                .section-cover h1 {
                    font-size: 2.5em;
                    margin-top: 0;
                }
                .section-cover .section-subtitle {
                    font-size: 1.5em;
                    color: #666;
                    margin-top: 0.5em;
                }
                .chapter-heading {
                    margin-top: 2em;
                    font-size: 1.1em;
                    color: #666;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .toc-container {
                    margin: 2em 0;
                }
                .toc-header {
                    font-size: 1.5em;
                    font-weight: bold;
                    margin-bottom: 1em;
                }
                .toc-list {
                    list-style-type: none;
                    padding-left: 0;
                }
                .toc-sublist {
                    list-style-type: none;
                    padding-left: 1.5em;
                }
                .toc-item {
                    margin: 0.7em 0;
                    font-weight: bold;
                }
                .toc-subitem {
                    margin: 0.3em 0;
                    font-weight: normal;
                }
                .toc-link, .toc-sublink {
                    text-decoration: none;
                    color: #333;
                }
                .toc-link::after, .toc-sublink::after {
                    content: leader('.') target-counter(attr(href), page);
                    margin-left: 0.5em;
                }
                .report-cover {
                    text-align: center;
                    margin-top: 30vh;
                }
                .report-title {
                    font-size: 2.8em;
                    font-weight: bold;
                    margin-bottom: 0.3em;
                }
                .report-subtitle {
                    font-size: 1.8em;
                    color: #666;
                    margin-bottom: 1em;
                }
                .report-date {
                    font-size: 1.2em;
                    color: #888;
                    margin-top: 1em;
                }
                .report-company {
                    font-size: 2em;
                    color: #333;
                    margin-bottom: 0.5em;
                }
                .report-logo {
                    max-width: 300px;
                    margin-bottom: 2em;
                }
                .footer {
                    text-align: center;
                    margin-top: 2em;
                    font-size: 0.9em;
                    color: #888;
                }
                
                /* Section intro boxes */
                .section-intro-box {
                    background-color: #f8f9fa;
                    border-left: 4px solid #007bff;
                    padding: 1em;
                    margin: 1.5em 0;
                }
                .section-intro-title {
                    font-weight: bold;
                    font-size: 1.1em;
                    margin-bottom: 0.5em;
                }
                .section-key-topics {
                    margin-top: 0.5em;
                }
                .section-key-topics-title {
                    font-weight: bold;
                    margin-bottom: 0.3em;
                }
                .section-key-topics-list {
                    margin: 0;
                    padding-left: 1.5em;
                }
                
                /* Source styling */
                .sources-section {
                    margin-top: 2em;
                    border-top: 1px solid #eaecef;
                    padding-top: 1em;
                }
                .sources-heading {
                    font-size: 1.5em;
                    margin-bottom: 1em;
                }
                .sources-list {
                    padding-left: 1.5em;
                }
                .source-item {
                    margin-bottom: 0.5em;
                }
                """ + debug_css_string  # Add the debug CSS
            )
            css = [default_css]

        # Generate the PDF with proper error handling
        try:
            print(f"Writing PDF to: {output_path}")
            html.write_pdf(output_path, stylesheets=css, font_config=font_config)
            print(f"PDF generated successfully: {output_path}")
            return Path(output_path)
        except Exception as e:
            print(f"Error generating PDF: {str(e)}")
            import traceback
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
        pattern_str = r"(?i)^[ \t]*(?:#{1,2}\s*|(?:\*\*)?)(?:{})(?:(?:\*\*)?\s*\n|$)".format("|".join(re.escape(p) for p in source_patterns))
        
        match = re.search(pattern_str, content_with_sources, re.MULTILINE)

        if match:
            split_index = match.start()
            main_content = content_with_sources[:split_index].strip()
            sources_content = content_with_sources[split_index:].strip()

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
        
        # Apply sources list class to all lists in the sources
        if "STYLING" in PDF_CONFIG and "SOURCES_LIST_CLASS" in PDF_CONFIG["STYLING"]:
            sources_list_class = PDF_CONFIG["STYLING"]["SOURCES_LIST_CLASS"]
            for ul in soup.find_all(["ul", "ol"]):
                ul['class'] = ul.get('class', []) + [sources_list_class]
        
        # Process links for long URLs
        if "SOURCES" in PDF_CONFIG and "MAX_URL_DISPLAY_LENGTH" in PDF_CONFIG["SOURCES"]:
            max_display_len = PDF_CONFIG["SOURCES"]["MAX_URL_DISPLAY_LENGTH"]
            for a in soup.find_all("a"):
                url_text = a.get_text(strip=True)
                # Only process URLs that look like actual URLs
                if len(url_text) > max_display_len and url_text.startswith(("http://", "https://")):
                    # Store original URL as title for hover
                    a['title'] = url_text
                    # Truncate the displayed text
                    truncated_text = url_text[:max_display_len-3] + "..." 
                    a.string = truncated_text
                    
                    # Add class for long URLs if defined in config
                    if "STYLING" in PDF_CONFIG and "LONG_URL_CLASS" in PDF_CONFIG["STYLING"]:
                        long_url_class = PDF_CONFIG["STYLING"]["LONG_URL_CLASS"]
                        a['class'] = a.get('class', []) + [long_url_class]
        
        # Handle paragraph to list conversion if enabled
        if "SOURCES" in PDF_CONFIG and PDF_CONFIG["SOURCES"].get("AUTO_CONVERT_PARAGRAPH_TO_LIST", False):
            # Find paragraphs that look like they should be list items (starting with "•", "-", "*")
            for p in soup.find_all("p"):
                text = p.get_text().strip()
                if text.startswith(("•", "-", "*")):
                    # Create a new list item
                    li = soup.new_tag("li")
                    # Copy the paragraph content, removing the bullet character
                    li.string = text[1:].strip()
                    
                    # Look for a nearby list to add to, or create a new one
                    prev_sibling = p.find_previous_sibling(["ul", "ol"])
                    next_sibling = p.find_next_sibling(["ul", "ol"])
                    
                    if prev_sibling and prev_sibling.name in ["ul", "ol"]:
                        # Add to previous list
                        prev_sibling.append(li)
                        p.decompose()  # Remove original paragraph
                    elif next_sibling and next_sibling.name in ["ul", "ol"]:
                        # Add to next list
                        next_sibling.insert(0, li)
                        p.decompose()  # Remove original paragraph
                    else:
                        # Create a new list
                        ul = soup.new_tag("ul")
                        # Apply sources list class if configured
                        if "STYLING" in PDF_CONFIG and "SOURCES_LIST_CLASS" in PDF_CONFIG["STYLING"]:
                            ul['class'] = [PDF_CONFIG["STYLING"]["SOURCES_LIST_CLASS"]]
                        ul.append(li)
                        p.replace_with(ul)  # Replace paragraph with new list
        
        return str(soup)


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

        # Collect all sections
        sections = []

        # Get the order of sections from config (if available)
        for section_id in SECTION_ORDER:
            section_file = markdown_dir / f"{section_id}.md"

            if not section_file.exists():
                # Skip sections that don't exist
                continue

            # Read the content
            content = section_file.read_text(encoding="utf-8")

            # Create a title based on section ID if not specified otherwise
            title = section_id.replace("_", " ").title()

            # Create a section object
            section = PDFSection(id=section_id, title=title, raw_content=content)

            sections.append(section)

        # Output file path
        output_path = pdf_dir / f"{company_name}_{language}_Report.pdf"

        # Generate the PDF
        pdf_path = pdf_generator.generate_pdf(
            sections,
            str(output_path),
            {
                "company_name": company_name,
                "language": language,
                "report_type": "Analysis",
            },
        )

        return pdf_path
    except Exception as e:
        print(f"Error processing markdown files: {str(e)}")
        import traceback
        traceback.print_exc()
        return None
