# Proposal Ingestion → ITB Automation

A web application that automates the extraction of contact information from subcontractor proposal PDFs and generates an organized Invitation to Bid (ITB) interface. Built for general contractors who need to quickly compile subcontractor contact lists from multiple proposal documents.

## Overview

General contractors receive dozens of subcontractor proposals for each project. Manually extracting contact information (company name, contact person, email, phone, trade) from these PDFs is time-consuming and error-prone. This application automates that process using AI-powered extraction, provides confidence scores for transparency, and allows human review before generating a structured ITB output grouped by trade.

## Demo

### Prerequisites
- Python 3.11+
- Node.js 18+
- OpenAI API key

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:
```
OPENAI_API_KEY=your-key-here
```

Start the backend server:
```bash
cd backend
python main.py
# or: uvicorn main:app --host 0.0.0.0 --port 8000
```

Backend runs on `http://localhost:8000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

## Architecture

### Tech Stack

**Frontend:**
- React 19 with Vite for fast development and optimized builds
- Tailwind CSS for modern, responsive UI design
- Axios for HTTP requests

**Backend:**
- FastAPI for RESTful API with automatic OpenAPI documentation
- Python 3.11+ for PDF processing and AI integration

**PDF Processing:**
- `pdfplumber` for direct text extraction from native PDFs
- `pdf2image` + `pytesseract` for OCR fallback on scanned documents

**AI Extraction:**
- OpenAI GPT-4o for structured data extraction from unstructured text
- JSON mode for consistent output format

### System Flow

```
1. Upload → User selects multiple PDF files via drag-and-drop interface
2. PDF Processing → 
   - Attempt direct text extraction with pdfplumber
   - If extracted text < 100 characters, fall back to OCR
   - Return text + extraction method (text_extraction | ocr)
3. AI Extraction → 
   - Send PDF text to GPT-4o with structured prompt
   - Extract: company_name, contact_name, email, phone, trade
   - Generate confidence score (high/medium/low/none) for each field
4. Review → 
   - Display extracted data in editable table
   - User can correct mistakes
   - Edits automatically set confidence to "high" (user-verified)
5. ITB Output → 
   - Group proposals by trade
   - Display as contact cards with mailto/tel links
   - Export to JSON for integration with other systems
```

## Key Features

- **Confidence Scoring**: Every extracted field includes a confidence level (high/medium/low/none) to indicate extraction certainty
- **OCR Fallback**: Automatically detects scanned PDFs and uses OCR when direct text extraction fails
- **Editable Review Step**: Users can verify and correct AI-extracted data before finalizing
- **Trade-Based Grouping**: ITB output organizes subcontractors by trade for easy reference
- **JSON Export**: Download structured data for integration with other construction management tools
- **Transparency**: Shows extraction method (text vs OCR) for each document
- **Graceful Degradation**: Missing fields are handled elegantly (hidden in UI, null in JSON)

## Design Decisions & Tradeoffs

### Why GPT-4o over Custom NER/Regex?

**Decision**: Use OpenAI GPT-4o for extraction instead of training custom NER models or writing regex patterns.

**Rationale**:
- **Varied Document Formats**: Subcontractor proposals come in countless layouts—some have contact info in headers, others in footers, some embedded in body text. A single model handles all formats without training data.
- **Graceful Degradation**: GPT-4o infers missing information from context (e.g., "John at ABC Concrete" → contact_name: "John", company_name: "ABC Concrete") where regex would fail.
- **Tradeoff**: API cost (~$0.01-0.03 per document) vs. the engineering time to build and maintain custom extraction logic. For a demo, this is acceptable; for production at scale, consider fine-tuning or hybrid approaches.

### Why Confidence Scoring?

**Decision**: Include confidence scores (high/medium/low/none) for every extracted field.

**Rationale**:
- **Transparency over False Precision**: AI models can be confidently wrong. Showing uncertainty helps users prioritize which fields to verify.
- **Mirrors Real Workflows**: In preconstruction, estimators always verify contact information before sending ITBs. Confidence scores guide that verification process.
- **User Trust**: Transparency builds trust. Users see when the model is uncertain and can focus review efforts accordingly.

### Why OCR Fallback?

**Decision**: Automatically fall back to OCR when text extraction yields < 100 characters.

**Rationale**:
- **Real-World Reality**: Many subcontractor proposals are scanned PDFs (faxed, photographed, or scanned from paper). Direct text extraction fails on these.
- **Automatic Detection**: Using character count as a heuristic is simple and effective—scanned PDFs typically extract very little text.
- **Tradeoff**: OCR is slower (~2-5 seconds per page) but necessary for comprehensive coverage. Could be optimized with parallel processing or async queues in production.

### Why Editable Review Step?

**Decision**: Require user review and editing before generating ITB output.

**Rationale**:
- **AI is Not Perfect**: Even with high confidence, extraction can be wrong. Human verification is essential for business-critical data.
- **User Control**: Users can correct mistakes, fill missing fields, or adjust trade classifications.
- **Learning Opportunity**: In production, user corrections could be used to fine-tune prompts or train models.

### Why Trade-Based Grouping?

**Decision**: Group ITB output by trade (Concrete, Electrical, Plumbing, etc.).

**Rationale**:
- **GC Workflow**: General contractors organize subcontractors by trade when sending ITBs. This matches their mental model.
- **Scalability**: As projects grow, grouping makes it easier to find specific trades quickly.
- **Visual Clarity**: Card-based layout within trade sections improves readability over a flat list.

## Limitations & Future Improvements

### Current Limitations

1. **No Deduplication**: If the same company appears in multiple PDFs, they'll appear as separate entries. Could add fuzzy matching on company name/email.
2. **Single Contact Assumption**: Some proposals list multiple contacts (project manager, estimator, etc.). Current implementation extracts only one.
3. **No Batch Optimization**: Files are processed sequentially. Could parallelize for faster processing.
4. **No Caching**: Same PDF processed twice will hit OpenAI API again. Could cache by file hash.
5. **No Queue System**: Large batches could timeout. Production would need async job queues (Celery, RQ, etc.).
6. **No Fine-Tuning**: User corrections aren't used to improve future extractions. Could build a feedback loop.

### Production Considerations

- **Rate Limiting**: Add rate limits to prevent API abuse
- **Error Handling**: More robust error handling for malformed PDFs, API failures
- **Authentication**: Add user authentication and project-based organization
- **Database**: Replace in-memory storage with PostgreSQL for persistence
- **Monitoring**: Add logging, metrics, and error tracking (Sentry, DataDog)
- **Cost Optimization**: Batch API calls, use cheaper models for simple cases, cache results
- **Security**: Validate file types, scan for malware, sanitize inputs

## Assumptions

- **Input Format**: All inputs are PDF files (no Word docs, images, etc.)
- **Language**: Documents are in English (GPT-4o prompt assumes English)
- **Contact Info Exists**: At least some contact information exists somewhere in the document (header, footer, or body)
- **Single Document = Single Company**: Each PDF represents one subcontractor proposal
- **Demo Scope**: This is a technical exercise—no production hardening (auth, scaling, etc.)

## Project Structure

```
bridgeline-exercise/
├── backend/
│   ├── main.py              # FastAPI endpoints
│   ├── extractor.py         # OpenAI extraction logic
│   ├── pdf_processor.py     # PDF to text conversion
│   ├── requirements.txt
│   └── .env                 # API keys
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FileUpload.jsx
│   │   │   ├── ReviewTable.jsx
│   │   │   └── ITBScreen.jsx
│   │   ├── App.jsx
│   │   └── index.css
│   └── package.json
└── README.md
```

## License

Built as a technical exercise for Bridgeline Technologies.


