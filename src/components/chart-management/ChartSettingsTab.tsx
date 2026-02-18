'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Palette, FileText, Building2, Save, RefreshCw, Upload, Eye, Check, X, Lock, Unlock, FileSignature, Clock, CheckCircle, Pen, AlertTriangle, History, ChevronDown } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// ChartSettingsTab — Doctor customizes chart status colors,
// PDF letterhead, practice info. Sub-tab of Chart Management.
//
// GTR-STYLE ENHANCED: Per-status cards with color bar, locked/unlocked
// preview, View Clinical Note button, status dropdown, hex display,
// appointment status history popup, and live preview badges.
// ═══════════════════════════════════════════════════════════════

interface ChartSettingsData {
  id?: string
  status_colors: Record<string, string>
  pdf_logo_url: string | null
  practice_name: string
  practice_address: string
  practice_city: string
  practice_state: string
  practice_zip: string
  practice_phone: string
  practice_fax: string
  practice_email: string
  practice_npi: string
  practice_license: string
  practice_website: string
  auto_lock_after_sign: boolean
  auto_generate_pdf_on_sign: boolean
  require_cosign: boolean
  overdue_threshold_hours: number
}

const DEFAULT_COLORS: Record<string, string> = {
  draft: '#6b7280',
  preliminary: '#f59e0b',
  signed: '#22c55e',
  closed: '#3b82f6',
  amended: '#a855f7',
  needs_review: '#f97316',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  preliminary: 'Preliminary',
  signed: 'Signed',
  closed: 'Closed',
  amended: 'Amended',
  needs_review: 'Needs Review',
}

// ─── STATUS ICON MAP (matches GTR reference) ──────────────────
const STATUS_ICONS: Record<string, { icon: typeof Lock; locked: boolean; goldIcon: boolean; description: string }> = {
  draft:        { icon: Unlock,        locked: false, goldIcon: false, description: 'Unlocked — Editable' },
  preliminary:  { icon: Clock,         locked: false, goldIcon: false, description: 'Pending review' },
  signed:       { icon: CheckCircle,   locked: false, goldIcon: true,  description: 'Signed — Complete' },
  closed:       { icon: Lock,          locked: true,  goldIcon: true,  description: 'Locked — Read only' },
  amended:      { icon: Pen,           locked: true,  goldIcon: true,  description: 'Amended — Locked' },
  needs_review: { icon: AlertTriangle, locked: false, goldIcon: false, description: 'Needs review' },
}

const EMPTY_SETTINGS: ChartSettingsData = {
  status_colors: { ...DEFAULT_COLORS },
  pdf_logo_url: null,
  practice_name: 'Medazon Health',
  practice_address: '',
  practice_city: '',
  practice_state: 'FL',
  practice_zip: '',
  practice_phone: '',
  practice_fax: '',
  practice_email: '',
  practice_npi: '',
  practice_license: '',
  practice_website: '',
  auto_lock_after_sign: false,
  auto_generate_pdf_on_sign: true,
  require_cosign: false,
  overdue_threshold_hours: 48,
}

export default function ChartSettingsTab({ doctorId }: { doctorId: string | null }) {
  const [settings, setSettings] = useState<ChartSettingsData>(EMPTY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<'colors' | 'practice' | 'behavior'>('colors')
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null)
  const [hexInputs, setHexInputs] = useState<Record<string, string>>({})

  const fetchSettings = useCallback(async () => {
    if (!doctorId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/patient-data/chart-settings?doctor_id=${doctorId}`)
      const json = await res.json()
      if (res.ok && json.data) {
        setSettings({
          ...EMPTY_SETTINGS,
          ...json.data,
          status_colors: { ...DEFAULT_COLORS, ...(json.data.status_colors || {}) },
        })
      }
    } catch (err: any) {
      console.error('[chart-settings] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [doctorId])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    if (!doctorId) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/patient-data/chart-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor_id: doctorId, ...settings }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Failed to save')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const updateColor = (status: string, color: string) => {
    setSettings(prev => ({
      ...prev,
      status_colors: { ...prev.status_colors, [status]: color },
    }))
    setHexInputs(prev => ({ ...prev, [status]: color }))
  }

  const handleHexInput = (status: string, val: string) => {
    setHexInputs(prev => ({ ...prev, [status]: val }))
    // Valid hex pattern — apply immediately
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setSettings(prev => ({
        ...prev,
        status_colors: { ...prev.status_colors, [status]: val },
      }))
    }
  }

  const resetColors = () => {
    setSettings(prev => ({ ...prev, status_colors: { ...DEFAULT_COLORS } }))
    setHexInputs({})
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // For now, convert to data URL. In production, upload to Supabase Storage.
    const reader = new FileReader()
    reader.onload = () => {
      setSettings(prev => ({ ...prev, pdf_logo_url: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Section Tabs */}
      <div className="flex space-x-1 bg-[#0a1f1f] rounded-lg p-1 border border-[#1a3d3d]">
        {([
          { key: 'colors' as const, label: 'Status Colors', icon: Palette },
          { key: 'practice' as const, label: 'Practice & PDF', icon: Building2 },
          { key: 'behavior' as const, label: 'Chart Behavior', icon: Settings },
        ]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setSection(key)}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-xs font-bold transition-all ${section === key ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            <Icon className="w-3.5 h-3.5" /><span>{label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* STATUS COLORS — GTR-STYLE ENHANCED CARDS                   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {section === 'colors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Customize the color for each chart status. These colors appear on badges, cards, and filters throughout the system.</p>
            <button onClick={resetColors} className="text-[10px] text-gray-500 hover:text-white transition-colors flex items-center space-x-1">
              <RefreshCw className="w-3 h-3" /><span>Reset to Defaults</span>
            </button>
          </div>

          {/* ── Per-Status GTR Cards ── */}
          <div className="space-y-3">
            {Object.entries(STATUS_LABELS).map(([status, label]) => {
              const color = settings.status_colors[status] || DEFAULT_COLORS[status]
              const statusMeta = STATUS_ICONS[status] || STATUS_ICONS.draft
              const StatusIcon = statusMeta.icon
              const isExpanded = expandedStatus === status
              const isLocked = statusMeta.locked
              const hexVal = hexInputs[status] || color

              return (
                <div key={status} className="rounded-xl overflow-hidden border border-[#1a3d3d] bg-[#0a1f1f] transition-all"
                  style={{ borderLeftWidth: '5px', borderLeftColor: color }}>

                  {/* ── Card Header Row ── */}
                  <div className="p-3.5 flex items-center gap-3">
                    {/* Color Swatch + Picker */}
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-xl border-2 shadow-lg transition-all cursor-pointer relative overflow-hidden group"
                        style={{ backgroundColor: color + '30', borderColor: color, boxShadow: `0 0 12px ${color}25` }}>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <StatusIcon className="w-5 h-5 transition-all" style={{ color: statusMeta.goldIcon ? '#fbbf24' : color, filter: statusMeta.goldIcon ? 'drop-shadow(0 0 4px #fbbf2480)' : `drop-shadow(0 0 4px ${color}60)` }} />
                        </div>
                        <input type="color" value={color}
                          onChange={e => updateColor(status, e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Pick color" />
                      </div>
                    </div>

                    {/* Status Label + Description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-white">{label}</p>
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            <Lock className="w-2.5 h-2.5" style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 2px #fbbf2480)' }} />LOCKED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-500/10 text-gray-500 border border-gray-500/15">
                            <Unlock className="w-2.5 h-2.5" />UNLOCKED
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{statusMeta.description}</p>
                    </div>

                    {/* Hex Value Display */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center bg-[#0d2626] border border-[#1a3d3d] rounded-lg overflow-hidden">
                        <div className="w-6 h-6 flex-shrink-0" style={{ backgroundColor: color }} />
                        <input
                          value={hexVal}
                          onChange={e => handleHexInput(status, e.target.value)}
                          className="w-[72px] bg-transparent px-2 py-1 text-[11px] font-mono font-bold text-gray-300 outline-none"
                          placeholder="#000000"
                          maxLength={7}
                        />
                      </div>
                      <button onClick={() => setExpandedStatus(isExpanded ? null : status)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'bg-teal-500/20 text-teal-400' : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10'}`}>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* ── Expanded Preview (GTR-style) ── */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 space-y-3 border-t border-[#1a3d3d]/50">
                      {/* ── View Clinical Note Button Preview ── */}
                      <div className="pt-3">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Button Preview</p>
                        <button className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-black transition-all shadow-lg"
                          style={{
                            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                            boxShadow: `0 4px 14px ${color}30`,
                          }}>
                          {isLocked ? (
                            <Lock className="w-4.5 h-4.5" style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 3px #fbbf2480)' }} />
                          ) : (
                            <FileSignature className="w-4.5 h-4.5" />
                          )}
                          <span>{isLocked ? '🔒 View Clinical Note' : '✎ View Clinical Note'}</span>
                        </button>
                      </div>

                      {/* ── Calendar Chip Preview ── */}
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Calendar Chip Preview</p>
                        <div className="rounded-lg p-2.5 flex items-center gap-3 relative"
                          style={{ backgroundColor: color + '15', borderLeft: `4px solid ${color}` }}>
                          {/* Gold lock/check icon — top right */}
                          <span className="absolute top-1.5 right-2 text-sm" style={{ filter: statusMeta.goldIcon ? 'drop-shadow(0 0 4px #fbbf2480)' : 'none' }}>
                            {status === 'signed' ? '✅' : status === 'closed' ? '🔒' : status === 'amended' ? '🔒✎' : status === 'preliminary' ? '⏳' : '🔓'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white">Sample Patient</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.5 text-[8px] font-black rounded uppercase" style={{ backgroundColor: color + '25', color: color }}>VIDEO</span>
                              <span className="text-[9px] text-gray-400">9:00 AM</span>
                            </div>
                            <p className="text-[9px] text-gray-500 mt-0.5">Chief complaint example</p>
                          </div>
                        </div>
                      </div>

                      {/* ── Status History Preview ── */}
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Status History Preview</p>
                        <div className="bg-[#0d2626] rounded-lg p-3 border border-[#1a3d3d]/50 space-y-2">
                          <div className="flex items-center gap-2">
                            <History className="w-3.5 h-3.5" style={{ color }} />
                            <div>
                              <p className="text-xs font-bold text-white">{label}</p>
                              <p className="text-[10px] text-gray-500">{new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ── Quick Color Presets ── */}
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Quick Colors</p>
                        <div className="flex flex-wrap gap-1.5">
                          {['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#6b7280'].map(c => (
                            <button key={c} onClick={() => updateColor(status, c)}
                              className={`w-6 h-6 rounded-md border-2 transition-all hover:scale-110 ${color === c ? 'border-white shadow-lg scale-110' : 'border-transparent'}`}
                              style={{ backgroundColor: c }} title={c} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Live Badge Preview ── */}
          <div className="bg-[#0a1f1f] rounded-xl p-4 border border-[#1a3d3d]">
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-3">Live Badge Preview</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).map(([status, label]) => {
                const color = settings.status_colors[status]
                const meta = STATUS_ICONS[status] || STATUS_ICONS.draft
                const Icon = meta.icon
                return (
                  <span key={status} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border transition-all hover:scale-105"
                    style={{ color, backgroundColor: color + '18', borderColor: color + '40' }}>
                    <Icon className="w-3 h-3" style={{ color: meta.goldIcon ? '#fbbf24' : color }} />
                    {label}
                    {meta.locked && <Lock className="w-2.5 h-2.5 ml-0.5" style={{ color: '#fbbf24' }} />}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Practice & PDF Settings */}
      {section === 'practice' && (
        <div className="space-y-4">
          {/* Logo Upload */}
          <div className="bg-[#0a1f1f] rounded-lg p-4 border border-[#1a3d3d] space-y-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Practice Logo</p>
            <div className="flex items-center space-x-4">
              {settings.pdf_logo_url ? (
                <div className="relative">
                  <img src={settings.pdf_logo_url} alt="Logo" className="w-20 h-20 object-contain rounded-lg bg-white p-1" />
                  <button onClick={() => setSettings(prev => ({ ...prev, pdf_logo_url: null }))}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 bg-[#0d2626] rounded-lg border-2 border-dashed border-[#1a3d3d] flex items-center justify-center">
                  <Upload className="w-5 h-5 text-gray-500" />
                </div>
              )}
              <div>
                <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-teal-600/20 text-teal-400 text-xs font-bold hover:bg-teal-600/30 transition-colors">
                  Upload Logo
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                <p className="text-[10px] text-gray-500 mt-1">PNG or JPG, max 500KB. Appears on generated PDFs.</p>
              </div>
            </div>
          </div>

          {/* Practice Info Grid */}
          <div className="bg-[#0a1f1f] rounded-lg p-4 border border-[#1a3d3d] space-y-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Practice Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: 'practice_name', label: 'Practice Name', full: true },
                { key: 'practice_address', label: 'Street Address', full: true },
                { key: 'practice_city', label: 'City' },
                { key: 'practice_state', label: 'State' },
                { key: 'practice_zip', label: 'ZIP Code' },
                { key: 'practice_phone', label: 'Phone' },
                { key: 'practice_fax', label: 'Fax' },
                { key: 'practice_email', label: 'Email' },
                { key: 'practice_npi', label: 'NPI Number' },
                { key: 'practice_license', label: 'License #' },
                { key: 'practice_website', label: 'Website', full: true },
              ] as { key: keyof ChartSettingsData; label: string; full?: boolean }[]).map(({ key, label, full }) => (
                <div key={key} className={full ? 'sm:col-span-2' : ''}>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">{label}</label>
                  <input value={String(settings[key] || '')}
                    onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 outline-none"
                    placeholder={label} />
                </div>
              ))}
            </div>
          </div>

          {/* PDF Preview */}
          <button className="w-full bg-[#0a1f1f] rounded-lg p-3 border border-[#1a3d3d] hover:border-teal-500/30 transition-colors flex items-center justify-center space-x-2 text-sm text-gray-400 hover:text-teal-400">
            <Eye className="w-4 h-4" /><span>Preview PDF Letterhead</span>
          </button>
        </div>
      )}

      {/* Chart Behavior */}
      {section === 'behavior' && (
        <div className="space-y-3">
          {([
            { key: 'auto_lock_after_sign' as const, label: 'Auto-lock chart after signing', desc: 'Automatically close/lock the chart immediately after the doctor signs it' },
            { key: 'auto_generate_pdf_on_sign' as const, label: 'Auto-generate PDF on sign', desc: 'Generate the clinical note PDF automatically when a chart is signed' },
            { key: 'require_cosign' as const, label: 'Require co-signature', desc: 'All charts require a supervising provider co-signature before closing' },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="bg-[#0a1f1f] rounded-lg p-4 border border-[#1a3d3d] flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{label}</p>
                <p className="text-[10px] text-gray-500">{desc}</p>
              </div>
              <button onClick={() => setSettings(prev => ({ ...prev, [key]: !prev[key] }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${settings[key] ? 'bg-teal-600' : 'bg-gray-600'}`}>
                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${settings[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
          <div className="bg-[#0a1f1f] rounded-lg p-4 border border-[#1a3d3d]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-bold text-white">Overdue Threshold</p>
                <p className="text-[10px] text-gray-500">Mark unsigned charts as overdue after this many hours</p>
              </div>
              <div className="flex items-center space-x-2">
                <input type="number" min={1} max={168} value={settings.overdue_threshold_hours}
                  onChange={e => setSettings(prev => ({ ...prev, overdue_threshold_hours: parseInt(e.target.value) || 48 }))}
                  className="w-16 bg-[#0d2626] border border-[#1a3d3d] rounded-lg px-2 py-1 text-sm text-white text-center outline-none focus:border-teal-500/50" />
                <span className="text-xs text-gray-500">hours</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2">
        {error && <p className="text-xs text-red-400">{error}</p>}
        {saved && <p className="text-xs text-green-400 flex items-center space-x-1"><Check className="w-3 h-3" /><span>Saved successfully</span></p>}
        {!error && !saved && <div />}
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center space-x-2">
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>
    </div>
  )
}
