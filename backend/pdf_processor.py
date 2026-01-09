import pdfplumber
from pdf2image import convert_from_path
import pytesseract
from typing import Tuple
import os
import re
import sys


def extract_text_from_pdf(pdf_path: str) -> Tuple[str, str]:
    """
    Extract text from a PDF file.
    
    First attempts direct text extraction using pdfplumber.
    If the extracted text is too short (< 100 characters), falls back to OCR.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Tuple of (extracted_text, method_used) where method is either
        "text_extraction" or "ocr"
        
    Raises:
        FileNotFoundError: If the PDF file doesn't exist
        Exception: For other processing errors
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
    
    # Try direct text extraction first
    try:
        text = ""
        all_footer_text = ""
        filename = os.path.basename(pdf_path)
        
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                # Extract standard page text
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                
                # Force footer extraction: Extract bottom 8% of EVERY page (tightened to avoid table rows)
                page_height = page.height
                footer_bbox = (0, page_height * 0.92, page.width, page_height)
                footer_text = page.within_bbox(footer_bbox).extract_text()
                
                # Hybrid Footer OCR: High-Res Surgical Crop (only if pdfplumber found no footer text)
                # Only run on first or last page (where contact info usually lives) or if page text is short
                if (not footer_text or len(footer_text.strip()) < 10) and (page_num == 0 or page_num == len(pdf.pages) - 1 or len(page_text or "") < 500):
                    try:
                        # Convert page to High-Res Image (300 DPI is critical for small footer text)
                        page_images = convert_from_path(pdf_path, first_page=page_num + 1, last_page=page_num + 1, dpi=300)
                        if page_images:
                            page_image = page_images[0]
                            
                            # SURGICAL CROP: Only the bottom 8% (0.92) to avoid capturing bid table rows
                            # Previous 15% (0.85) was catching table data like "Copper Water Service"
                            img_width, img_height = page_image.size
                            footer_top = int(img_height * 0.92)
                            footer_region = page_image.crop((0, footer_top, img_width, img_height))
                            
                            # Run OCR on footer region with PSM 6 (block of text)
                            ocr_footer_text = pytesseract.image_to_string(footer_region, config=r'--psm 6')
                            
                            # Filter noise: Only keep if it looks like contact info (digits, @, www, phone patterns)
                            if ocr_footer_text and ocr_footer_text.strip():
                                # Check if it contains contact info patterns
                                contact_patterns = ['www', '.com', '.net', '.org', '@', 'Fax', 'Phone', 'Tel', 
                                                   '703', '301', '907', '(', ')', '-']  # Common area codes and phone patterns
                                has_contact_info = any(pattern in ocr_footer_text for pattern in contact_patterns)
                                
                                if has_contact_info:
                                    footer_text = ocr_footer_text.strip()
                                    print(f"DEBUG: OCR'd Footer Text (Page {page_num + 1}, High-Res 300 DPI): {footer_text}")
                                    sys.stdout.flush()
                                else:
                                    # Filtered out as noise
                                    print(f"DEBUG: Footer OCR filtered out noise (Page {page_num + 1}): {ocr_footer_text.strip()[:50]}...")
                                    sys.stdout.flush()
                    except Exception as e:
                        # If OCR fails, continue with empty footer_text
                        print(f"DEBUG: Footer OCR failed for page {page_num + 1}: {e}")
                        sys.stdout.flush()
                
                if footer_text and footer_text.strip():
                    # Add footer text with specific high-value tags
                    footer_tagged = f"\n--- [FOOTER DATA START] ---\n{footer_text.strip()}\n--- [FOOTER DATA END] ---\n"
                    text += footer_tagged
                    all_footer_text += f"Page {page_num + 1} Footer: {footer_text.strip()}\n"
        
        # Debug logging for footer data (always print, even if empty)
        print(f"\n{'='*80}")
        print(f"DEBUG: Footer Extraction for {filename}")
        print(f"{'='*80}")
        if all_footer_text:
            print(f"FOOTER DATA FOUND:\n{all_footer_text}")
        else:
            print("NO FOOTER DATA FOUND - Footer region was empty")
        print(f"{'='*80}\n")
        sys.stdout.flush()  # Force flush to ensure output appears immediately
        
        # Apply regex pre-processing for contact extraction (Tel Set fix)
        text = _preprocess_contact_text(text)
        
        # If we got substantial text, return it
        if len(text.strip()) >= 100:
            return text.strip(), "text_extraction"
        
    except Exception as e:
        # If pdfplumber fails, fall through to OCR
        # This is expected for scanned PDFs, so we don't log it as an error
        pass
    
    # Fall back to OCR for scanned PDFs
    try:
        # Convert PDF pages to images
        images = convert_from_path(pdf_path)
        
        # OCR config: Use PSM 6 (Assume a single uniform block of text)
        # This helps with footer margins that get cropped in default modes
        custom_config = r'--psm 6'
        
        # Extract text from each page using OCR
        ocr_text = ""
        all_footer_text = ""
        filename = os.path.basename(pdf_path)
        
        for page_num, image in enumerate(images):
            # Extract full page text - ENSURE we pass the *entire* image height to OCR
            page_text = pytesseract.image_to_string(image, config=custom_config)
            ocr_text += page_text + "\n"
            
            # Force footer extraction: Extract bottom 15% of image explicitly
            img_width, img_height = image.size
            footer_top = int(img_height * 0.92)
            footer_region = image.crop((0, footer_top, img_width, img_height))
            footer_text = pytesseract.image_to_string(footer_region, config=custom_config)
            
            if footer_text and footer_text.strip():
                # Add footer text with specific high-value tags
                footer_tagged = f"\n--- [FOOTER DATA START] ---\n{footer_text.strip()}\n--- [FOOTER DATA END] ---\n"
                ocr_text += footer_tagged
                all_footer_text += f"Page {page_num + 1} Footer: {footer_text.strip()}\n"
        
        # Debug logging for footer data (always print, even if empty)
        print(f"\n{'='*80}")
        print(f"DEBUG: Footer Extraction (OCR) for {filename}")
        print(f"{'='*80}")
        if all_footer_text:
            print(f"FOOTER DATA FOUND:\n{all_footer_text}")
        else:
            print("NO FOOTER DATA FOUND - Footer region was empty")
        print(f"{'='*80}\n")
        sys.stdout.flush()  # Force flush to ensure output appears immediately
        
        # Apply regex pre-processing for contact extraction (Tel Set fix)
        ocr_text = _preprocess_contact_text(ocr_text)
        
        return ocr_text.strip(), "ocr"
        
    except Exception as e:
        raise Exception(f"Failed to process PDF with OCR: {e}")


def _preprocess_contact_text(text: str) -> str:
    """
    Pre-process extracted text to improve contact extraction.
    
    Specifically helps with Tel Set and similar documents where contact
    information appears in table formats.
    
    Args:
        text: Raw extracted text from PDF
        
    Returns:
        Pre-processed text with improved contact patterns
    """
    # Fix "Contact:" patterns to "Contact Name:" for better LLM extraction
    # Pattern: "Contact: Nathaniel" -> "Contact Name: Nathaniel"
    text = re.sub(
        r'(?i)Contact:\s*([A-Za-z]+(?:\s+[A-Za-z]+)*)',
        r'Contact Name: \1',
        text
    )
    
    return text

