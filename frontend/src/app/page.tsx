"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, FileText, Send, Plus, Info, MessageSquare } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

type Report = {
  contract_id: number;
  filename: string;
  risk_score: number;
  high_risks: number;
  medium_risks: number;
  low_risks: number;
  clauses: { id: number; text: string; risk_level: string; reason: string; recommendation: string; page: number }[];
};

type Msg = { sender: "user" | "ai"; text: string; sources?: { text: string; page: number }[] };

const riskStyle = (score: number) =>
  score >= 70 ? "text-red-400 bg-red-950/40 border-red-800" :
  score >= 31 ? "text-amber-400 bg-amber-950/40 border-amber-800" :
  "text-emerald-400 bg-emerald-950/40 border-emerald-800";

const riskLabel = (score: number) =>
  score >= 71 ? "HIGH" : score >= 31 ? "MEDIUM" : "LOW";

export default function Home() {
  const [contracts, setContracts] = useState<{ id: number; filename: string; risk_score: number }[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  const checkBackend = async () => {
    try {
      const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error("offline");
      setBackendOnline(true);
      const list = await fetch(`${API}/contracts`).then(r => r.ok ? r.json() : []);
      setContracts(list);
    } catch {
      setBackendOnline(false);
    }
  };

  useEffect(() => {
    checkBackend();
    const id = setInterval(checkBackend, 10000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (selectedId) loadReport(selectedId); }, [selectedId]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, chatLoading]);

  const loadReport = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/report/${id}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        setMsgs([{ sender: "ai", text: `Indexed "${data.filename}". Ask about liability, IP, non-competes, or termination.` }]);
      }
    } finally { setLoading(false); }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/upload`, { method: "POST", body: fd });
      if (res.ok) {
        const d = await res.json();
        const list = await fetch(`${API}/contracts`).then(r => r.json());
        setContracts(list);
        setSelectedId(d.contract_id);
      } else alert((await res.json()).detail || "Upload failed.");
    } catch { alert("Backend unreachable."); }
    finally { setLoading(false); }
  };

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedId || chatLoading) return;
    const q = input;
    setMsgs(p => [...p, { sender: "user", text: q }]);
    setInput("");
    setChatLoading(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract_id: selectedId, question: q }),
      });
      const d = res.ok ? await res.json() : { answer: "Search failed.", sources: [] };
      setMsgs(p => [...p, { sender: "ai", text: d.answer, sources: d.sources }]);
    } catch { setMsgs(p => [...p, { sender: "ai", text: "Connection error." }]); }
    finally { setChatLoading(false); }
  };

  return (
    <div className="flex h-screen bg-[#080B11] text-slate-100 overflow-hidden">
      <aside className="w-64 bg-[#0F1420] border-r border-[#1E293B] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-sm">L</div>
            <span className="font-bold text-sm">LexGuard AI</span>
          </div>
          <button onClick={() => { setReport(null); setSelectedId(null); }} className="p-1 rounded hover:bg-slate-800 text-slate-400">
            <Plus size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {contracts.map(c => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={`w-full text-left p-2 rounded-lg border text-xs ${selectedId === c.id ? "bg-indigo-950/40 border-indigo-700" : "border-[#1E293B] hover:border-slate-700"}`}>
              <div className="flex justify-between gap-1">
                <span className="truncate">{c.filename}</span>
                <span className={`px-1.5 rounded font-bold border shrink-0 ${riskStyle(c.risk_score)}`}>{c.risk_score}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {backendOnline === false && (
          <div className="bg-red-950/60 border-b border-red-800 px-4 py-2 text-xs text-red-200 shrink-0">
            Backend offline — start it first:{" "}
            <code className="bg-black/30 px-1 rounded">uvicorn backend.app:app --reload --port 8001</code>
            {" "}(from project root, with venv activated)
          </div>
        )}
        <div className="flex-1 flex overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Analyzing contract...</p>
          </div>
        ) : !report ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md w-full text-center space-y-4">
              <h2 className="text-xl font-bold">Upload Legal Agreement</h2>
              <p className="text-slate-400 text-xs">PDF, DOCX, or TXT — risk scan + RAG chat</p>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-[#1E293B] hover:border-indigo-500 bg-[#0F1420] rounded-xl p-8 cursor-pointer flex flex-col items-center gap-2">
                <Upload className="text-indigo-400" size={24} />
                <p className="text-xs text-slate-400">Click to upload</p>
                <input ref={fileRef} type="file" onChange={upload} accept=".pdf,.docx,.txt" className="hidden" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex divide-x divide-[#1E293B]">
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-[#1E293B] bg-[#0F1420] flex justify-between items-center">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="text-indigo-400 shrink-0" size={16} />
                  <div className="min-w-0">
                    <h2 className="font-bold text-xs truncate">{report.filename}</h2>
                    <p className="text-[10px] text-slate-400">
                      Score {report.risk_score}/100 · H:{report.high_risks} M:{report.medium_risks} L:{report.low_risks}
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${riskStyle(report.risk_score)}`}>
                  {riskLabel(report.risk_score)} RISK
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {report.clauses.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No risky clauses detected.</p>
                ) : report.clauses.map(c => (
                  <div key={c.id} className="bg-[#0F1420] border border-[#1E293B] rounded-lg p-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${riskStyle(c.risk_level === "HIGH" ? 80 : c.risk_level === "MEDIUM" ? 50 : 20)}`}>
                        {c.risk_level}
                      </span>
                      <span className="text-[9px] text-slate-500">Page {c.page}</span>
                    </div>
                    <p className="text-slate-400 italic bg-black/20 p-2 rounded text-[11px]">"{c.text}"</p>
                    <div className="grid md:grid-cols-2 gap-2 text-[11px]">
                      <div><span className="font-bold text-slate-300 flex items-center gap-1"><Info size={10} /> Why risky</span><p className="text-slate-400 mt-0.5">{c.reason}</p></div>
                      <div><span className="font-bold text-slate-300">Suggestion</span><p className="text-slate-400 mt-0.5">{c.recommendation}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-96 flex flex-col bg-[#090D16] shrink-0">
              <div className="p-3 border-b border-[#1E293B] flex items-center gap-1.5 text-xs font-bold">
                <MessageSquare className="text-indigo-400" size={14} /> Contract Chat
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {msgs.map((m, i) => (
                  <div key={i} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[90%] rounded-lg p-2.5 text-xs border ${m.sender === "user" ? "bg-indigo-600 border-indigo-500" : "bg-[#141B2D] border-[#1E293B]"}`}>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      {m.sources?.[0] && (
                        <p className="mt-2 pt-2 border-t border-slate-700 text-[9px] text-slate-500 italic">
                          [Page {m.sources[0].page}] "{m.sources[0].text.slice(0, 120)}..."
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && <p className="text-[10px] text-slate-500 animate-pulse">Searching...</p>}
                <div ref={chatEnd} />
              </div>
              <form onSubmit={sendChat} className="p-2 border-t border-[#1E293B] flex gap-1">
                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about this contract..."
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-[#1E293B] bg-[#141B2D] focus:outline-none focus:border-indigo-500" />
                <button type="submit" disabled={chatLoading || !input.trim()}
                  className="bg-indigo-600 disabled:bg-slate-800 px-3 rounded-lg"><Send size={14} /></button>
              </form>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
