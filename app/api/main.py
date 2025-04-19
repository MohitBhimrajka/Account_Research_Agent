"""Main FastAPI application."""

import os
import sys
import uuid
import json
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query, Response
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import asyncio
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Import our core functionality
from app.core.tasks import run_generation
from app.core.generator import process_markdown_files
from config import AVAILABLE_LANGUAGES, PROMPT_FUNCTIONS, LLM_MODEL, LLM_TEMPERATURE, SECTION_ORDER

# Create FastAPI app
app = FastAPI(
    title="PDF Generation API",
    description="API for generating company research PDFs",
    version="1.0.0",
)

# Configure CORS middleware
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # Add any other origins if needed, like your production frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store for tasks
TASKS = {}


class GenerationRequest(BaseModel):
    """Request model for generation tasks."""

    company_name: str
    platform_company_name: str = ""
    language_key: str = "2"  # Default to English
    sections: List[str] = Field(default_factory=list)  # Empty list means all sections


class TaskResponse(BaseModel):
    """Response model for task creation."""

    task_id: str
    status: str
    created_at: str


class TaskStatus(BaseModel):
    """Task status model."""

    task_id: str
    status: str
    created_at: str
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress: float = 0.0
    result: Optional[Dict[str, Any]] = None
    request: Optional[GenerationRequest] = None
    error: Optional[str] = None


class SectionInfo(BaseModel):
    id: str
    title: str


def process_generation_task(
    task_id: str,
    company_name: str,
    platform_company_name: str,
    language_key: str,
    section_ids: List[str],
):
    """Process a generation task in the background.
    
    Args:
        task_id: The unique identifier for the task
        company_name: The name of the target company to research
        platform_company_name: The name of the user's company (if provided)
        language_key: The key from AVAILABLE_LANGUAGES to determine output language
        section_ids: List of section IDs to generate, empty list means all sections
    
    The function updates the TASKS dictionary with progress and results.
    """
    try:
        TASKS[task_id]["status"] = "running"
        TASKS[task_id]["updated_at"] = datetime.now().isoformat()

        # Determine language
        if language_key not in AVAILABLE_LANGUAGES:
            raise ValueError(f"Invalid language key: {language_key}")
        language = AVAILABLE_LANGUAGES[language_key]

        # Determine which sections to generate
        if not section_ids:
            # Generate all sections if none are specified
            logger.info(f"No specific sections requested for task {task_id}, generating all sections defined in PROMPT_FUNCTIONS")
            selected_prompts = PROMPT_FUNCTIONS # Use the original 2-element tuples
        else:
            selected_prompts = []
            invalid_sections = []

            # Extract function IDs from PROMPT_FUNCTIONS for comparison
            # Each tuple in PROMPT_FUNCTIONS has format (section_id, function_name)
            available_section_ids = [section_id for section_id, _ in PROMPT_FUNCTIONS]
            
            for section_id in section_ids:
                # Find the matching prompt function tuple by section_id (first element)
                matching_prompts = [prompt_tuple for prompt_tuple in PROMPT_FUNCTIONS if prompt_tuple[0] == section_id]
                
                if matching_prompts:
                    # Append the entire matching tuple (id, func_name)
                    selected_prompts.append(matching_prompts[0])
                else:
                    invalid_sections.append(section_id)
            
            if invalid_sections:
                logger.warning(f"Invalid section IDs requested for task {task_id}: {invalid_sections}. These will be ignored.")
            
            if not selected_prompts:
                logger.error(f"No valid sections requested for task {task_id}. Cannot proceed.")
                # Raise an error instead of falling back to all sections when specific (but invalid) sections were requested
                raise ValueError(f"No valid report sections were selected. Please check the section IDs and try again.")

            logger.info(f"Selected {len(selected_prompts)} sections for task {task_id}: {[p[0] for p in selected_prompts]}")

        # Run the generation
        token_stats, base_dir = run_generation(
            company_name,
            platform_company_name,
            language,
            selected_prompts,  # This is a list of (section_id, function_name) tuples
        )

        # Generate the PDF
        pdf_path = None
        if token_stats["summary"]["successful_prompts"] > 0:
            pdf_path = process_markdown_files(base_dir, company_name, language)

        # Update task status
        TASKS[task_id].update(
            {
                "status": "completed",
                "completed_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "progress": 1.0,
                "result": {
                    "token_stats": token_stats,
                    "base_dir": str(base_dir),
                    "pdf_path": str(pdf_path) if pdf_path else None,
                },
            }
        )

    except Exception as e:
        logger.exception(f"Error processing task {task_id}: {str(e)}")
        TASKS[task_id].update(
            {
                "status": "failed",
                "completed_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "error": str(e),
            }
        )


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "PDF Generation API", "docs": "/docs"}


@app.post("/generate", response_model=TaskResponse)
async def generate_pdf(request: GenerationRequest, background_tasks: BackgroundTasks):
    """Start a PDF generation task."""
    task_id = str(uuid.uuid4())
    now = datetime.now().isoformat()

    TASKS[task_id] = {
        "task_id": task_id,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "progress": 0.0,
        "request": request.dict(),
    }

    # Use FastAPI's BackgroundTasks to run the generation task
    background_tasks.add_task(
        process_generation_task,
        task_id,
        request.company_name,
        request.platform_company_name,
        request.language_key,
        request.sections,
    )

    return TaskResponse(task_id=task_id, status="pending", created_at=now)


@app.get("/status/{task_id}", response_model=TaskStatus)
async def get_task_status(task_id: str):
    """Get the status of a task."""
    if task_id not in TASKS:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task_data = TASKS[task_id].copy()
    
    # Ensure all required fields are available
    if "updated_at" not in task_data:
        task_data["updated_at"] = task_data["created_at"]
    
    # Convert stored request dict back to GenerationRequest model if it exists
    if "request" in task_data and task_data["request"]:
        try:
            # Validate against the model
            task_data["request"] = GenerationRequest(**task_data["request"])
        except Exception as e:
            logger.warning(f"Error validating request data for task {task_id}: {str(e)}")
            # Provide a fallback if validation fails
            task_data["request"] = None
    
    return TaskStatus(**task_data)


@app.get("/result/{task_id}/pdf")
async def get_pdf_result(task_id: str):
    """Get the PDF result of a completed task."""
    if task_id not in TASKS:
        raise HTTPException(status_code=404, detail="Task not found")

    task = TASKS[task_id]
    if task["status"] != "completed":
        raise HTTPException(
            status_code=400, detail=f"Task not completed (status: {task['status']})"
        )

    if "result" not in task or not task["result"].get("pdf_path"):
        raise HTTPException(status_code=404, detail="PDF not found")

    pdf_path = Path(task["result"]["pdf_path"])
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found")

    return FileResponse(
        path=pdf_path,
        filename=pdf_path.name,
        media_type="application/pdf",
    )


@app.get("/tasks", response_model=List[TaskStatus])
async def list_tasks():
    """List all tasks."""
    task_list = []
    
    for task_id, task_data in TASKS.items():
        try:
            # Create a copy to avoid modifying the original data
            task_copy = task_data.copy()
            
            # Ensure all required fields are available
            if "updated_at" not in task_copy:
                task_copy["updated_at"] = task_copy["created_at"]
                
            # Convert stored request dict back to GenerationRequest model if it exists
            if "request" in task_copy and task_copy["request"]:
                try:
                    task_copy["request"] = GenerationRequest(**task_copy["request"])
                except Exception as e:
                    logger.warning(f"Error validating request data for task {task_id}: {str(e)}")
                    task_copy["request"] = None
                    
            # Add the task_id field if not present
            task_copy["task_id"] = task_id
            
            # Create a TaskStatus object and append to list
            task_list.append(TaskStatus(**task_copy))
            
        except Exception as e:
            logger.error(f"Error processing task {task_id} for listing: {str(e)}")
    
    # Sort tasks by created_at in descending order (newest first)
    task_list.sort(key=lambda x: x.created_at, reverse=True)
    
    return task_list


@app.get("/languages")
async def list_languages():
    """List available languages."""
    return AVAILABLE_LANGUAGES


# --- replace the old "/sections" route with this ----------------------------
@app.get("/sections", response_model=List[SectionInfo])
async def list_sections():
    """
    Return every section ID present in PROMPT_FUNCTIONS, with a human‑readable
    title.  Titles are taken from SECTION_ORDER if available; otherwise a
    Title‑Cased version of the ID is used as a fallback.
    """
    try:
        # 1. Build a quick lookup {id: title} from SECTION_ORDER (if supplied)
        order_title_map: Dict[str, str] = {}
        for section_id, title in SECTION_ORDER:
            order_title_map[section_id] = title

        # 2. Build the response directly from PROMPT_FUNCTIONS
        section_list: List[SectionInfo] = []
        seen: set[str] = set()  # avoid duplicates if same ID appears twice

        for section_id, _func_name in PROMPT_FUNCTIONS:
            if section_id in seen:
                continue
            seen.add(section_id)

            # Prefer explicit title from SECTION_ORDER; else fall back to ID→Title
            title = order_title_map.get(section_id) or section_id.replace("_", " ").title()

            section_list.append(SectionInfo(id=section_id, title=title))

        # 3. Log and return
        logger.info("Returning %s sections: %s", len(section_list), section_list)
        return section_list

    except Exception as exc:
        logger.exception("Error occurred while building section list")
        # Return empty array but keep 200 so frontend does not break
        return []
