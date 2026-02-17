// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  Brain, Send, RefreshCw, Pill, AlertTriangle, FlaskConical,
  Stethoscope, FileText, CheckCircle, X, Clock, Activity,
  Shield, Heart, Zap, BookOpen, ChevronDown, Sparkles,
  MessageSquare, Copy, ThumbsUp, ThumbsDown
} from 'lucide-react'

type AITab = 'chat' | 'drug_check' | 'differential' | 'coding' | 'history'
interface Message { role: 'user' | 'assistant'; content: string; timestamp: string }
interface AIHistory { id: string; interaction_type: string; prompt: string; response: string; model: string; category: string; was_helpful: boolean | null; created_at: string }

const INP = "w-full px-2.5 py-1.5 bg-[#061818] border border-[#1a3d3d]/50 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"
const TABS: { key: AITab; label: string; icon: typeof Brain }[] = [
  { key: 'chat', label: 'Clinical Chat', icon: MessageSquare },
  { key: 'drug_check', label: 'Drug Checker', icon: Pill },
  { key: 'differential', label: 'Differential Dx', icon: Stethoscope },
  { key: 'coding', label: 'Coding Assist', icon: FileText },
  { key: 'history', label: 'History', icon: Clock },
]

export default function AIAssistantPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [tab, setTab] = useState<AITab>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [history, setHistory] = useState<AIHistory[]>([])
  const [error, setError] = useState<string | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  // Drug checker
  const [drug1, setDrug1] = useState('')
  const [drug2, setDrug2] = useState('')
  const [drugResult, setDrugResult] = useState<string | null>(null)

  // Differential
  const [symptoms, setSymptoms] = useState('')
  const [diffResult, setDiffResult] = useState<string | null>(null)

  // Coding
  const [noteText, setNoteText] = useState('')
  const [codingResult, setCodingResult] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const au = await getCurrentUser()
        if (!au?.doctor?.id) { router.push('/login'); return }
        setDoctorId(au.doctor.id)
        const { data } = await supabase.from('ai_interactions').select('*').eq('doctor_id', au.doctor.id).order('created_at', { ascending: false }).limit(50)
        setHistory((data || []) as AIHistory[])
      } catch { router.push('/login') }
      finally { setLoading(false) }
    }; init()
  }, [router])

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }) }, [messages])

  const saveInteraction = async (type: string, prompt: string, response: string, category: string) => {
    if (!doctorId) return
    try {
      await supabase.from('ai_interactions').insert({ doctor_id: doctorId, interaction_type: type, prompt, response, model: 'claude', category })
    } catch { /* non-critical */ }
  }

  const callAI = async (prompt: string, systemCtx: string, type: string, category: string): Promise<string> => {
    try {
      const res = await fetch('/api/cdss/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, system_context: systemCtx, type }) })
      if (!res.ok) throw new Error('AI service unavailable')
      const data = await res.json()
      const resp = data.response || data.recommendation || data.text || 'No response generated'
      await saveInteraction(type, prompt, resp, category)
      return resp
    } catch (e: any) {
      // Fallback: return a helpful message
      const fallback = `AI analysis is currently unavailable. Please try again later.\n\nFor immediate clinical questions, consider:\n• UpToDate (uptodate.com)\n• DynaMed (dynamed.com)\n• Epocrates for drug interactions`
      return fallback
    }
  }

  const sendChat = async () => {
    if (!input.trim() || generating) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date().toISOString() }])
    setGenerating(true)
    try {
      const resp = await callAI(userMsg, 'You are a clinical decision support assistant for physicians. Provide evidence-based answers. Always recommend consulting clinical guidelines and note this is for informational purposes.', 'chat', 'clinical_chat')
      setMessages(prev => [...prev, { role: 'assistant', content: resp, timestamp: new Date().toISOString() }])
    } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Error generating response.', timestamp: new Date().toISOString() }]) }
    finally { setGenerating(false) }
  }

  const checkDrugs = async () => {
    if (!drug1.trim() || !drug2.trim() || generating) return
    setGenerating(true); setDrugResult(null)
    try {
      const resp = await callAI(`Check for drug interactions between ${drug1} and ${drug2}. Include severity, mechanism, and clinical significance.`, 'You are a pharmacology expert. Analyze drug interactions with clinical detail.', 'drug_check', 'drug_interaction')
      setDrugResult(resp)
    } catch { setDrugResult('Error checking interactions.') }
    finally { setGenerating(false) }
  }

  const generateDiff = async () => {
    if (!symptoms.trim() || generating) return
    setGenerating(true); setDiffResult(null)
    try {
      const resp = await callAI(`Generate differential diagnosis for: ${symptoms}. List most likely to least likely with reasoning.`, 'You are a diagnostic reasoning expert. Provide structured differential diagnoses ranked by likelihood.', 'differential', 'differential_dx')
      setDiffResult(resp)
    } catch { setDiffResult('Error generating differential.') }
    finally { setGenerating(false) }
  }

  const suggestCodes = async () => {
    if (!noteText.trim() || generating) return
    setGenerating(true); setCodingResult(null)
    try {
      const resp = await callAI(`Suggest ICD-10 and CPT codes for this clinical note:\n\n${noteText}`, 'You are a medical coding expert. Suggest appropriate ICD-10 and CPT codes based on clinical documentation. Include code descriptions.', 'coding', 'medical_coding')
      setCodingResult(resp)
    } catch { setCodingResult('Error generating codes.') }
    finally { setGenerating(false) }
  }

  const rateInteraction = async (id: string, helpful: boolean) => {
    try { await supabase.from('ai_interactions').update({ was_helpful: helpful }).eq('id', id) } catch { /* non-critical */ }
    setHistory(prev => prev.map(h => h.id === id ? { ...h, was_helpful: helpful } : h))
  }

  if (loading) return <div className="min-h-screen bg-[#030f0f] flex items-center justify-center"><RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" /></div>

  return (
    <div className="min-h-screen bg-[#030f0f] text-white flex flex-col">
      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-[#030f0f]/95 backdrop-blur-sm border-b border-[#1a3d3d]/50 px-4 py-3">
        <div className="flex items-center gap-3 mb-3"><Brain className="w-5 h-5 text-emerald-400" /><div><h1 className="text-lg font-bold">AI Clinical Assistant</h1><p className="text-xs text-gray-500">CDSS • Drug Checker • Coding Assist</p></div></div>
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${tab === t.key ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:text-white hover:bg-[#0a1f1f]'}`}><t.icon className="w-3.5 h-3.5" />{t.label}</button>)}
        </div>
      </div>

      {error && <div className="mx-4 mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}<button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button></div>}

      <div className="flex-1 p-4">
        {/* CLINICAL CHAT */}
        {tab === 'chat' && (
          <div className="flex flex-col h-[calc(100vh-200px)]">
            <div className="bg-[#061818] border border-[#1a3d3d]/30 rounded-t-lg p-2 text-[10px] text-amber-400 flex items-center gap-1"><Shield className="w-3 h-3" />AI responses are for clinical decision support only. Always verify with clinical guidelines.</div>
            <div ref={chatRef} className="flex-1 overflow-y-auto bg-[#0a1f1f] border-x border-[#1a3d3d]/50 p-3 space-y-3">
              {messages.length === 0 && <div className="text-center py-12"><Brain className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400 text-sm">Ask a clinical question</p><p className="text-gray-600 text-xs mt-1">Drug interactions, differential diagnosis, treatment guidelines</p></div>}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-emerald-600/20 text-emerald-100' : 'bg-[#061818] text-gray-300'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {generating && <div className="flex justify-start"><div className="bg-[#061818] p-3 rounded-lg"><div className="flex gap-1"><div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" /><div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay:'0.15s'}} /><div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay:'0.3s'}} /></div></div></div>}
            </div>
            <div className="flex gap-2 bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-b-lg p-3">
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()} placeholder="Ask a clinical question..." className={`${INP} flex-1`} />
              <button onClick={sendChat} disabled={!input.trim() || generating} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 disabled:opacity-40"><Send className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}

        {/* DRUG CHECKER */}
        {tab === 'drug_check' && (
          <div className="space-y-4 max-w-xl">
            <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Pill className="w-4 h-4 text-purple-400" />Drug Interaction Checker</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] text-gray-400 mb-1">Drug 1</label><input value={drug1} onChange={e => setDrug1(e.target.value)} className={INP} placeholder="e.g. Metformin" /></div>
                <div><label className="block text-[11px] text-gray-400 mb-1">Drug 2</label><input value={drug2} onChange={e => setDrug2(e.target.value)} className={INP} placeholder="e.g. Lisinopril" /></div>
              </div>
              <button onClick={checkDrugs} disabled={!drug1||!drug2||generating} className="w-full py-2 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs hover:bg-purple-600/30 disabled:opacity-40 flex items-center justify-center gap-2">{generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}Check Interactions</button>
            </div>
            {drugResult && <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-4"><h4 className="text-xs font-semibold text-gray-300 mb-2">Results</h4><div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{drugResult}</div></div>}
          </div>
        )}

        {/* DIFFERENTIAL DX */}
        {tab === 'differential' && (
          <div className="space-y-4 max-w-xl">
            <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Stethoscope className="w-4 h-4 text-cyan-400" />Differential Diagnosis Generator</h3>
              <div><label className="block text-[11px] text-gray-400 mb-1">Symptoms & Findings</label><textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} className={`${INP} h-24 resize-none`} placeholder="45yo female, acute onset chest pain, worse with inspiration, recent long flight, tachycardic, SpO2 94%..." /></div>
              <button onClick={generateDiff} disabled={!symptoms||generating} className="w-full py-2 bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs hover:bg-cyan-600/30 disabled:opacity-40 flex items-center justify-center gap-2">{generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}Generate Differential</button>
            </div>
            {diffResult && <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-4"><h4 className="text-xs font-semibold text-gray-300 mb-2">Differential Diagnosis</h4><div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{diffResult}</div></div>}
          </div>
        )}

        {/* CODING ASSIST */}
        {tab === 'coding' && (
          <div className="space-y-4 max-w-xl">
            <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-amber-400" />ICD-10 / CPT Code Suggestion</h3>
              <div><label className="block text-[11px] text-gray-400 mb-1">Clinical Note or Assessment</label><textarea value={noteText} onChange={e => setNoteText(e.target.value)} className={`${INP} h-32 resize-none`} placeholder="Paste clinical note, assessment, or plan here..." /></div>
              <button onClick={suggestCodes} disabled={!noteText||generating} className="w-full py-2 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs hover:bg-amber-600/30 disabled:opacity-40 flex items-center justify-center gap-2">{generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}Suggest Codes</button>
            </div>
            {codingResult && <div className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-4"><h4 className="text-xs font-semibold text-gray-300 mb-2">Suggested Codes</h4><div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{codingResult}</div></div>}
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          history.length === 0 ? <div className="text-center py-16"><Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400 text-sm">No AI interactions yet</p></div> :
          <div className="space-y-2">{history.map(h => (
            <div key={h.id} className="bg-[#0a1f1f] border border-[#1a3d3d]/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${h.category === 'drug_interaction' ? 'bg-purple-600/20 text-purple-400' : h.category === 'differential_dx' ? 'bg-cyan-600/20 text-cyan-400' : h.category === 'medical_coding' ? 'bg-amber-600/20 text-amber-400' : 'bg-blue-600/20 text-blue-400'}`}>{h.category.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] text-gray-500">{new Date(h.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => rateInteraction(h.id, true)} className={`p-1 rounded ${h.was_helpful === true ? 'text-green-400' : 'text-gray-600 hover:text-green-400'}`}><ThumbsUp className="w-3 h-3" /></button>
                  <button onClick={() => rateInteraction(h.id, false)} className={`p-1 rounded ${h.was_helpful === false ? 'text-red-400' : 'text-gray-600 hover:text-red-400'}`}><ThumbsDown className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="text-[11px] text-gray-400 truncate">Q: {h.prompt}</div>
              <div className="text-[11px] text-gray-300 mt-1 line-clamp-2">{h.response}</div>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  )
}
