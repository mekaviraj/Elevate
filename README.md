# LexGuard AI

**AI-Powered Contract Risk Analyzer** — upload legal agreements, get instant risk scoring, plain-English clause explanations, and a contract-aware chat assistant.

Built for hackathons and real-world use by students, freelancers, employees, startups, and small businesses who need fast contract review without expensive legal counsel.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [How It Works (Pipeline)](#how-it-works-pipeline)
- [Risk Detection Engine](#risk-detection-engine)
- [API Reference](#api-reference)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Demo Script](#demo-script)
- [Target Users](#target-users)
- [Design Goals](#design-goals)
- [Limitations & Disclaimer](#limitations--disclaimer)
- [Future Improvements](#future-improvements)

---

## Problem Statement

Most people sign employment agreements, NDAs, rental agreements, freelance contracts, and service agreements **without fully understanding the risks**. Legal review is:

- Expensive
- Time-consuming
- Inaccessible for individuals and small businesses

Users need a **fast, intelligent way** to identify risky clauses, understand legal language, and make informed decisions **before signing**.

---

## Solution

**LexGuard AI** is a full-stack web application that:

1. Accepts contract uploads (PDF, DOCX, TXT)
2. Parses and chunks the document intelligently
3. Builds a vector index for semantic search (RAG)
4. Scans clauses with a rule-based risk engine
5. Uses Google Gemini to explain risks in plain English
6. Computes an overall contract risk score (0–100)
7. Lets users ask natural-language questions answered **only from the uploaded contract**

> **Important:** The system does **not** dump the entire PDF into the LLM. It uses chunking, embeddings, FAISS vector search, and retrieval-augmented generation (RAG).

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Contract Upload** | PDF, DOCX, and TXT support with text extraction via PyMuPDF |
| **Clause Parsing** | Splits document into meaningful chunks with page references |
| **Risk Detection** | Rule-based keyword scanning for 10+ risk categories |
| **Risk Scoring** | Weighted score 0–100 with Low / Medium / High levels |
| **AI Clause Explanation** | Plain-English risk explanation + negotiation tips per flagged clause |
| **RAG Contract Chat** | Ask questions; answers grounded in retrieved contract text |
| **Dashboard** | Risk score, H/M/L counts, clause cards, sidebar history, chat panel |

### Supported Contract Types

- Employment contracts
- NDAs & confidentiality agreements
- Service agreements
- Rental agreements
- Freelance contracts

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework (App Router) |
| **TypeScript** | Type-safe UI code |
| **Tailwind CSS 4** | Styling & responsive layout |
| **lucide-react** | Icons |

### Backend
| Technology | Purpose |
|------------|---------|
| **FastAPI** | REST API server |
| **Python 3.10+** | Backend runtime |
| **SQLite** | Contract & clause persistence |
| **PyMuPDF** | PDF text extraction |
| **python-docx** | DOCX parsing |

### AI / NLP Stack
| Technology | Purpose |
|------------|---------|
| **Google Gemini 1.5 Flash** | Clause analysis & RAG answers |
| **Sentence Transformers** | Text embeddings |
| **all-MiniLM-L6-v2** | Embedding model (384-dim vectors) |
| **FAISS** | In-memory vector similarity search |
| **RAG** | Retrieval-augmented generation for chat |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│  Upload UI │ Risk Dashboard │ Clause Cards │ RAG Chat Panel     │
│                    http://localhost:3000                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API
┌────────────────────────────▼────────────────────────────────────┐
│                      BACKEND (FastAPI)                          │
│                    http://localhost:8001                        │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌───────────────┐ │
│  │  Parser  │→ │ Chunker  │→ │ Embeddings │→ │ FAISS Index   │ │
│  │ PyMuPDF  │  │ 500 char │  │ MiniLM-L6  │  │ per contract  │ │
│  └──────────┘  └──────────┘  └────────────┘  └───────────────┘ │
│       │              │                              │           │
│       ▼              ▼                              ▼           │
│  ┌──────────┐  ┌──────────────┐            ┌───────────────┐   │
│  │ Risk     │  │ Gemini Flash │            │ RAG Chat      │   │
│  │ Engine   │→ │ Explanations │            │ Retrieve +    │   │
│  │ (rules)  │  │              │            │ Generate      │   │
│  └──────────┘  └──────────────┘            └───────────────┘   │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐                                                   │
│  │ SQLite   │  contracts.db — contracts + flagged clauses       │
│  └──────────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User uploads PDF
       ↓
Extract text (page-by-page)
       ↓
Chunk document (500 chars, 100 overlap)
       ↓
Generate embeddings (all-MiniLM-L6-v2)
       ↓
Store vectors in FAISS index
       ↓
Run risk detection (keyword rules)
       ↓
Flagged clauses → Gemini analysis (reason + recommendation)
       ↓
Compute overall risk score
       ↓
Save to SQLite + serve dashboard
       ↓
User asks question → FAISS retrieval (top-3) → Gemini answer with page citations
```

---

## Project Structure

```
LexAI/
├── README.md                 # This file
├── .gitignore                # Ignores venv, node_modules, .env, uploads, *.db
├── .env                      # API keys & config (create locally, do not commit)
│
├── backend/
│   ├── app.py                # Entire backend: DB, parsing, risk, FAISS, Gemini, API
│   └── requirements.txt      # Python dependencies
│
├── frontend/
│   ├── package.json          # Node dependencies
│   ├── tsconfig.json         # TypeScript config
│   ├── next.config.ts        # Next.js config
│   ├── postcss.config.mjs    # Tailwind PostCSS
│   ├── eslint.config.mjs     # ESLint rules
│   └── src/
│       └── app/
│           ├── page.tsx      # Main dashboard (upload, report, chat)
│           ├── layout.tsx      # Root layout & metadata
│           └── globals.css     # Global styles
│
├── uploads/                  # Created at runtime — uploaded files + FAISS indexes
└── contracts.db              # Created at runtime — SQLite database
```

### File Responsibilities

| File | Lines | What it does |
|------|------:|--------------|
| `backend/app.py` | ~205 | All backend logic in one modular file |
| `frontend/src/app/page.tsx` | ~205 | Complete UI: sidebar, upload, dashboard, chat |
| `frontend/src/app/layout.tsx` | ~15 | App shell and SEO metadata |
| `frontend/src/app/globals.css` | ~6 | Dark theme base styles |

---

## How It Works (Pipeline)

### 1. Document Parsing (`parse_file`)
- **PDF:** PyMuPDF extracts text per page
- **DOCX:** python-docx reads paragraphs
- **TXT:** UTF-8 / Latin-1 fallback

### 2. Chunking (`chunk_document`)
- Splits on paragraph boundaries (`\n\n`)
- Max chunk size: **500 characters**
- Overlap: **100 characters** (for long paragraphs)
- Each chunk retains its **page number**

### 3. Embeddings & FAISS (`build_faiss_index`)
- Encodes all chunks with `all-MiniLM-L6-v2`
- Stores vectors in a FAISS `IndexFlatL2`
- Saves `{contract_id}.index` + `{contract_id}.json` in `uploads/`

### 4. Risk Detection (`scan_clause_rules`)
- Regex keyword matching across HIGH / MEDIUM / LOW tiers
- Only rule-matched chunks are sent to Gemini (saves tokens & cost)

### 5. AI Analysis (`analyze_clause`)
- Gemini returns JSON: `risk`, `reason`, `recommendation`
- Falls back to mock analysis if API key is missing

### 6. Risk Scoring
```
HIGH clause   → 10 points
MEDIUM clause →  5 points
LOW clause    →  2 points

score = min((total_points / 30) * 100, 100)
```

| Score Range | Risk Level |
|-------------|------------|
| 0 – 30      | Low Risk   |
| 31 – 70     | Medium Risk|
| 71 – 100    | High Risk  |

### 7. RAG Chat (`search_faiss` → `answer_rag`)
- Embeds user question
- Retrieves top-3 most similar chunks from FAISS
- Sends only those chunks to Gemini as context
- Answer includes page number citations

---

## Risk Detection Engine

### Flagged Risk Categories

| Category | Default Tier | Example Keywords |
|----------|-------------|------------------|
| Non-compete clauses | HIGH | `non-compete`, `non compete` |
| Non-solicitation | HIGH | `non-solicit` |
| Indemnification | HIGH | `indemnify`, `hold harmless` |
| Unlimited liability | HIGH | `unlimited liability`, `liable for all` |
| IP ownership transfer | HIGH | `ownership of the ip`, `transfer.*ip` |
| One-sided termination | HIGH | `terminate at any time`, `without notice` |
| Automatic renewal | MEDIUM | `auto-renew`, `automatically renewal` |
| Arbitration | MEDIUM | `arbitration`, `governing law` |
| Payment risks | MEDIUM | `net 60`, `net 90`, `late fee` |
| Broad confidentiality | LOW | `confidentiality`, `nda`, `non-disclosure` |

### Example AI Explanation

**Original clause:**
> "The employee shall not engage in competing business activities for six months."

**AI Explanation:**
> You may be restricted from working for competitors for six months after leaving the company. This may limit future employment opportunities.

**Suggestion:**
> Negotiate to reduce the duration or narrow the geographic/competitive scope.

---

## API Reference

Base URL: `http://localhost:8001`

### `POST /upload`
Upload and analyze a contract.

**Request:** `multipart/form-data` with `file` field (`.pdf`, `.docx`, `.txt`)

**Response:**
```json
{
  "contract_id": 1,
  "filename": "employment_agreement.pdf"
}
```

---

### `GET /report/{contract_id}`
Get risk report for a contract.

**Response:**
```json
{
  "contract_id": 1,
  "filename": "employment_agreement.pdf",
  "risk_score": 65,
  "high_risks": 2,
  "medium_risks": 3,
  "low_risks": 1,
  "clauses": [
    {
      "id": 1,
      "text": "Employee agrees not to compete...",
      "risk_level": "HIGH",
      "reason": "This restricts future employment...",
      "recommendation": "Negotiate a shorter non-compete period.",
      "page": 3
    }
  ]
}
```

---

### `GET /contracts`
List all uploaded contracts (newest first).

**Response:**
```json
[
  { "id": 1, "filename": "nda.pdf", "risk_score": 45, "created_at": "2026-06-21T10:00:00" }
]
```

---

### `POST /chat`
Ask a question about a specific contract (RAG).

**Request:**
```json
{
  "contract_id": 1,
  "question": "Can I work for a competitor after leaving?"
}
```

**Response:**
```json
{
  "answer": "Based on Section 4 [Page 3], you are restricted from...",
  "sources": [
    { "text": "Employee shall not engage in competing...", "page": 3 }
  ]
}
```

---

## Setup & Installation

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **Google Gemini API key** — [Get one here](https://aistudio.google.com/apikey)

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd LexAI
```

### 2. Environment variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=sqlite:///./contracts.db
UPLOAD_DIR=uploads
EMBEDDING_MODEL=all-MiniLM-L6-v2
NEXT_PUBLIC_API_URL=http://localhost:8001
```

### 3. Backend setup

```bash
# Create virtual environment
python -m venv elevate

# Activate (Windows)
.\elevate\Scripts\activate

# Activate (macOS/Linux)
source elevate/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 4. Frontend setup

```bash
cd frontend
npm install
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key |
| `DATABASE_URL` | No | `sqlite:///./contracts.db` | SQLite connection string |
| `UPLOAD_DIR` | No | `uploads` | Directory for files & FAISS indexes |
| `EMBEDDING_MODEL` | No | `all-MiniLM-L6-v2` | Sentence Transformer model |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8001` | Backend URL for frontend |

---

## Running the App

Open **two terminals**:

### Terminal 1 — Backend

```bash
# From project root, with venv activated
uvicorn backend.app:app --reload --port 8001
```

API docs available at: **http://localhost:8001/docs**

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

Open the app at: **http://localhost:3000**

---

## Demo Script

Use this 3–5 minute script when presenting at the hackathon.

---

### 🎬 Opening (30 seconds)

> "Hi everyone, we're presenting **LexGuard AI** — an AI-powered contract risk analyzer.
>
> Every day, millions of people sign employment contracts, NDAs, and freelance agreements without fully reading them. Legal review costs hundreds of dollars per hour. We built LexGuard to give anyone instant, intelligent contract analysis — for free."

---

### 🎬 Problem (30 seconds)

> "The problem is simple: legal language is dense, risks are hidden in clauses, and most people — students, freelancers, startup founders — sign documents they don't fully understand.
>
> A bad non-compete clause can block your next job. A broad IP assignment can mean you lose ownership of work you created. Most people only find out after it's too late."

---

### 🎬 Solution Overview (30 seconds)

> "LexGuard AI lets you upload any contract — PDF, Word, or text — and get a full risk assessment in seconds.
>
> We don't just throw the PDF at ChatGPT. We built a real pipeline: document parsing, intelligent chunking, vector embeddings, a rule-based risk engine, and retrieval-augmented generation for Q&A."

---

### 🎬 Live Demo — Upload (45 seconds)

> *[Open http://localhost:3000]*
>
> "Here's our dashboard. I'll upload this employment agreement."
>
> *[Click upload, select a PDF with risky clauses]*
>
> "Behind the scenes, the backend is:
> 1. Extracting text page by page with PyMuPDF
> 2. Splitting it into 500-character chunks
> 3. Building a FAISS vector index with Sentence Transformers
> 4. Running our risk detection engine
> 5. Sending flagged clauses to Google Gemini for plain-English explanations"

---

### 🎬 Live Demo — Risk Dashboard (60 seconds)

> *[Dashboard loads with risk score and clause cards]*
>
> "Here's the risk report. Overall score: **65 out of 100 — Medium Risk**.
>
> We flagged 2 high-risk and 3 medium-risk clauses.
>
> Look at this non-compete clause — the original legal text is here, and Gemini explains it in plain English: *'You may be restricted from working for competitors for six months.'*
>
> And here's a negotiation suggestion: reduce the duration or narrow the scope.
>
> Each clause shows the page number so you can find it in the original document."

---

### 🎬 Live Demo — RAG Chat (60 seconds)

> *[Switch to the chat panel on the right]*
>
> "Now the interactive part — Contract Chat. This uses RAG: Retrieval-Augmented Generation.
>
> I'll ask: **'Can I work for a competitor after leaving?'**"
>
> *[Type and send the question]*
>
> "The system embeds my question, searches the FAISS index for the 3 most relevant contract chunks, and Gemini answers using only that retrieved context — not the whole document.
>
> See the citation? Page 3 — it pulled the exact non-compete clause.
>
> Let me try another: **'Who owns the intellectual property I create?'**"
>
> *[Send second question]*
>
> "It found the IP assignment clause and explained the ownership transfer. This is grounded, explainable AI — every answer traces back to a specific page."

---

### 🎬 Technical Highlights (45 seconds)

> "Under the hood:
> - **Frontend:** Next.js, TypeScript, Tailwind — professional SaaS-style dashboard
> - **Backend:** FastAPI with a clean REST API
> - **NLP:** Sentence Transformers for embeddings, FAISS for vector search
> - **LLM:** Google Gemini 1.5 Flash for analysis and chat
> - **Database:** SQLite for contract history
> - **Risk Engine:** Custom regex rules across 10+ risk categories with weighted scoring
>
> Total application code is under 400 lines — lean, focused, and production-style."

---

### 🎬 Closing (30 seconds)

> "LexGuard AI makes contract review accessible to everyone — students signing their first job offer, freelancers reviewing client agreements, startups evaluating vendor contracts.
>
> It's not a replacement for a lawyer, but it's a powerful first line of defense that helps you know what to negotiate before you sign.
>
> Thank you! Happy to take questions."

---

### 💡 Demo Tips

1. **Prepare a test contract** with obvious risky clauses (non-compete, IP assignment, indemnification) before the demo.
2. **Pre-start both servers** so you don't wait for the embedding model to load during the demo.
3. **Have backup questions ready:**
   - "Can they terminate me without notice?"
   - "What are my confidentiality obligations?"
   - "What is the biggest risk in this contract?"
4. If Gemini API is slow, mention: "First request loads the embedding model — subsequent uploads are faster."
5. Point to **http://localhost:8001/docs** if judges want to see the API.

---

## Target Users

- Students reviewing internship / job offers
- Freelancers evaluating client contracts
- Employees checking employment agreements
- Startups reviewing vendor / partnership deals
- Small businesses without in-house legal teams
- Non-legal professionals who need quick risk awareness

---

## Design Goals

- Feel like a **professional SaaS platform** — not a chatbot wrapper
- Dark, modern dashboard UI
- Responsive layout with sidebar + split-pane dashboard
- Explainable AI — every risk links to original clause text and page number
- Modular, readable codebase suitable for hackathon judging

---

## Limitations & Disclaimer

> **LexGuard AI is not a substitute for professional legal advice.**

- Risk detection uses keyword rules + AI — it may miss nuanced legal risks
- Gemini analysis quality depends on API availability and clause complexity
- Scanned PDFs (image-only) may fail text extraction
- No user authentication (single-user / local deployment)
- Contract summary (executive summary, deadlines) is not yet implemented

---

## Future Improvements

- [ ] Executive contract summary endpoint (obligations, deadlines, restrictions)
- [ ] User authentication & multi-tenant support
- [ ] OCR for scanned PDFs
- [ ] Export risk report as PDF
- [ ] Clause comparison across multiple contracts
- [ ] Docker deployment
- [ ] Cloud vector store (Pinecone / Weaviate) for scale

---

## License

MIT — free to use, modify, and distribute.

---

<p align="center">
  <strong>LexGuard AI</strong> — Know what you're signing.
</p>
