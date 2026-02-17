// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState } from 'react'
import {
  HelpCircle, ChevronDown, ChevronRight, Shield, Wrench, Activity,
  BookOpen, Lightbulb, AlertTriangle, CheckCircle, Info, X,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// PAGE GUIDE — Reusable "How It Works" + System Info component
// Drop into any page with a config object. Shows:
//   1. How It Works (tabs/features explained)
//   2. System Wiring (what APIs/tables power this page)
//   3. Known Issues & Fixes
//   4. Quick tips
// ═══════════════════════════════════════════════════════════════

export interface FeatureGuide {
  name: string
  description: string
  steps?: string[]
}

export interface SystemWire {
  label: string
  type: 'api' | 'table' | 'service' | 'cron'
  path: string
}

export interface KnownFix {
  id: string
  title: string
  status: 'fixed' | 'monitoring' | 'known-issue'
}

export interface PageGuideConfig {
  pageTitle: string
  pageDescription: string
  features: FeatureGuide[]
  systemWiring: SystemWire[]
  knownFixes?: KnownFix[]
  tips?: string[]
}

export default function PageGuide({ config }: { config: PageGuideConfig }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'guide' | 'system' | 'fixes'>('guide')

  return (
    <>
      {/* FLOATING TRIGGER BUTTON */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-full shadow-lg shadow-teal-900/40 transition-all hover:scale-105"
      >
        {open ? <X className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
        {open ? 'Close' : 'How It Works'}
      </button>

      {/* SLIDE-OUT PANEL */}
      {open && (
        <div className="fixed bottom-20 right-6 z-40 w-[420px] max-h-[70vh] bg-[#0a1f1f] border border-[#1a3d3d]/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#1a3d3d]/40">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-5 h-5 text-teal-400" />
              <h3 className="text-base font-bold text-white">{config.pageTitle}</h3>
            </div>
            <p className="text-xs text-gray-400">{config.pageDescription}</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#1a3d3d]/30">
            {(['guide', 'system', 'fixes'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 px-3 py-2.5 text-xs font-bold transition-colors ${
                  tab === t ? 'text-teal-400 border-b-2 border-teal-400 bg-teal-600/10' : 'text-gray-500 hover:text-gray-300'
                }`}>
                {t === 'guide' ? '📖 How to Use' : t === 'system' ? '⚙️ System Wiring' : '🔧 Fixes & Issues'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {tab === 'guide' && (
              <>
                {config.features.map((f, i) => (
                  <FeatureCard key={i} feature={f} index={i + 1} />
                ))}
                {config.tips && config.tips.length > 0 && (
                  <div className="bg-amber-900/20 border border-amber-500/20 rounded-xl p-3 mt-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-bold text-amber-400">Pro Tips</span>
                    </div>
                    {config.tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2 mb-1.5 last:mb-0">
                        <span className="text-amber-500 text-[10px] mt-0.5">▸</span>
                        <span className="text-[11px] text-amber-200/80">{tip}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === 'system' && (
              <>
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">What powers this page</div>
                {config.systemWiring.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[#061818] rounded-lg">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      w.type === 'api' ? 'bg-teal-600/20 text-teal-400' :
                      w.type === 'table' ? 'bg-purple-600/20 text-purple-400' :
                      w.type === 'cron' ? 'bg-amber-600/20 text-amber-400' :
                      'bg-blue-600/20 text-blue-400'
                    }`}>{w.type.toUpperCase()}</span>
                    <div>
                      <div className="text-xs text-white font-medium">{w.label}</div>
                      <div className="text-[10px] text-gray-500 font-mono">{w.path}</div>
                    </div>
                  </div>
                ))}
                <a href="/doctor/system-health" className="flex items-center gap-2 px-3 py-2 bg-teal-600/10 border border-teal-500/20 rounded-lg text-xs text-teal-400 hover:bg-teal-600/20 transition-colors mt-2">
                  <Shield className="w-3.5 h-3.5" />
                  Open Full System Health Dashboard →
                </a>
              </>
            )}

            {tab === 'fixes' && (
              <>
                {(!config.knownFixes || config.knownFixes.length === 0) ? (
                  <div className="flex items-center gap-2 px-3 py-4 text-sm text-gray-500">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    No known issues for this page
                  </div>
                ) : (
                  config.knownFixes.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[#061818] rounded-lg">
                      {f.status === 'fixed' ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> :
                       f.status === 'monitoring' ? <Activity className="w-3.5 h-3.5 text-amber-400" /> :
                       <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                      <div>
                        <div className="text-xs text-white font-medium">{f.title}</div>
                        <div className="text-[10px] text-gray-500">{f.id} · {f.status}</div>
                      </div>
                    </div>
                  ))
                )}
                <a href="/doctor/system-health" className="flex items-center gap-2 px-3 py-2 bg-amber-600/10 border border-amber-500/20 rounded-lg text-xs text-amber-400 hover:bg-amber-600/20 transition-colors mt-2">
                  <Wrench className="w-3.5 h-3.5" />
                  Open Auto-Fix Dashboard →
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function FeatureCard({ feature, index }: { feature: FeatureGuide; index: number }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-[#061818] rounded-lg border border-[#1a3d3d]/30 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#0c2828] transition-colors">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-600/30 text-teal-400 text-[10px] font-bold flex-shrink-0">{index}</span>
        <span className="text-xs font-semibold text-white text-left flex-1">{feature.name}</span>
        {feature.steps && (expanded ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />)}
      </button>
      <div className="px-3 pb-2.5">
        <p className="text-[11px] text-gray-400 ml-8">{feature.description}</p>
        {expanded && feature.steps && (
          <div className="ml-8 mt-2 space-y-1.5">
            {feature.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-teal-500 text-[10px] mt-0.5 font-bold">{i + 1}.</span>
                <span className="text-[11px] text-gray-300">{step}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
