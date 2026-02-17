// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'
import { useState, useEffect } from 'react'
import { ClipboardList, Search, RefreshCw, Shield, Eye, Edit, Trash2, LogIn, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const ACTION_COLORS: Record<string, string> = { login: 'text-green-400', view: 'text-blue-400', create: 'text-teal-400', update: 'text-amber-400', delete: 'text-red-400', export: 'text-purple-400' }

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetch = async () => {
      // Try audit_logs first, fallback to hipaa_access_log
      let { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500)
      if (!data || data.length === 0) {
        const r = await supabase.from('hipaa_access_log').select('*').order('accessed_at', { ascending: false }).limit(500)
        data = (r.data || []).map((l: any) => ({ ...l, created_at: l.accessed_at, action: l.action_type || 'view', user_email: l.user_email || l.doctor_email, resource: l.resource_type || l.table_name, details: l.details || l.description }))
      }
      setLogs(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  const filtered = search ? logs.filter(l => JSON.stringify(l).toLowerCase().includes(search.toLowerCase())) : logs

  return (
    <div className="p-6 text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><ClipboardList className="w-6 h-6 text-teal-400" /><h1 className="text-xl font-bold">Audit Log</h1><span className="text-xs text-gray-500">HIPAA Compliance</span></div>
        <button onClick={() => window.location.reload()} className="p-2 hover:bg-[#1a3d3d] rounded-lg"><RefreshCw className="w-4 h-4 text-gray-400" /></button>
      </div>
      <div className="mb-4 relative"><Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs..." className="w-full pl-10 pr-3 py-2 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg text-sm text-white" /></div>
      {loading ? <div className="text-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-teal-400 mx-auto" /></div> : (
        <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#1a3d3d] text-gray-500 text-xs"><th className="px-4 py-3 text-left">Timestamp</th><th className="px-4 py-3 text-left">User</th><th className="px-4 py-3 text-left">Action</th><th className="px-4 py-3 text-left">Resource</th><th className="px-4 py-3 text-left">Details</th></tr></thead>
            <tbody>{filtered.slice(0, 100).map((l, i) => (
              <tr key={l.id || i} className="border-b border-[#1a3d3d]/30 hover:bg-[#0c2828]">
                <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{l.created_at ? new Date(l.created_at).toLocaleString() : '—'}</td>
                <td className="px-4 py-2.5 text-xs">{l.user_email || l.doctor_id?.slice(0, 8) || '—'}</td>
                <td className="px-4 py-2.5"><span className={`text-xs font-bold ${ACTION_COLORS[l.action] || 'text-gray-400'}`}>{l.action || '—'}</span></td>
                <td className="px-4 py-2.5 text-xs text-gray-400">{l.resource || l.table_name || '—'}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[300px] truncate">{typeof l.details === 'object' ? JSON.stringify(l.details).slice(0, 80) : (l.details || '—')}</td>
              </tr>
            ))}</tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-10 text-gray-500 text-sm">No audit logs found</div>}
          {filtered.length > 100 && <div className="text-center py-3 text-xs text-gray-500">Showing 100 of {filtered.length}</div>}
        </div>
      )}
    </div>
  )
}
