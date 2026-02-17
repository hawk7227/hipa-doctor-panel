// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — CALENDAR DELIGHTFUL EXTRAS
// Confetti, sounds, welcome popup
// Rule 17: Disabled by default, toggled via settings, isolated module
// ═══════════════════════════════════════════════════════════════

'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Sparkles, X, Volume2, VolumeX, PartyPopper } from 'lucide-react'

// ─── STORAGE KEY ─────────────────────────────────────────────
const EXTRAS_KEY = 'medazon-delightful-extras'

// ─── TYPES ───────────────────────────────────────────────────
interface ExtrasState {
  enabled: boolean
  confetti: boolean
  sounds: boolean
  welcomePopup: boolean
}

const DEFAULT_STATE: ExtrasState = {
  enabled: false,
  confetti: false,
  sounds: false,
  welcomePopup: false,
}

function loadExtrasState(): ExtrasState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(EXTRAS_KEY)
    if (!raw) return DEFAULT_STATE
    return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch { return DEFAULT_STATE }
}

function saveExtrasState(state: ExtrasState) {
  if (typeof window === 'undefined') return
  localStorage.setItem(EXTRAS_KEY, JSON.stringify(state))
}

// ─── CONFETTI PARTICLE ───────────────────────────────────────
interface Particle {
  id: number
  x: number
  y: number
  color: string
  size: number
  rotation: number
  velocityX: number
  velocityY: number
  opacity: number
}

const CONFETTI_COLORS = ['#5eead4', '#f472b6', '#60a5fa', '#fbbf24', '#a78bfa', '#34d399', '#fb923c', '#f87171']

function createParticle(id: number): Particle {
  return {
    id,
    x: Math.random() * 100,
    y: -10 - Math.random() * 20,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 4 + Math.random() * 6,
    rotation: Math.random() * 360,
    velocityX: (Math.random() - 0.5) * 2,
    velocityY: 1 + Math.random() * 2,
    opacity: 1,
  }
}

// ─── HOOKS ───────────────────────────────────────────────────

export function useExtras() {
  const [state, setState] = useState<ExtrasState>(DEFAULT_STATE)

  useEffect(() => {
    setState(loadExtrasState())
  }, [])

  const toggle = useCallback((key: keyof ExtrasState) => {
    setState(prev => {
      const next = { ...prev, [key]: !prev[key] }
      // If toggling main switch off, disable all
      if (key === 'enabled' && !next.enabled) {
        next.confetti = false
        next.sounds = false
        next.welcomePopup = false
      }
      // If toggling a sub-feature on, enable main switch
      if (key !== 'enabled' && next[key]) {
        next.enabled = true
      }
      saveExtrasState(next)
      return next
    })
  }, [])

  const enableAll = useCallback(() => {
    const next: ExtrasState = { enabled: true, confetti: true, sounds: true, welcomePopup: true }
    saveExtrasState(next)
    setState(next)
  }, [])

  const disableAll = useCallback(() => {
    saveExtrasState(DEFAULT_STATE)
    setState(DEFAULT_STATE)
  }, [])

  return { state, toggle, enableAll, disableAll }
}

// ─── EXTRAS TOGGLE BUTTON ────────────────────────────────────
// Small button in the calendar toolbar
export function ExtrasToggleButton({ extras }: { extras: ReturnType<typeof useExtras> }) {
  const [showPanel, setShowPanel] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`p-2 rounded-lg border transition-colors ${
          extras.state.enabled
            ? 'bg-purple-500/15 border-purple-500/30 text-purple-400 hover:bg-purple-500/25'
            : 'bg-[#0a1f1f] border-[#1a3d3d] text-gray-400 hover:border-purple-500/30 hover:text-purple-400'
        }`}
        title="Delightful Extras"
        aria-label="Toggle delightful extras"
      >
        <Sparkles className="w-4 h-4" />
      </button>

      {/* Dropdown panel */}
      {showPanel && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPanel(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl z-50 overflow-hidden animate-[fadeIn_0.15s_ease-out]">
            <div className="px-4 py-3 border-b border-[#1a3d3d] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-white">Delightful Extras</span>
              </div>
              <button onClick={() => setShowPanel(false)} className="p-1 rounded hover:bg-white/10 text-gray-400">
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="p-3 space-y-2">
              {/* Master toggle */}
              <ToggleRow
                label="Enable All"
                icon={<Sparkles className="w-3.5 h-3.5" />}
                enabled={extras.state.enabled}
                onToggle={() => extras.state.enabled ? extras.disableAll() : extras.enableAll()}
                color="purple"
              />

              <div className="border-t border-[#1a3d3d] my-1" />

              {/* Individual toggles */}
              <ToggleRow
                label="Confetti"
                icon={<PartyPopper className="w-3.5 h-3.5" />}
                enabled={extras.state.confetti}
                onToggle={() => extras.toggle('confetti')}
                color="pink"
                disabled={!extras.state.enabled && !extras.state.confetti}
              />
              <ToggleRow
                label="Sound Effects"
                icon={extras.state.sounds ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                enabled={extras.state.sounds}
                onToggle={() => extras.toggle('sounds')}
                color="blue"
                disabled={!extras.state.enabled && !extras.state.sounds}
              />
              <ToggleRow
                label="Welcome Popup"
                icon={<span className="text-xs">👋</span>}
                enabled={extras.state.welcomePopup}
                onToggle={() => extras.toggle('welcomePopup')}
                color="amber"
                disabled={!extras.state.enabled && !extras.state.welcomePopup}
              />
            </div>

            <div className="px-4 py-2 bg-[#0a1f1f] border-t border-[#1a3d3d]">
              <p className="text-[10px] text-gray-500">Extras are just for fun and don&apos;t affect functionality.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── TOGGLE ROW ──────────────────────────────────────────────
function ToggleRow({ label, icon, enabled, onToggle, color, disabled }: {
  label: string
  icon: React.ReactNode
  enabled: boolean
  onToggle: () => void
  color: 'purple' | 'pink' | 'blue' | 'amber'
  disabled?: boolean
}) {
  const colors = {
    purple: { bg: 'bg-purple-500', ring: 'ring-purple-500/30' },
    pink: { bg: 'bg-pink-500', ring: 'ring-pink-500/30' },
    blue: { bg: 'bg-blue-500', ring: 'ring-blue-500/30' },
    amber: { bg: 'bg-amber-500', ring: 'ring-amber-500/30' },
  }

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer'}`}
    >
      <div className="flex items-center space-x-2">
        <span className={enabled ? `text-${color}-400` : 'text-gray-500'}>{icon}</span>
        <span className={`text-xs font-medium ${enabled ? 'text-white' : 'text-gray-400'}`}>{label}</span>
      </div>
      {/* Toggle switch */}
      <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${enabled ? colors[color].bg : 'bg-gray-600'}`}>
        <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform shadow-sm ${enabled ? 'translate-x-3.5' : 'translate-x-0'}`} />
      </div>
    </button>
  )
}

// ─── CONFETTI OVERLAY ────────────────────────────────────────
export function ConfettiOverlay({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([])
  const frameRef = useRef<number | null>(null)
  const counterRef = useRef(0)

  useEffect(() => {
    if (!active) {
      setParticles([])
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      return
    }

    // Spawn particles
    const spawnInterval = setInterval(() => {
      setParticles(prev => {
        if (prev.length > 40) return prev
        const newParticles = Array.from({ length: 3 }, () => createParticle(counterRef.current++))
        return [...prev, ...newParticles]
      })
    }, 200)

    // Animate
    const animate = () => {
      setParticles(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + p.velocityX * 0.3,
            y: p.y + p.velocityY * 0.5,
            rotation: p.rotation + 2,
            opacity: p.y > 80 ? Math.max(0, p.opacity - 0.02) : p.opacity,
          }))
          .filter(p => p.y < 110 && p.opacity > 0)
      )
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)

    return () => {
      clearInterval(spawnInterval)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [active])

  if (!active || particles.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  )
}

// ─── WELCOME POPUP ───────────────────────────────────────────
export function WelcomePopup({ show, doctorName, onDismiss }: { show: boolean; doctorName: string; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (show) {
      const t = setTimeout(() => setVisible(true), 300)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
    }
  }, [show])

  if (!show) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative bg-gradient-to-br from-[#0d2626] via-[#0a2f2f] to-[#0d2626] border border-teal-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-teal-500/10 animate-[fadeIn_0.3s_ease-out]">
        {/* Close */}
        <button onClick={onDismiss} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="text-center space-y-4">
          <div className="text-5xl">👋</div>
          <h2 className="text-2xl font-bold text-white">
            Welcome back{doctorName ? `, ${doctorName}` : ''}!
          </h2>
          <p className="text-gray-300 text-sm">Ready for another great day of patient care.</p>

          {/* Quick stats placeholder */}
          <div className="flex items-center justify-center space-x-6 pt-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-teal-400">0</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Today</p>
            </div>
            <div className="w-px h-8 bg-[#1a3d3d]" />
            <div className="text-center">
              <p className="text-2xl font-bold text-pink-400">0</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Pending</p>
            </div>
            <div className="w-px h-8 bg-[#1a3d3d]" />
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">0</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Urgent</p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] px-6 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-teal-500/20 mt-2"
          >
            Let&apos;s Go
          </button>
        </div>
      </div>
    </div>
  )
}
