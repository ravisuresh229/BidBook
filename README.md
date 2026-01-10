# Bidbook: AI-Powered Invitation to Bid (ITB) Automation

**Bidbook** is an intelligent "Bid Leveling" engine that transforms unstructured subcontractor proposals into a clean, actionable Invitation to Bid (ITB) list.

Unlike standard wrappers that simply pass text to an LLM, Bidbook implements a **multi-layered extraction pipeline** designed to handle the messy reality of construction documents—mixed media PDFs, scanned logos, invisible footers, and ambiguous role definitions.

---

## 🚀 The Core Problem

Preconstruction teams spend hours manually typing data from subcontractor proposals. Automating this is difficult because:

1. **"Hybrid" PDFs:** Modern PDFs often contain digital text in the body but **scanned images** in the header/footer (where the contact info lives).
2. **The "Client Trap":** A proposal lists two companies: the Sender (Subcontractor) and the Recipient (General Contractor). Simple AI often scrapes the wrong one.
3. **Ghost Data:** Critical info (phones, emails) is often hidden in tiny footer text or complex tables.

---

## 🛠️ The Technical Solution

Bidbook solves this with a **Three-Stage Extraction Architecture**:

### 1. Hybrid Header & Footer Recovery ("The Dalton/United Fix")

Standard parsing libraries (like `pdfplumber`) fail on files like `United.pdf` or `Dalton.pdf` because the company headers are images, not text.

- **Stage A (Text):** Extracts standard digital text.
- **Stage B (Surgical OCR):** If specific zones are empty, the system takes high-res **300 DPI snapshots** of the **Top 20%** (Header) and **Bottom 10%** (Footer) of the page.
- **Result:** It "sees" the `United Electric` logo and the `301-236-0429` footer phone number even when no text layer exists.

### 2. Role-Aware Intelligence ("The Eagle Fix")

The system doesn't just look for *names*; it looks for *roles*.

- **Proposer Identification:** Prioritizes entities found in the `[HEADER_SCAN]` zone.
- **Client Exclusion:** Actively identifies "To:", "Attn:", or "Submitted To:" blocks and **excludes** those contacts to prevent false positives (e.g., ignoring "Paul Jennrich" to find "Bobby Suastegui").

### 3. Trust-First UX

- **Honesty Protocol:** If an email is missing, the system returns `null` and flags it with a **Red Badge**. It does not hallucinate or guess.
- **Smart Fallbacks:** If a phone number is missing in the header, it specifically hunts in the `[FOOTER_SCAN]` region.

---

## 🏗️ Architecture

- **Frontend:** React 19, Tailwind CSS (Glassmorphism), Framer Motion
- **Backend:** Python 3.11, FastAPI
- **AI Logic:** OpenAI GPT-4o (Structured JSON Mode)
- **OCR Engine:** `pdf2image` + `pytesseract` + `Poppler` (Dockerized on Railway)
- **Infrastructure:** Vercel (Frontend) + Railway (Backend)

---

## 📈 Scalability & Production Strategy

*Addressing the "Bonus: Notes on how this would scale in production" requirement.*

Scaling Bidbook from a demo to an enterprise-grade SaaS involves moving from synchronous processing to an event-driven architecture.

### 1. Asynchronous Processing (The "Blocking" Problem)

**Current:** The API waits for OpenAI/OCR to finish (10-15s per file). This would timeout under load.

**Production Fix:**
- Implement a **Task Queue** (Celery + Redis or BullMQ).
- **Flow:** Upload → Return `job_id` (202 Accepted) → Worker processes PDF → Frontend polls (or WebSocket push) for status.
- **Benefit:** Handles 100+ file uploads simultaneously without locking the server.

### 2. Cost Optimization & Caching

**Current:** Every upload hits GPT-4o (~$0.02/doc).

**Production Fix:**
- **Content-Addressable Caching:** Hash every PDF (SHA-256) upon upload.
- **Logic:** Check Redis for `hash`. If found, return cached JSON immediately.
- **Impact:** Subcontractors often send the same PDF to multiple GCs. This reduces API costs by ~30% and makes the UI instant for duplicate files.

### 3. Data Integrity & Deduplication

**Current:** In-memory processing.

**Production Fix:**
- **PostgreSQL with Vector Search (pgvector):** Store extracted entities as embeddings.
- **Fuzzy Matching:** When "Dalton Electric" is extracted, query the DB for `Dalton Elec Inc` or `Dalton Electric Service`. If similarity > 90%, merge records instead of creating duplicates.

### 4. Model Distillation

**Current:** GPT-4o for everything.

**Production Fix:**
- Use a cheaper, faster local model (e.g., Llama-3-8b-instruct) for the initial text classification ("Is this a proposal?").
- Reserve GPT-4o only for the complex extraction steps (Tables/Handwriting), reducing inference costs by ~60%.

---

## 🧪 Validated Use Cases

| Challenge | File | Outcome |
| :--- | :--- | :--- |
| **Scanned Footer** | `Dalton.pdf` | ✅ Extracted phone from footer image; flagged missing email |
| **Image Header** | `United.pdf` | ✅ Extracted "United Electric" from logo via Header Recovery |
| **Role Confusion** | `Eagle.pdf` | ✅ Extracted sender "Bobby Suastegui", ignored recipient |
| **Complex Table** | `Tel Set.pdf` | ✅ Parsed "Nathaniel" from vertical table column |
| **Multi-line Header** | `Scurto.pdf` | ✅ Reconstructed "Scurto Cement Construction Ltd." |
| **High Confidence** | `BRPI.pdf` | ✅ Full extraction: company, contact, email, phone, website |

---

## ⚠️ Known Limitations

- **OCR-Heavy Documents:** Scanned PDFs with heavily stylized fonts may require manual review. The system flags these with "Review" badges.
- **Missing Data:** Some proposals genuinely lack email addresses or contact names. The system honestly reports `null` rather than guessing.
- **Signature Block Contacts:** Names buried in signature blocks (e.g., "Vice President") are sometimes missed; the Review step allows manual entry.


## 🔮 Roadmap (Bonus Features)

To keep the MVP lightweight and stateless, the following bonus features were designed but not implemented in v1.0:

* **Multi-Contact Support:** The current schema optimizes for the "Primary Contact." v2.0 will update the JSON structure to support an array of `contacts` per company.
* **Confidence Scoring:** While v1.0 uses binary validation (Green/Red badges), v2.0 will implement heuristic scoring (0-100%) based on regex patterns for email/phone validity.
* **Deduplication:** As noted in the Scalability section, deduplication is best handled at the Database level (Postgres) rather than in the application layer to ensure data integrity across concurrent uploads.

---

## 🏃‍♂️ Quick Start

### Backend (Python)

Requires `Tesseract-OCR` and `Poppler` installed locally.
```bash
cd backend
pip install -r requirements.txt
# Create .env with OPENAI_API_KEY
python main.py
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

---

*Built as a Technical Exercise for the Founding Engineer Role.*
