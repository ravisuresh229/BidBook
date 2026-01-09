from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Tuple
import os
import tempfile
from dotenv import load_dotenv
from pdf_processor import extract_text_from_pdf
from extractor import extract_contact_info
from difflib import SequenceMatcher

load_dotenv()

app = FastAPI()

# Configure CORS - allow Vercel origins (all .vercel.app domains) and localhost
import re

# Build allowed origins list
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]

# Add FRONTEND_URL if set and not already in list
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
if frontend_url and frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)

# Add any additional origins from env
if os.getenv("ALLOWED_ORIGINS"):
    allowed_origins.extend(os.getenv("ALLOWED_ORIGINS").split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app$",  # Allow all Vercel deployments
    allow_origins=allowed_origins,  # Explicit origins for localhost
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True)


def normalize_company_name(name: str) -> str:
    """Normalize company name for comparison (lowercase, remove common suffixes, punctuation)."""
    if not name:
        return ""
    normalized = name.lower().strip()
    # Remove common suffixes
    suffixes = [" inc", " inc.", " llc", " llc.", " corp", " corp.", " ltd", " ltd.", " co", " co."]
    for suffix in suffixes:
        if normalized.endswith(suffix):
            normalized = normalized[:-len(suffix)].strip()
    # Remove punctuation
    normalized = ''.join(c for c in normalized if c.isalnum() or c.isspace())
    return normalized


def calculate_similarity(name1: str, name2: str) -> float:
    """Calculate similarity between two company names (0-1)."""
    norm1 = normalize_company_name(name1)
    norm2 = normalize_company_name(name2)
    if not norm1 or not norm2:
        return 0.0
    return SequenceMatcher(None, norm1, norm2).ratio()


def count_complete_fields(proposal: Dict[str, Any]) -> int:
    """Count how many fields have non-null values."""
    fields = ['company_name', 'contact_name', 'email', 'phone', 'trade']
    count = 0
    for field in fields:
        if proposal.get(field, {}).get('value'):
            count += 1
    return count


def deduplicate_proposals(proposals: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int]:
    """
    Deduplicate proposals by company name using fuzzy matching.
    
    Uses SequenceMatcher to find similar company names (threshold: 0.85 similarity).
    When duplicates are found, keeps the proposal with the most complete data
    (most non-null fields). Merged proposals include source_files array and _merged flag.
    
    Args:
        proposals: List of proposal dictionaries with company_name field
        
    Returns:
        Tuple of (deduplicated_proposals, merge_count)
    """
    if not proposals:
        return proposals, 0
    
    # Filter out proposals without company names
    valid_proposals = [p for p in proposals if p.get('company_name', {}).get('value')]
    invalid_proposals = [p for p in proposals if not p.get('company_name', {}).get('value')]
    
    if len(valid_proposals) <= 1:
        return proposals, 0
    
    deduplicated = []
    processed_indices = set()
    merge_count = 0
    
    for i, proposal in enumerate(valid_proposals):
        if i in processed_indices:
            continue
        
        company_name = proposal.get('company_name', {}).get('value', '')
        if not company_name:
            deduplicated.append(proposal)
            processed_indices.add(i)
            continue
        
        # Find similar companies
        duplicates = [i]
        source_files = [proposal.get('source_file', '')]
        
        for j in range(i + 1, len(valid_proposals)):
            if j in processed_indices:
                continue
            
            other_company = valid_proposals[j].get('company_name', {}).get('value', '')
            if not other_company:
                continue
            
            similarity = calculate_similarity(company_name, other_company)
            # Threshold of 0.85 for fuzzy matching
            if similarity >= 0.85:
                duplicates.append(j)
                source_files.append(valid_proposals[j].get('source_file', ''))
        
        # Merge duplicates - keep the one with most complete data
        if len(duplicates) > 1:
            merge_count += len(duplicates) - 1
            best_proposal = proposal
            best_completeness = count_complete_fields(proposal)
            
            for dup_idx in duplicates[1:]:
                dup_proposal = valid_proposals[dup_idx]
                completeness = count_complete_fields(dup_proposal)
                if completeness > best_completeness:
                    best_proposal = dup_proposal
                    best_completeness = completeness
            
            # Merge source files
            best_proposal['source_files'] = source_files
            best_proposal['_merged'] = True
            best_proposal['_merge_count'] = len(duplicates) - 1
            deduplicated.append(best_proposal)
        else:
            proposal['source_files'] = [proposal.get('source_file', '')]
            deduplicated.append(proposal)
        
        processed_indices.update(duplicates)
    
    # Add back invalid proposals
    return deduplicated + invalid_proposals, merge_count


@app.post("/upload")
async def upload_pdfs(files: List[UploadFile] = File(...)):
    """
    Upload and process multiple PDF files.
    
    Extracts text from each PDF, then uses OpenAI to extract structured contact information.
    Returns a list of proposals with extracted data, source file, and extraction method.
    """
    proposals = []
    
    for file in files:
        # Validate file type
        if not file.filename.endswith('.pdf'):
            continue
        
        # Create temporary file
        temp_file_path = None
        try:
            # Save uploaded file temporarily
            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix='.pdf',
                dir=UPLOADS_DIR
            ) as temp_file:
                content = await file.read()
                temp_file.write(content)
                temp_file_path = temp_file.name
            
            # Extract text from PDF
            extracted_text, extraction_method = extract_text_from_pdf(temp_file_path)
            
            # Extract contact info using OpenAI (pass extraction method for OCR-specific handling)
            contact_info = extract_contact_info(extracted_text, file.filename, extraction_method)
            
            # Build proposal result
            proposal = {
                "source_file": file.filename,
                "extraction_method": extraction_method,
                **contact_info
            }
            
            proposals.append(proposal)
            
        except FileNotFoundError as e:
            # User-friendly error for missing files
            proposals.append({
                "source_file": file.filename,
                "extraction_method": "error",
                "company_name": {"value": None, "confidence": "none"},
                "contact_name": {"value": None, "confidence": "none"},
                "email": {"value": None, "confidence": "none"},
                "phone": {"value": None, "confidence": "none"},
                "trade": {"value": None, "confidence": "none"},
                "error": f"File not found: {file.filename}"
            })
        except Exception as e:
            # User-friendly error messages
            error_message = str(e)
            if "OCR" in error_message or "tesseract" in error_message.lower():
                error_message = f"Failed to process scanned PDF. Please ensure the PDF is readable."
            elif "OpenAI" in error_message or "API" in error_message:
                error_message = f"Failed to extract data. Please check your API key and try again."
            elif "PDF" in error_message:
                error_message = f"Invalid or corrupted PDF file."
            else:
                error_message = f"Processing failed: {error_message}"
            
            proposals.append({
                "source_file": file.filename,
                "extraction_method": "error",
                "company_name": {"value": None, "confidence": "none"},
                "contact_name": {"value": None, "confidence": "none"},
                "email": {"value": None, "confidence": "none"},
                "phone": {"value": None, "confidence": "none"},
                "trade": {"value": None, "confidence": "none"},
                "error": error_message
            })
        
        finally:
            # Clean up temporary file
            # Always remove temp files to prevent disk space issues
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception:
                    # Silently fail on cleanup - not critical for user experience
                    pass
    
    # Deduplicate proposals by company name
    deduplicated_proposals, merge_count = deduplicate_proposals(proposals)
    
    return {
        "proposals": deduplicated_proposals,
        "merge_count": merge_count,
        "total_processed": len(proposals)
    }


@app.post("/confirm")
async def confirm_proposals(proposals: List[dict]):
    """
    Confirm proposals and return ITB data.
    
    Accepts a list of confirmed proposals and returns them formatted for the ITB interface.
    """
    return {"itb_data": proposals}


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "BidBook PDF Extraction API", "status": "healthy"}

@app.get("/health")
async def health():
    """Health check endpoint for Railway."""
    return {"status": "healthy", "service": "BidBook API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

