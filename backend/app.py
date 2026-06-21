import os, re, shutil, json, sqlite3, fitz, numpy as np, faiss
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from pydantic import BaseModel
from docx import Document

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DB_PATH = os.getenv("DATABASE_URL", "sqlite:///./contracts.db").replace("sqlite:///", "")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
if GEMINI_API_KEY and GEMINI_API_KEY != "xxxxx":
    genai.configure(api_key=GEMINI_API_KEY)

def db(query, params=(), one=False):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.commit()
    conn.close()
    return (rows[0] if rows else None) if one else rows

def db_insert(query, params=()):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(query, params)
    conn.commit()
    rid = cur.lastrowid
    conn.close()
    return rid

def init_db():
    db("""CREATE TABLE IF NOT EXISTS contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL,
        risk_score INTEGER DEFAULT 0, created_at TEXT NOT NULL)""")
    db("""CREATE TABLE IF NOT EXISTS clauses (
        id INTEGER PRIMARY KEY AUTOINCREMENT, contract_id INTEGER NOT NULL,
        text TEXT NOT NULL, risk_level TEXT DEFAULT 'NONE', reason TEXT,
        recommendation TEXT, page INTEGER DEFAULT 1,
        FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE)""")

init_db()
embedding_model = SentenceTransformer(os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"))

RISK_KEYWORDS = {
    "HIGH": [r"non[- ]compete", r"non[- ]solicit", r"indemnify", r"indemnity", r"hold harmless",
             r"unlimited liability", r"liable for all", r"ownership of the ip", r"transfer.*ip",
             r"terminate at any time", r"without notice", r"unilateral termination"],
    "MEDIUM": [r"automatic(ally)? renewal", r"auto[- ]renew", r"arbitration", r"governing law",
               r"jurisdiction", r"net 60", r"net 90", r"late fee"],
    "LOW": [r"confidentiality", r"non[- ]disclosure", r"nda", r"written consent"],
}

def parse_file(path):
    ext = os.path.splitext(path.lower())[1]
    if ext == ".pdf":
        doc = fitz.open(path)
        return [{"text": p.get_text(), "page": i + 1} for i, p in enumerate(doc) if p.get_text().strip()]
    if ext == ".docx":
        return [{"text": "\n".join(p.text for p in Document(path).paragraphs), "page": 1}]
    if ext == ".txt":
        for enc in ("utf-8", "latin-1"):
            try:
                with open(path, encoding=enc) as f:
                    return [{"text": f.read(), "page": 1}]
            except UnicodeDecodeError:
                continue
    raise ValueError("Unsupported file type")

def chunk_document(pages, size=500, overlap=100):
    chunks = []
    for item in pages:
        for para in item["text"].split("\n\n"):
            para = para.strip()
            if not para:
                continue
            if len(para) <= size:
                chunks.append({"text": para, "page": item["page"]})
            else:
                for start in range(0, len(para), size - overlap):
                    t = para[start:start + size].strip()
                    if t:
                        chunks.append({"text": t, "page": item["page"]})
    return chunks

def scan_clause_rules(text):
    t = text.lower()
    for level in ("HIGH", "MEDIUM", "LOW"):
        if any(re.search(p, t) for p in RISK_KEYWORDS[level]):
            return level
    return None

def gemini_json(prompt, fallback):
    if not GEMINI_API_KEY or GEMINI_API_KEY == "xxxxx":
        return fallback
    try:
        r = genai.GenerativeModel("gemini-1.5-flash").generate_content(
            prompt, generation_config={"response_mime_type": "application/json"})
        return json.loads(r.text)
    except Exception as e:
        return {**fallback, "reason": f"Analysis failed: {e}"}

def analyze_clause(text, default_risk):
    fb = {"risk": default_risk, "reason": f"Rule-matched {default_risk} risk. Set GEMINI_API_KEY for AI analysis.",
          "recommendation": "Review with counsel before signing."}
    data = gemini_json(
        f'Analyze this clause: "{text}"\nReturn JSON: {{"risk":"HIGH|MEDIUM|LOW|NONE","reason":"...","recommendation":"..."}}', fb)
    data["risk"] = data.get("risk", default_risk).upper()
    return data

def answer_rag(query, chunks):
    if not GEMINI_API_KEY or GEMINI_API_KEY == "xxxxx":
        return "Configure GEMINI_API_KEY for chat."
    ctx = "\n\n".join(f"--- Page {c['page']} ---\n{c['text']}" for c in chunks)
    try:
        return genai.GenerativeModel("gemini-1.5-flash").generate_content(
            f"Answer using ONLY this contract context:\n{ctx}\n\nQuestion: {query}\nCite page numbers.").text
    except Exception as e:
        return f"Gemini error: {e}"

def faiss_paths(cid):
    return os.path.join(UPLOAD_DIR, f"{cid}.index"), os.path.join(UPLOAD_DIR, f"{cid}.json")

def build_faiss(cid, chunks):
    idx, jp = faiss_paths(cid)
    emb = np.array(embedding_model.encode([c["text"] for c in chunks])).astype("float32")
    index = faiss.IndexFlatL2(emb.shape[1])
    index.add(emb)
    faiss.write_index(index, idx)
    with open(jp, "w", encoding="utf-8") as f:
        json.dump(chunks, f)

def search_faiss(cid, query, k=3):
    idx, jp = faiss_paths(cid)
    if not os.path.exists(idx):
        return []
    index = faiss.read_index(idx)
    with open(jp, encoding="utf-8") as f:
        chunks = json.load(f)
    qv = np.array(embedding_model.encode([query])).astype("float32")
    _, indices = index.search(qv, k)
    return [chunks[i] for i in indices[0] if 0 <= i < len(chunks)]

app = FastAPI(title="LexGuard AI")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class ChatRequest(BaseModel):
    contract_id: int
    question: str

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in (".pdf", ".docx", ".txt"):
        raise HTTPException(400, "Only PDF, DOCX, TXT supported.")
    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    chunks = chunk_document(parse_file(path))
    if not chunks:
        raise HTTPException(400, "No text extracted.")
    cid = db_insert("INSERT INTO contracts (filename, risk_score, created_at) VALUES (?,0,?)",
                    (file.filename, datetime.utcnow().isoformat()))
    build_faiss(cid, chunks)
    analyzed = []
    for c in chunks:
        risk = scan_clause_rules(c["text"])
        if not risk:
            continue
        result = analyze_clause(c["text"], risk)
        db_insert("INSERT INTO clauses (contract_id,text,risk_level,reason,recommendation,page) VALUES (?,?,?,?,?,?)",
                  (cid, c["text"], result["risk"], result["reason"], result["recommendation"], c["page"]))
        analyzed.append(result)
    pts = sum(10 if r["risk"] == "HIGH" else 5 if r["risk"] == "MEDIUM" else 2 for r in analyzed)
    score = min(int((pts / 30) * 100), 100) if pts else 0
    db("UPDATE contracts SET risk_score=? WHERE id=?", (score, cid))
    return {"contract_id": cid, "filename": file.filename}

@app.get("/report/{contract_id}")
async def report(contract_id):
    c = db("SELECT * FROM contracts WHERE id=?", (contract_id,), one=True)
    if not c:
        raise HTTPException(404, "Not found")
    clauses = [dict(x) for x in db("SELECT * FROM clauses WHERE contract_id=?", (contract_id,))]
    return {"contract_id": c["id"], "filename": c["filename"], "risk_score": c["risk_score"],
            "high_risks": sum(1 for x in clauses if x["risk_level"] == "HIGH"),
            "medium_risks": sum(1 for x in clauses if x["risk_level"] == "MEDIUM"),
            "low_risks": sum(1 for x in clauses if x["risk_level"] == "LOW"), "clauses": clauses}

@app.get("/contracts")
async def list_contracts():
    return [dict(c) for c in db("SELECT * FROM contracts ORDER BY id DESC")]

@app.post("/chat")
async def chat(req: ChatRequest):
    chunks = search_faiss(req.contract_id, req.question)
    if not chunks:
        return {"answer": "No relevant text found.", "sources": []}
    return {"answer": answer_rag(req.question, chunks), "sources": chunks}
