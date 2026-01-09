from openai import OpenAI
from dotenv import load_dotenv
import os
import re
from typing import Dict, Any, Optional
import json
from pydantic import BaseModel, Field, field_validator

# Load environment variables
load_dotenv()


# Pydantic Models for Structured Extraction
class FieldWithConfidence(BaseModel):
    """A field with value and confidence score."""
    value: Optional[str] = None
    confidence: str = Field(default="none")
    
    @field_validator('confidence')
    @classmethod
    def validate_confidence(cls, v):
        """Validate confidence is one of the allowed values."""
        if v not in ["high", "medium", "low", "none"]:
            return "none"
        return v


class ClientInfo(BaseModel):
    """Client (recipient) information extracted from the document."""
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None


class ExtractionData(BaseModel):
    """The extracted data fields for the PROPOSER (subcontractor)."""
    company_name: FieldWithConfidence
    contact_name: FieldWithConfidence
    email: FieldWithConfidence
    phone: FieldWithConfidence
    website: FieldWithConfidence  # NEW: Website URL field
    trade: FieldWithConfidence
    client_info: Optional[ClientInfo] = None  # Client details for validation/debugging


class ExtractionResult(BaseModel):
    """Extraction result with reasoning first, then data."""
    reasoning: str = Field(..., description="Internal monologue explaining the extraction process")
    data: ExtractionData


def extract_contact_info(text: str, filename: str, extraction_method: str = "text_extraction") -> Dict[str, Dict[str, Any]]:
    """
    Extract structured contact information from PDF text using OpenAI GPT-4o.
    
    Implements Role-Aware Chain-of-Thought extraction to correctly identify
    the PROPOSER (subcontractor) vs CLIENT (general contractor).
    
    Args:
        text: Extracted text from the PDF
        filename: Name of the PDF file (for context, but may be unrelated)
        extraction_method: Either "text_extraction" or "ocr" - used to adjust prompt
        
    Returns:
        Dictionary with structure:
        {
            "company_name": {"value": "...", "confidence": "high"},
            "contact_name": {"value": "...", "confidence": "medium"},
            "email": {"value": "...", "confidence": "high"},
            "phone": {"value": "...", "confidence": "low"},
            "website": {"value": "www.company.com", "confidence": "medium"},
            "trade": {"value": "...", "confidence": "medium"},
            "logic_reasoning": {"value": "Reasoning explanation...", "confidence": "high"}
        }
        
        If extraction fails, returns null values with "none" confidence.
    """
    # Load OpenAI API key from environment
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        # Return empty result if API key is missing (error handling in main.py)
        return _get_empty_result()
    
    # DEBUG LOGGING: Print raw extracted text
    import sys
    print(f"\n{'='*80}")
    print(f"=== RAW TEXT FOR {filename} ===")
    print(f"{'='*80}")
    print(text)
    print(f"{'='*80}\n")
    sys.stdout.flush()  # Force flush to ensure output appears immediately
    
    # Text Pre-processing: Extract contact names from table layouts (Tel Set fix)
    # Look for patterns like "Contact: Nathaniel" in tables (vertical or horizontal layout)
    contact_patterns = [
        r'(?i)(estimator|contact)\s*\n\s*([A-Za-z]+(?:\s+[A-Za-z]+)*)',  # Vertical table layout: "Contact\nNathaniel"
        r'(?i)(estimator|contact)[:\s]+([A-Za-z]+(?:\s+[A-Za-z]+)*)'      # Horizontal layout: "Contact: Nathaniel" or "Contact Nathaniel"
    ]
    
    for pattern in contact_patterns:
        matches = list(re.finditer(pattern, text))
        if matches:
            # Process all matches but inject after the first one to avoid duplicates
            match = matches[0]
            contact_name = match.group(2).strip()
            if contact_name and len(contact_name) > 2:  # Valid name (more than 2 chars)
                # Inject explicit contact marker
                explicit_contact = f"\n[EXPLICIT CONTACT FOUND]: {contact_name}\n"
                # Insert after the match to make it visible to LLM
                text = text[:match.end()] + explicit_contact + text[match.end():]
                print(f"DEBUG: Found explicit contact pattern: '{contact_name}' (from pattern: {pattern[:50]}...)")
                sys.stdout.flush()
                break  # Only process first pattern that matches
    
    # Smart truncation: take beginning AND end of document
    # Contact info is often in headers (top) and signature blocks (bottom)
    if len(text) > 8000:
        first_part = text[:4000]
        last_part = text[-4000:]
        truncated_text = first_part + "\n\n[...middle of document truncated...]\n\n" + last_part
    else:
        truncated_text = text
    
    # Edge case: Check if filename is unrelated to company
    # If filename contains common unrelated terms, warn the model
    filename_note = ""
    unrelated_keywords = ['bank', 'invoice', 'receipt', 'statement', 'report', 'summary']
    if any(keyword in filename.lower() for keyword in unrelated_keywords):
        filename_note = f"\nNOTE: The filename '{filename}' may be unrelated to the company. Rely ONLY on document contents, not the filename.\n"
    
    # Add OCR-specific context if needed
    ocr_note = ""
    if extraction_method == "ocr":
        ocr_note = """
NOTE: This text was extracted using OCR (Optical Character Recognition) from a scanned PDF. 
OCR text may have formatting issues, spacing errors, or character recognition mistakes.
Pay extra attention to:
- Letterhead/header information at the TOP (often clearest in scanned docs)
- Signature blocks at the BOTTOM (may have formatting quirks)
- **PAGE FOOTERS** - Footer text may appear garbled or split across lines
- Company names may be split across lines or have spacing issues
- Look for patterns like "TO:" vs "FROM:" even if spacing is off
- **Phone patterns** - Look for phone numbers even if formatting is inconsistent (e.g., "301-236-0429" may appear as "301 236 0429" or "301.236.0429")
- **Website URLs** - May have spaces inserted (e.g., "www. daltonelectric .net" should be normalized to "www.daltonelectric.net")
- Normalize any extracted URLs by removing spaces

"""
    
    # Create the extraction prompt with Role-Aware Chain-of-Thought
    prompt = f"""Extract contact information from the following subcontractor proposal PDF text.

Filename: {filename}
{filename_note}Extraction Method: {extraction_method.upper()}
{ocr_note}PDF Text:
{truncated_text}

You are a Forensic Pre-Construction Analyst. Your goal is to identify TWO distinct entities:
A. The **PROPOSER** (Subcontractor) - Look for the Logo/Header.
B. The **CLIENT** (Recipient) - Look for 'To:', 'Attn:', or 'Submitted To'.

STEP 1: ANALYZE LAYOUT (Internal Monologue in `reasoning` field)
- Identify the HEADER/LOGO owner. (This is the PROPOSER/Subcontractor).
- Identify the 'SUBMITTED TO' / 'ATTN' / 'TO:' block. (This is the CLIENT/Recipient - extract separately).
- Identify the SIGNATURE block at the bottom. (Likely the Proposer's Contact).

STEP 2: EXTRACT DATA - TWO ENTITIES

**PROPOSER (Subcontractor) Data:**
- **Company Name:** Must match the Header/Logo or Signature. DO NOT use names from 'To:' fields.
- **Contact Name:** Prioritize the Signer (e.g., 'Bobby Suastegui', 'Kenny D. Moore'). Reject 'Estimating Team' or 'Project Manager' if no specific name is listed.
- **Email:** ONLY extract emails that are:
  - Near the signer's name in the signature block
  - In the PROPOSER's letterhead/header
  - In the PROPOSER's footer (often repeated on every page)
  - Clearly associated with the PROPOSER company
  - **CRITICAL:** If an email is found in the CLIENT block (e.g., near 'Attn:'), DO NOT put it in `proposer_email`. Put it in `client_info.email` instead.
  - If the Proposer has no email listed (like Dalton Electric), leave `proposer_email` as null.
  - It is better to have a NULL Proposer Email than to steal the Client's email.
- **Phone:** Extract phone number associated with the PROPOSER. PRIORITY ORDER:
  1. Direct/Cell number from signature block (HIGHEST PRIORITY - most useful for contact)
  2. Main office number from header/letterhead
  3. Phone from footer (may repeat on every page)
  Look for phone patterns: (XXX) XXX-XXXX, XXX-XXX-XXXX, XXX.XXX.XXXX
- **Website:** Extract website URL that belongs to the PROPOSER company:
  - Look in headers, footers, and signature blocks
  - Common patterns: www.companyname.com, companyname.net, companyname.org
  - Normalize URLs by removing spaces (e.g., "www. daltonelectric .net" → "www.daltonelectric.net")
  - Do NOT extract recipient/client websites
- **Trade/Scope:** Normalize the work description to a CSI MasterFormat Division (e.g., 'Electrical', 'Concrete', 'Earthwork', 'Plumbing', 'HVAC', 'General Requirements').
  - **CRITICAL TRADE CLASSIFICATION RULE:** If the company name contains 'Communications', 'Telecom', 'Cabling', or if you see header strings like 'WIRELESS & COMMUNICATIONS', classify the Trade as 'Communications' or 'Low Voltage', NOT 'Electrical'.
  - Look for explicit trade indicators in headers and document titles to override generic classifications.

**CLIENT (Recipient) Data:**
- **Company Name:** Extract from 'To:', 'Attn:', 'Submitted To:', or 'Client' sections.
- **Contact Name:** Extract from 'Attn:' or 'Submitted To:' sections if present.
- **Email:** Extract email addresses found in CLIENT blocks (near 'Attn:', 'TO:', 'Submitted To:').
  - If an email is in the CLIENT block, it goes in `client_info.email`, NOT in `proposer_email`.

STEP 3: CALCULATE CONFIDENCE
- If Email is missing -> Confidence = Low.
- If Contact Name is missing but Company is clear -> Confidence = Medium.
- If Proposer and Client are distinct and clear -> Confidence = High.

EDGE CASE HANDLING:
- If the filename is unrelated to the company (e.g. 'Five Star Bank.pdf'), rely *only* on the document contents.
- If multiple emails exist, identify which belongs to PROPOSER (near signer/letterhead) and which belongs to CLIENT (near 'Attn:'/'TO:').
- **EMAIL SEPARATION:** Always separate PROPOSER and CLIENT emails. If you can only find CLIENT emails, put them in `client_info.email` and leave `proposer_email` as null.

Return a JSON object with this EXACT structure:
{{
    "reasoning": "STEP 1 ANALYSIS: [Your internal monologue identifying PROPOSER (header/logo) and CLIENT ('TO:' block)]\\nSTEP 2 EXTRACTION: [What you extracted for PROPOSER and CLIENT, and why]\\nSTEP 3 CONFIDENCE: [How you calculated confidence]",
    "data": {{
        "company_name": {{"value": "...", "confidence": "high"}},
        "contact_name": {{"value": "...", "confidence": "medium"}},
        "email": {{"value": "...", "confidence": "high"}},
        "phone": {{"value": "...", "confidence": "low"}},
        "website": {{"value": "www.companyname.com", "confidence": "medium"}},
        "trade": {{"value": "Electrical", "confidence": "medium"}},
        "client_info": {{
            "company_name": "Nichols Contracting",
            "contact_name": "Tom Walker",
            "email": "twalker@nicholscontracting.com"
        }}
    }}
}}

Note: `client_info` is optional. Include it if you can identify the CLIENT from the document. If no CLIENT information is found, you can omit `client_info` or set it to null.

The `reasoning` field must be a detailed string explaining:
1. Which company you identified as the PROPOSER (from header/logo/signature)
2. Which company you identified as the CLIENT (from 'TO:'/'ATTN:' blocks) and what information you extracted for each
3. Which contact person you identified for PROPOSER (prioritizing the signer)
4. **CONTACT INFORMATION LOCATIONS:**
   - Where you found phone numbers (header, footer, signature block) and which one you prioritized
   - Where you found website URLs (header, footer) and how you normalized them
   - **EMAIL ANALYSIS:** 
     - Which emails you found in the document
     - Which email belongs to the PROPOSER (and where you found it - header, footer, signature)
     - Which email belongs to the CLIENT (and where you found it - put this in `client_info.email`, NOT `proposer_email`)
     - If you found an email in the CLIENT block, explain why you put it in `client_info.email` instead of `proposer_email`
5. How you calculated confidence scores

Use null for values that are not found. Do not include any additional text or explanation."""

    try:
        client = OpenAI(api_key=api_key)
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """You are a Forensic Pre-Construction Analyst specializing in extracting contact information from construction proposal documents.

Your primary goal is to identify the **PROPOSER** (the subcontractor company sending the bid), NOT the CLIENT (the general contractor receiving the bid).

ANALYSIS PRIORITY:
1. **Company Name:** TRUST the Header/Logo at the top of Page 1 above all else. Do NOT let garbage text in the footer override a clear Company Name. The company in the HEADER/LOGO at the TOP is the PROPOSER.
2. **Contact Info:** TRUST the `[FOOTER DATA START]` / `[FOOTER DATA END]` section for Phone, Website, and Email. If the footer contains a phone number (e.g. 301-...), associate it with the Company found in the Header.

CRITICAL RULES:
1. The company in the HEADER/LOGO at the TOP is the PROPOSER
2. The company in the 'TO:' / 'ATTN:' / 'SUBMITTED TO:' block is the CLIENT - **NEVER EXTRACT THIS**
3. The person who SIGNED at the BOTTOM is the PROPOSER's contact
4. Contact info near the signer is more reliable than contact info in 'TO:' sections

CONTACT INFORMATION LOCATIONS - Search ALL of these areas:

1. HEADER/LETTERHEAD (top of first page):
   - Company name, logo
   - Address, phone, fax
   - Website URL (www.companyname.com, companyname.net, etc.)
   - Email

2. PAGE FOOTERS (bottom of any page):
   - Often contains: phone, fax, website, address
   - May repeat on every page - extract from ANY occurrence
   - Look for patterns like "www.", ".com", ".net", ".org"
   - Look for phone patterns: (XXX) XXX-XXXX, XXX-XXX-XXXX, XXX.XXX.XXXX
   - **CRITICAL: PRIORITIZE information found between [FOOTER DATA START] and [FOOTER DATA END] tags for Phone, Email, and Website fields.**
   - **CRITICAL: You MUST analyze the 'PAGE FOOTERS' or sections marked '[FOOTER DATA START]' / '[FOOTER DATA END]'**
   - Construction proposals frequently list the Proposer's Phone, Email, and Website in small text at the very bottom of the page
   - Look for patterns like 'www.', '.com', '301-', '907-' in the last 10 lines of text
   - If the Company Name matches the footer domain (e.g., 'daltonelectric.net' matches 'Dalton Electric'), extract it

3. SIGNATURE BLOCKS (end of document):
   - Contact name, title
   - Direct phone/cell number (PRIORITY for phone extraction)
   - Email address

4. BODY TEXT:
   - "Contact:" or "Estimator:" fields
   - "Phone #:" or "Cell:" labels

PHONE NUMBER PRIORITY (when multiple phones exist):
1. Direct/Cell number from signature block (most useful for contact) - HIGHEST PRIORITY
2. Main office number from header
3. Any phone from footer

WEBSITE EXTRACTION:
- Extract ANY URL that belongs to the SENDER company
- Common patterns: www.companyname.com, companyname.net, companyname.org
- Look in headers, footers, and signature blocks
- Do NOT extract recipient/client websites
- Normalize URLs by removing spaces (e.g., "www. daltonelectric .net" → "www.daltonelectric.net")

EMAIL EXTRACTION - DOUBLE-ENTRY APPROACH:
**CRITICAL RULE:** Extract BOTH PROPOSER and CLIENT emails separately.

- If an email address is found in the CLIENT block (e.g., near 'Attn:', 'TO:', 'Submitted To:'), put it in `client_info.email`.
- DO NOT copy the Client's email into `proposer_email`.
- If the Proposer has no email listed (like Dalton Electric), leave `proposer_email` as null.
- It is better to have a NULL Proposer Email than to steal the Client's email.

**EXTRACTION LOGIC:**
- PROPOSER emails: Extract from signature block, letterhead, footer - clearly associated with PROPOSER company.
- CLIENT emails: Extract from 'Attn:', 'TO:', 'Submitted To:', 'Client' sections - put these in `client_info.email`.
- If you find an email near 'Attn:' or 'TO:', it belongs to the CLIENT, not the PROPOSER.

TRADE NORMALIZATION: You MUST normalize the trade/scope field to CSI MasterFormat standard divisions:
- "Concrete" (foundations, slabs, rebar)
- "Electrical" (lighting, conduit, power, wiring) - BUT NOT Communications/Telecom
- "Communications" or "Low Voltage" (wireless, telecom, cabling, low voltage systems, data cabling) - **PRIORITY OVER Electrical**
- "Plumbing" (piping, water heaters)
- "Earthwork" (grading, excavation, sitework)
- "HVAC" (heating, ventilation, air conditioning)
- "General Requirements" (general contracting, project management)

**CRITICAL TRADE CLASSIFICATION RULE:**
- If the company name contains 'Communications', 'Telecom', 'Cabling', or if you see header strings like 'WIRELESS & COMMUNICATIONS', classify the Trade as 'Communications' or 'Low Voltage', NOT 'Electrical'.
- Explicitly look for header strings like 'WIRELESS & COMMUNICATIONS' to override generic electrical classification.
- Communications/Telecom companies should NEVER be classified as 'Electrical'.

Always return valid JSON with `reasoning` as the first field, followed by `data`."""
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,
            response_format={"type": "json_object"}
        )
        
        # Parse the JSON response
        result_text = response.choices[0].message.content
        result_dict = json.loads(result_text)
        
        # Validate with Pydantic
        try:
            extraction_result = ExtractionResult(**result_dict)
            # Convert Pydantic model to dict format expected by main.py
            return _convert_to_dict_format(extraction_result)
        except Exception as e:
            # If Pydantic validation fails, try to extract what we can
            return _normalize_result_fallback(result_dict)
        
    except json.JSONDecodeError as e:
        # If OpenAI returns invalid JSON, return empty result
        return _get_empty_result()
    except Exception as e:
        # Catch any other OpenAI API errors
        return _get_empty_result()


def _fix_malformed_url(url: Optional[str]) -> Optional[str]:
    """
    Fix malformed URLs extracted by OCR.
    
    Common issue: OCR extracts "wwwadaltonelectric" (missing dot) instead of "www.daltonelectric"
    
    Args:
        url: Extracted URL string
        
    Returns:
        Fixed URL with dot inserted after "www" if needed, or original if no fix needed
    """
    if not url or not isinstance(url, str):
        return url
    
    # Fix: www followed immediately by letter (no dot) -> insert dot
    # Pattern: "wwwadaltonelectric" -> "www.daltonelectric"
    fixed_url = re.sub(r'^www(?=[a-z])', 'www.', url, flags=re.IGNORECASE)
    
    if fixed_url != url:
        print(f"DEBUG: Fixed malformed URL: '{url}' -> '{fixed_url}'")
        import sys
        sys.stdout.flush()
    
    return fixed_url


def _validate_email_against_client(email: Optional[str], proposer_company: Optional[str], client_info: Optional[ClientInfo]) -> Optional[str]:
    """
    Post-processing validation to reject emails that belong to the client.
    
    Now that we explicitly extract client_info, we can check against it directly.
    
    Args:
        email: Extracted proposer email address
        proposer_company: Extracted proposer company name
        client_info: Explicitly extracted client information
        
    Returns:
        Email if valid, None if it matches client
    """
    if not email or not email.strip():
        return None
    
    # If we have explicit client_info, check if email matches client email
    if client_info and client_info.email:
        if email.lower().strip() == client_info.email.lower().strip():
            # This is the client's email - reject it
            return None
    
    # Check if email domain matches client company name
    if client_info and client_info.company_name:
        email_lower = email.lower()
        email_domain = email_lower.split('@')[1] if '@' in email_lower else ''
        client_company_normalized = client_info.company_name.lower().replace(' ', '').replace('&', '').replace(',', '').replace('.', '')
        domain_normalized = email_domain.replace('.com', '').replace('.net', '').replace('.org', '')
        
        # Check if domain matches client company
        if client_company_normalized in domain_normalized or domain_normalized in client_company_normalized:
            # Likely client email - reject it
            return None
    
    return email


def _convert_to_dict_format(extraction_result: ExtractionResult) -> Dict[str, Dict[str, Any]]:
    """
    Convert Pydantic ExtractionResult to the dict format expected by main.py.
    
    Maintains backward compatibility while using the new reasoning-first structure.
    Only returns PROPOSER data to frontend (client_info is extracted but not included in output).
    Includes post-processing email validation to reject client emails.
    """
    proposer_company = extraction_result.data.company_name.value
    extracted_email = extraction_result.data.email.value
    client_info = extraction_result.data.client_info
    
    # Validate email against client (post-processing safety check)
    # Now we can use the explicitly extracted client_info
    validated_email = _validate_email_against_client(extracted_email, proposer_company, client_info)
    
    # Build result with only PROPOSER data (client_info is not included in frontend output)
    result = {
        "company_name": {
            "value": proposer_company,
            "confidence": extraction_result.data.company_name.confidence
        },
        "contact_name": {
            "value": extraction_result.data.contact_name.value,
            "confidence": extraction_result.data.contact_name.confidence
        },
        "email": {
            "value": validated_email,  # Use validated email (may be None if rejected)
            "confidence": "low" if validated_email is None and extracted_email else extraction_result.data.email.confidence
        },
        "phone": {
            "value": extraction_result.data.phone.value,
            "confidence": extraction_result.data.phone.confidence
        },
        "website": {
            "value": _fix_malformed_url(extraction_result.data.website.value),  # Fix malformed URLs
            "confidence": extraction_result.data.website.confidence
        },
        "trade": {
            "value": extraction_result.data.trade.value,
            "confidence": extraction_result.data.trade.confidence
        },
        "logic_reasoning": {
            "value": extraction_result.reasoning,
            "confidence": "high"  # Reasoning is always high confidence (it's the explanation)
        }
    }
    
    # Apply trade normalization
    if result["trade"]["value"]:
        normalized_trade = _normalize_trade(result["trade"]["value"])
        if normalized_trade:
            result["trade"]["value"] = normalized_trade
        elif result["trade"]["confidence"] == "high":
            result["trade"]["confidence"] = "medium"  # Downgrade if couldn't normalize
    
    # Note: client_info is extracted but not included in the result
    # This ensures the frontend only sees PROPOSER data
    # client_info is available for debugging/validation purposes
    
    return result


def _normalize_result_fallback(result_dict: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Fallback normalization if Pydantic validation fails.
    Tries to extract data from the raw dict.
    Also validates email against client_info if present.
    """
    # Try to extract reasoning and data
    reasoning = result_dict.get("reasoning", "Reasoning not provided")
    data = result_dict.get("data", {})
    
    # Extract client_info if present
    client_info_dict = data.get("client_info")
    client_info = None
    if client_info_dict:
        try:
            client_info = ClientInfo(**client_info_dict)
        except:
            pass  # If client_info parsing fails, continue without it
    
    fields = ["company_name", "contact_name", "email", "phone", "website", "trade"]
    normalized = {}
    proposer_company = None
    
    for field in fields:
        if field in data and isinstance(data[field], dict):
            value = data[field].get("value")
            confidence = data[field].get("confidence", "none")
            
            # Validate confidence value
            if confidence not in ["high", "medium", "low", "none"]:
                confidence = "none"
            
            # Store proposer company for email validation
            if field == "company_name":
                proposer_company = value
            
            # Special handling for email field - validate against client
            if field == "email" and value:
                validated_email = _validate_email_against_client(value, proposer_company, client_info)
                value = validated_email
                if validated_email is None and value:  # Email was rejected
                    confidence = "low"
            
            # Special handling for website field - fix malformed URLs
            if field == "website" and value:
                value = _fix_malformed_url(value)
            
            # Special handling for trade field
            if field == "trade" and value:
                normalized_value = _normalize_trade(value)
                if normalized_value:
                    value = normalized_value
                elif confidence == "high":
                    confidence = "medium"
            
            normalized[field] = {
                "value": value if value else None,
                "confidence": confidence
            }
        else:
            normalized[field] = {"value": None, "confidence": "none"}
    
    # Add reasoning
    normalized["logic_reasoning"] = {
        "value": reasoning if reasoning else "Reasoning not provided",
        "confidence": "high"
    }
    
    return normalized


def _normalize_trade(trade_value: str) -> Optional[str]:
    """
    Normalize trade/scope to CSI MasterFormat standard divisions.
    
    Maps extracted trade text to one of:
    - Concrete (foundations, slabs, rebar)
    - Communications (wireless, telecom, cabling, low voltage systems)
    - Electrical (lighting, conduit, power, wiring) - NOT Communications/Telecom
    - Plumbing (piping, water heaters)
    - Earthwork (grading, excavation, sitework)
    - HVAC (heating, ventilation, air conditioning)
    - General Requirements (general contracting, project management)
    
    Args:
        trade_value: Raw trade value extracted from document
        
    Returns:
        Normalized trade division name or None if cannot be mapped
    """
    if not trade_value:
        return None
    
    trade_lower = trade_value.lower().strip()
    
    # Check for explicit "wireless & communications" or similar patterns first
    if 'wireless' in trade_lower and 'communication' in trade_lower:
        return "Communications"
    if 'wireless & communication' in trade_lower:
        return "Communications"
    
    # Define mapping rules for each division
    # IMPORTANT: Check Communications BEFORE Electrical to avoid misclassification
    communications_keywords = ['communications', 'communication', 'telecom', 'telecommunications', 'wireless', 'cabling', 'data cabling', 'low voltage', 'structured cabling', 'network cabling', 'fiber', 'fiber optic']
    concrete_keywords = ['concrete', 'foundation', 'slab', 'rebar', 'reinforcement', 'cement', 'pouring']
    electrical_keywords = ['electrical', 'electric', 'lighting', 'conduit', 'power', 'wiring', 'electrical installation']
    plumbing_keywords = ['plumbing', 'plumber', 'pipe', 'piping', 'water heater', 'fixture', 'drain', 'sewer', 'water system']
    earthwork_keywords = ['earthwork', 'earth work', 'grading', 'excavation', 'excavate', 'sitework', 'site work', 'site prep', 'site preparation', 'dirt work', 'clearing', 'demolition']
    hvac_keywords = ['hvac', 'h.v.a.c', 'heating', 'ventilation', 'air conditioning', 'mechanical', 'air handler', 'ductwork', 'duct work']
    general_keywords = ['general', 'general contractor', 'gc', 'project management', 'coordination', 'site coordination', 'general requirements']
    
    # Check each division's keywords
    # Check Communications FIRST to avoid misclassifying as Electrical
    if any(keyword in trade_lower for keyword in communications_keywords):
        return "Communications"
    elif any(keyword in trade_lower for keyword in concrete_keywords):
        return "Concrete"
    elif any(keyword in trade_lower for keyword in electrical_keywords):
        return "Electrical"
    elif any(keyword in trade_lower for keyword in plumbing_keywords):
        return "Plumbing"
    elif any(keyword in trade_lower for keyword in earthwork_keywords):
        return "Earthwork"
    elif any(keyword in trade_lower for keyword in hvac_keywords):
        return "HVAC"
    elif any(keyword in trade_lower for keyword in general_keywords):
        return "General Requirements"
    
    # If no match found, return None (will be handled as "none" confidence)
    return None


def _get_empty_result() -> Dict[str, Dict[str, Any]]:
    """
    Return an empty result structure with all fields set to null and "none" confidence.
    """
    return {
        "company_name": {"value": None, "confidence": "none"},
        "contact_name": {"value": None, "confidence": "none"},
        "email": {"value": None, "confidence": "none"},
        "phone": {"value": None, "confidence": "none"},
        "website": {"value": None, "confidence": "none"},
        "trade": {"value": None, "confidence": "none"},
        "logic_reasoning": {"value": "Extraction failed", "confidence": "none"}
    }
