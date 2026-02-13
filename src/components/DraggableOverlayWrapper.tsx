'use client'

import React, { useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { Lock, Unlock, Palette, Minimize2, Maximize2, X, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════
// THEME CONFIG (unchanged)
// ═══════════════════════════════════════════════════════════════
type OverlayThemeName = 'purple' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'blue' | 'slate' | 'teal'
const OVERLAY_THEMES: Record<OverlayThemeName, { gradient: string; border: string; dot: string }> = {
  purple:  { gradient: 'from-purple-950/95 via-slate-900/95 to-purple-900/90',   border: 'border-purple-500/30',  dot: 'bg-purple-500'  },
  cyan:    { gradient: 'from-cyan-950/95 via-slate-900/95 to-cyan-900/90',       border: 'border-cyan-500/30',    dot: 'bg-cyan-500'    },
  emerald: { gradient: 'from-emerald-950/95 via-slate-900/95 to-emerald-900/90', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  amber:   { gradient: 'from-amber-950/95 via-slate-900/95 to-amber-900/90',     border: 'border-amber-500/30',   dot: 'bg-amber-500'   },
  rose:    { gradient: 'from-rose-950/95 via-slate-900/95 to-rose-900/90',       border: 'border-rose-500/30',    dot: 'bg-rose-500'    },
  blue:    { gradient: 'from-blue-950/95 via-slate-900/95 to-blue-900/90',       border: 'border-blue-500/30',    dot: 'bg-blue-500'    },
  slate:   { gradient: 'from-slate-800/95 via-slate-900/95 to-slate-800/90',     border: 'border-white/20',       dot: 'bg-slate-500'   },
  teal:    { gradient: 'from-teal-950/95 via-slate-900/95 to-teal-900/90',       border: 'border-teal-500/30',    dot: 'bg-teal-500'    },
}
const THEME_KEYS = Object.keys(OVERLAY_THEMES) as OverlayThemeName[]

// ═══════════════════════════════════════════════════════════════
// PREFS TYPE
// ═══════════════════════════════════════════════════════════════
interface OverlayPanelPrefs {
  width: number
  height: number
  locked: boolean
  theme: OverlayThemeName
  posX: number
  posY: number
  minimized: boolean
}

// ═══════════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════════
interface DraggableOverlayWrapperProps {
  panelId: string
  isOpen: boolean
  onClose: () => void
  title: string
  icon?: ReactNode
  defaultTheme?: OverlayThemeName
  defaultWidth?: number
  defaultHeight?: number
  defaultPosition?: { x: number; y: number }
  children: ReactNode
  subtitle?: string
  headerActions?: ReactNode
  zIndex?: number
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const DEFAULT_WIDTH = 600
const DEFAULT_HEIGHT = 500
const MIN_WIDTH = 320
const MIN_HEIGHT = 200
const MAX_WIDTH_RATIO = 0.95
const MAX_HEIGHT_RATIO = 0.95

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function DraggableOverlayWrapper({
  panelId,
  isOpen,
  onClose,
  title,
  icon,
  defaultTheme = 'purple',
  defaultWidth = DEFAULT_WIDTH,
  defaultHeight = DEFAULT_HEIGHT,
  defaultPosition,
  children,
  subtitle,
  headerActions,
  zIndex = 60,
}: DraggableOverlayWrapperProps) {
  const defPosX = defaultPosition?.x ?? 80
  const defPosY = defaultPosition?.y ?? 50

  const [theme, setTheme] = useState<OverlayThemeName>(defaultTheme)
  const [panelWidth, setPanelWidth] = useState(defaultWidth)
  const [panelHeight, setPanelHeight] = useState(defaultHeight)
  const [position, setPosition] = useState({ x: defPosX, y: defPosY })
  const [sizeLocked, setSizeLocked] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  const prefsRef = useRef<OverlayPanelPrefs>({
    width: defaultWidth, height: defaultHeight, locked: false, theme: defaultTheme,
    posX: defPosX, posY: defPosY, minimized: false,
  })
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number; edge: string } | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentTheme = OVERLAY_THEMES[theme]

  // ─── Load prefs from Supabase ───
  useEffect(() => {
    if (!isOpen || prefsLoaded) return
    let cancelled = false
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data } = await supabase
          .from('doctor_preferences')
          .select('preference_value')
          .eq('doctor_id', user.id)
          .eq('preference_key', `overlay_${panelId}`)
          .single()
        if (data?.preference_value && !cancelled) {
          const p = data.preference_value as unknown as OverlayPanelPrefs
          setPanelWidth(p.width || defaultWidth)
          setPanelHeight(p.height || defaultHeight)
          setSizeLocked(p.locked || false)
          setTheme(p.theme || defaultTheme)
          setPosition({ x: p.posX ?? defPosX, y: p.posY ?? defPosY })
          setMinimized(p.minimized || false)
          prefsRef.current = p
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setPrefsLoaded(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isOpen, prefsLoaded, panelId, defaultWidth, defaultHeight, defaultTheme, defPosX, defPosY])

  // ─── Save prefs (debounced) ───
  const savePrefs = useCallback((updates: Partial<OverlayPanelPrefs>) => {
    prefsRef.current = { ...prefsRef.current, ...updates }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('doctor_preferences').upsert({
          doctor_id: user.id,
          preference_key: `overlay_${panelId}`,
          preference_value: prefsRef.current,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'doctor_id,preference_key' })
      } catch {
        // silent
      }
    }, 500)
  }, [panelId])

  // ─── Drag handlers ───
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return
    e.preventDefault()
    const currentPos = { ...position }
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: currentPos.x, startPosY: currentPos.y }
    const handleMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return
      const newX = Math.max(0, dragRef.current.startPosX + (moveEvent.clientX - dragRef.current.startX))
      const newY = Math.max(0, dragRef.current.startPosY + (moveEvent.clientY - dragRef.current.startY))
      setPosition({ x: newX, y: newY })
    }
    const handleUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [position])

  // Save position on change (debounced)
  const positionRef = useRef(position)
  positionRef.current = position
  useEffect(() => {
    if (!prefsLoaded) return
    const timer = setTimeout(() => {
      savePrefs({ posX: positionRef.current.x, posY: positionRef.current.y })
    }, 300)
    return () => clearTimeout(timer)
  }, [position.x, position.y, prefsLoaded, savePrefs])

  // ─── Resize handlers (all edges + corners) ───
  const handleResizeStart = useCallback((e: React.MouseEvent, edge: string) => {
    if (sizeLocked) return
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startWidth: panelWidth, startHeight: panelHeight, edge }
    const maxW = window.innerWidth * MAX_WIDTH_RATIO
    const maxH = window.innerHeight * MAX_HEIGHT_RATIO
    const handleMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return
      const dx = moveEvent.clientX - resizeRef.current.startX
      const dy = moveEvent.clientY - resizeRef.current.startY
      const e = resizeRef.current.edge
      if (e.includes('r')) setPanelWidth(Math.min(maxW, Math.max(MIN_WIDTH, resizeRef.current.startWidth + dx)))
      if (e.includes('b')) setPanelHeight(Math.min(maxH, Math.max(MIN_HEIGHT, resizeRef.current.startHeight + dy)))
      if (e.includes('l')) {
        const newW = Math.min(maxW, Math.max(MIN_WIDTH, resizeRef.current.startWidth - dx))
        setPanelWidth(newW)
        setPosition(prev => ({ ...prev, x: Math.max(0, prev.x + (resizeRef.current!.startWidth - newW)) }))
      }
      if (e.includes('t')) {
        const newH = Math.min(maxH, Math.max(MIN_HEIGHT, resizeRef.current.startHeight - dy))
        setPanelHeight(newH)
        setPosition(prev => ({ ...prev, y: Math.max(0, prev.y + (resizeRef.current!.startHeight - newH)) }))
      }
    }
    const handleUp = () => {
      resizeRef.current = null
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    const cursors: Record<string, string> = { r: 'ew-resize', b: 'ns-resize', l: 'ew-resize', t: 'ns-resize', rb: 'nwse-resize', lb: 'nesw-resize', rt: 'nesw-resize', lt: 'nwse-resize' }
    document.body.style.cursor = cursors[edge] || 'nwse-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [sizeLocked, panelWidth, panelHeight])

  // Save size on change (debounced)
  const sizeRef = useRef({ w: panelWidth, h: panelHeight })
  sizeRef.current = { w: panelWidth, h: panelHeight }
  useEffect(() => {
    if (!prefsLoaded) return
    const timer = setTimeout(() => {
      savePrefs({ width: sizeRef.current.w, height: sizeRef.current.h })
    }, 300)
    return () => clearTimeout(timer)
  }, [panelWidth, panelHeight, prefsLoaded, savePrefs])

  // ─── Actions ───
  const handleLockToggle = useCallback(() => {
    setSizeLocked(v => {
      const next = !v
      savePrefs({ locked: next })
      return next
    })
  }, [savePrefs])

  const handleMinimizeToggle = useCallback(() => {
    setMinimized(v => {
      const next = !v
      savePrefs({ minimized: next })
      return next
    })
  }, [savePrefs])

  const handleResetPosition = useCallback(() => {
    setPosition({ x: defPosX, y: defPosY })
    setPanelWidth(defaultWidth)
    setPanelHeight(defaultHeight)
    setMinimized(false)
    savePrefs({ posX: defPosX, posY: defPosY, width: defaultWidth, height: defaultHeight, minimized: false })
  }, [defPosX, defPosY, defaultWidth, defaultHeight, savePrefs])

  const handleThemeChange = useCallback((newTheme: OverlayThemeName) => {
    setTheme(newTheme)
    setShowColorPicker(false)
    savePrefs({ theme: newTheme })
  }, [savePrefs])

  // ─── Render ───
  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      className={`fixed bg-gradient-to-br ${currentTheme.gradient} backdrop-blur-xl border ${currentTheme.border} rounded-2xl shadow-2xl flex flex-col overflow-hidden`}
      style={{
        zIndex,
        left: position.x,
        top: position.y,
        width: panelWidth,
        height: minimized ? 52 : panelHeight,
        transition: minimized ? 'height 0.2s ease' : undefined,
      }}
    >
      {/* ── Resize handles (all 4 edges + 4 corners) ── */}
      {!sizeLocked && !minimized && (<>
        {/* Right edge */}
        <div className="absolute right-0 top-2 bottom-2 w-2 cursor-ew-resize hover:bg-white/10 transition-colors z-10" onMouseDown={e => handleResizeStart(e, 'r')} />
        {/* Bottom edge */}
        <div className="absolute bottom-0 left-2 right-2 h-2 cursor-ns-resize hover:bg-white/10 transition-colors z-10" onMouseDown={e => handleResizeStart(e, 'b')} />
        {/* Left edge */}
        <div className="absolute left-0 top-2 bottom-2 w-2 cursor-ew-resize hover:bg-white/10 transition-colors z-10" onMouseDown={e => handleResizeStart(e, 'l')} />
        {/* Top edge */}
        <div className="absolute top-0 left-2 right-2 h-2 cursor-ns-resize hover:bg-white/10 transition-colors z-10" onMouseDown={e => handleResizeStart(e, 't')} />
        {/* Bottom-right corner */}
        <div className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize z-20" onMouseDown={e => handleResizeStart(e, 'rb')} />
        {/* Bottom-left corner */}
        <div className="absolute left-0 bottom-0 w-4 h-4 cursor-nesw-resize z-20" onMouseDown={e => handleResizeStart(e, 'lb')} />
        {/* Top-right corner */}
        <div className="absolute right-0 top-0 w-4 h-4 cursor-nesw-resize z-20" onMouseDown={e => handleResizeStart(e, 'rt')} />
        {/* Top-left corner */}
        <div className="absolute left-0 top-0 w-4 h-4 cursor-nwse-resize z-20" onMouseDown={e => handleResizeStart(e, 'lt')} />
      </>)}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* HEADER                                                       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
        onMouseDown={handleDragStart}
      >
        {/* Left: icon + title */}
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="text-white/80 flex-shrink-0">{icon}</span>}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{title}</h3>
            {subtitle && <p className="text-[10px] text-white/50 truncate">{subtitle}</p>}
          </div>
        </div>

        {/* Right: header actions + controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {headerActions}

          {/* Color picker */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(v => !v)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
              title="Change theme color"
            >
              <Palette className="w-3.5 h-3.5 text-white/60" />
            </button>
            {showColorPicker && (
              <div className="absolute right-0 top-8 bg-slate-900 border border-white/20 rounded-xl p-2 shadow-xl z-50 flex gap-1.5 flex-wrap w-[130px]">
                {THEME_KEYS.map(t => (
                  <button
                    key={t}
                    onClick={() => handleThemeChange(t)}
                    className={`w-5 h-5 rounded-full ${OVERLAY_THEMES[t].dot} transition-transform hover:scale-125`}
                    style={{
                      outline: t === theme ? '2px solid #fff' : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Lock/unlock size */}
          <button
            onClick={handleLockToggle}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
            title={sizeLocked ? 'Unlock size' : 'Lock size'}
          >
            {sizeLocked
              ? <Lock className="w-3.5 h-3.5 text-white/80" />
              : <Unlock className="w-3.5 h-3.5 text-white/60" />}
          </button>

          {/* Reset position */}
          <button
            onClick={handleResetPosition}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
            title="Reset position & size"
          >
            <RefreshCw className="w-3.5 h-3.5 text-white/60" />
          </button>

          {/* Minimize/maximize */}
          <button
            onClick={handleMinimizeToggle}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized
              ? <Maximize2 className="w-3.5 h-3.5 text-white/80" />
              : <Minimize2 className="w-3.5 h-3.5 text-white/60" />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/40 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-white/80" />
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* CONTENT                                                      */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {!minimized && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      )}
    </div>
  )
}

