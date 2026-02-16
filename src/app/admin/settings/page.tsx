'use client'
import { useState } from 'react'
import { Settings, Shield, Bell, Globe, Lock, Database, Save, CheckCircle } from 'lucide-react'

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState({ siteName: 'Medazon Health', supportEmail: 'support@medazonhealth.com', autoApprove: false, maintenanceMode: false, maxFileSize: 10, sessionTimeout: 60 })
  const update = (k: string, v: any) => setSettings(prev => ({ ...prev, [k]: v }))
  const save = () => { localStorage.setItem('admin_settings', JSON.stringify(settings)); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  const Toggle = ({ val, onChange }: { val: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!val)} className={`w-10 h-5 rounded-full transition-colors flex items-center ${val ? 'bg-teal-600 justify-end' : 'bg-gray-700 justify-start'}`}><div className="w-4 h-4 bg-white rounded-full mx-0.5" /></button>
  )

  return (
    <div className="p-6 text-white max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><Settings className="w-6 h-6 text-teal-400" /><h1 className="text-xl font-bold">Admin Settings</h1></div>
        <button onClick={save} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 text-sm flex items-center gap-2">{saved ? <><CheckCircle className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />Save</>}</button>
      </div>
      <div className="space-y-6">
        <Section title="General" icon={Globe}>
          <Field label="Platform Name"><input value={settings.siteName} onChange={e => update('siteName', e.target.value)} className="w-full px-3 py-2 bg-[#061818] border border-[#1a3d3d] rounded-lg text-sm text-white" /></Field>
          <Field label="Support Email"><input value={settings.supportEmail} onChange={e => update('supportEmail', e.target.value)} className="w-full px-3 py-2 bg-[#061818] border border-[#1a3d3d] rounded-lg text-sm text-white" /></Field>
        </Section>
        <Section title="Security" icon={Shield}>
          <div className="flex items-center justify-between"><div><div className="text-sm">Auto-Approve Doctors</div><div className="text-xs text-gray-500">Skip manual approval for new registrations</div></div><Toggle val={settings.autoApprove} onChange={v => update('autoApprove', v)} /></div>
          <Field label="Session Timeout (minutes)"><input type="number" value={settings.sessionTimeout} onChange={e => update('sessionTimeout', +e.target.value)} className="w-full px-3 py-2 bg-[#061818] border border-[#1a3d3d] rounded-lg text-sm text-white" /></Field>
          <div className="flex items-center justify-between"><div><div className="text-sm text-red-400">Maintenance Mode</div><div className="text-xs text-gray-500">Disables doctor panel access</div></div><Toggle val={settings.maintenanceMode} onChange={v => update('maintenanceMode', v)} /></div>
        </Section>
        <Section title="Storage" icon={Database}>
          <Field label="Max Upload Size (MB)"><input type="number" value={settings.maxFileSize} onChange={e => update('maxFileSize', +e.target.value)} className="w-full px-3 py-2 bg-[#061818] border border-[#1a3d3d] rounded-lg text-sm text-white" /></Field>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, icon: I, children }: any) {
  return <div className="bg-[#0a1f1f] border border-[#1a3d3d] rounded-xl p-5"><div className="flex items-center gap-2 mb-4"><I className="w-4 h-4 text-teal-400" /><h2 className="text-sm font-bold">{title}</h2></div><div className="space-y-4">{children}</div></div>
}
function Field({ label, children }: any) {
  return <div><label className="text-xs text-gray-400 block mb-1">{label}</label>{children}</div>
}
