'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import {
  ROLES, ROLE_CONFIG, ROLE_PERMISSIONS, PERMISSION_GROUPS, PERMISSIONS,
  type Role, type Permission, getPermissionsForRole,
} from '@/lib/rbac'
import {
  Users, Plus, Shield, X, ChevronDown, ChevronRight,
  Mail, RefreshCw, Search, MoreHorizontal, UserCheck,
  UserX, Edit3, Trash2, Check, Clock, BarChart3,
  Calendar, Activity, FileText, AlertCircle
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface StaffAuditEntry {
  id: string
  action: string
  resource_type: string
  resource_id: string
  description: string
  staff_email: string
  created_at: string
}

interface StaffScheduleEntry {
  id?: string
  staff_id: string
  day_of_week: number // 0=Sun...6=Sat
  start_time: string // "09:00"
  end_time: string   // "17:00"
  is_active: boolean
}

interface StaffMember {
  id: string
  user_id: string | null
  email: string
  first_name: string
  last_name: string
  role: Role
  doctor_id: string
  permissions: Permission[]
  active: boolean
  last_login_at: string | null
  invited_at: string | null
  accepted_at: string | null
  created_at: string
  updated_at: string
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function StaffManagementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Modal state
  const [showInvite, setShowInvite] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [showPermissions, setShowPermissions] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  // Tabs
  const [activeTab, setActiveTab] = useState<'team' | 'schedule' | 'activity' | 'metrics'>('team')

  // Audit log
  const [auditLog, setAuditLog] = useState<StaffAuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  // Schedule
  const [schedules, setSchedules] = useState<StaffScheduleEntry[]>([])
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null)

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFirst, setInviteFirst] = useState('')
  const [inviteLast, setInviteLast] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('assistant')
  const [invitePermissions, setInvitePermissions] = useState<Permission[]>(getPermissionsForRole('assistant'))
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // ── Fetch ──
  const fetchStaff = useCallback(async (docId: string) => {
    const { data, error } = await supabase
      .from('practice_staff')
      .select('*')
      .eq('doctor_id', docId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Staff fetch error:', error)
      setStaff([])
    } else {
      setStaff((data || []) as unknown as StaffMember[])
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const authUser = await getCurrentUser()
        if (!authUser?.doctor) { router.push('/login'); return }
        setDoctorId(authUser.doctor.id)
        await fetchStaff(authUser.doctor.id)
      } catch (err) {
        console.error('Staff init error:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router, fetchStaff])

  // Fetch audit log
  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true)
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      setAuditLog((data || []) as StaffAuditEntry[])
    } catch (err) {
      console.error('Audit log fetch error:', err)
    } finally {
      setAuditLoading(false)
    }
  }, [])

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('staff_schedules')
        .select('*')
        .order('day_of_week', { ascending: true })
      setSchedules((data || []) as StaffScheduleEntry[])
    } catch (err) {
      console.error('Schedule fetch error:', err)
    }
  }, [])

  // Tab change handler
  useEffect(() => {
    if (activeTab === 'activity' && auditLog.length === 0) fetchAuditLog()
    if (activeTab === 'schedule') fetchSchedules()
  }, [activeTab, auditLog.length, fetchAuditLog, fetchSchedules])

  // Save schedule
  const handleSaveSchedule = async (staffId: string, dayOfWeek: number, startTime: string, endTime: string) => {
    try {
      const existing = schedules.find(s => s.staff_id === staffId && s.day_of_week === dayOfWeek)
      if (existing?.id) {
        await supabase.from('staff_schedules').update({ start_time: startTime, end_time: endTime, is_active: true }).eq('id', existing.id)
      } else {
        await supabase.from('staff_schedules').insert({ staff_id: staffId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, is_active: true })
      }
      fetchSchedules()
    } catch (err) {
      console.error('Schedule save error:', err)
    }
  }

  // Staff metrics
  const staffMetrics = useMemo(() => {
    const total = staff.length
    const active = staff.filter(s => s.active).length
    const pending = staff.filter(s => !s.accepted_at).length
    const byRole: Record<string, number> = {}
    staff.forEach(s => { byRole[s.role] = (byRole[s.role] || 0) + 1 })
    const recentLogins = staff.filter(s => {
      if (!s.last_login_at) return false
      return (Date.now() - new Date(s.last_login_at).getTime()) < 7 * 24 * 60 * 60 * 1000
    }).length
    return { total, active, pending, byRole, recentLogins }
  }, [staff])

  const handleRefresh = async () => {
    if (!doctorId || refreshing) return
    setRefreshing(true)
    await fetchStaff(doctorId)
    setRefreshing(false)
  }

  // ── Invite ──
  const handleInvite = async () => {
    if (!doctorId || !inviteEmail.trim() || !inviteFirst.trim() || !inviteLast.trim()) return
    setInviteLoading(true)
    setInviteError(null)

    try {
      // Check for duplicate
      const existing = staff.find(s => s.email.toLowerCase() === inviteEmail.toLowerCase())
      if (existing) {
        setInviteError('This email is already on your staff list.')
        setInviteLoading(false)
        return
      }

      const permissions = invitePermissions

      const { error } = await supabase.from('practice_staff').insert({
        email: inviteEmail.trim().toLowerCase(),
        first_name: inviteFirst.trim(),
        last_name: inviteLast.trim(),
        role: inviteRole,
        doctor_id: doctorId,
        permissions,
        active: true,
        invited_at: new Date().toISOString(),
      })

      if (error) {
        setInviteError(error.message)
      } else {
        logAudit({
          action: 'ADD_STAFF',
          resourceType: 'staff',
          description: `Invited ${inviteFirst} ${inviteLast} (${inviteEmail}) as ${inviteRole} with ${permissions.length} permissions`,
        })
        setShowInvite(false)
        setInviteEmail('')
        setInviteFirst('')
        setInviteLast('')
        setInviteRole('assistant')
        setInvitePermissions(getPermissionsForRole('assistant'))
        await fetchStaff(doctorId)
      }
    } catch (err) {
      setInviteError('Failed to invite staff member')
    } finally {
      setInviteLoading(false)
    }
  }

  // ── Update role ──
  const handleUpdateRole = async (member: StaffMember, newRole: Role) => {
    if (!doctorId) return
    const permissions = getPermissionsForRole(newRole)
    const { error } = await supabase
      .from('practice_staff')
      .update({ role: newRole, permissions, updated_at: new Date().toISOString() })
      .eq('id', member.id)
    if (!error) {
      logAudit({
        action: 'UPDATE_STAFF_PERMISSIONS',
        resourceType: 'staff',
        resourceId: member.id,
        description: `Changed ${member.first_name} ${member.last_name} role to ${newRole}`,
        metadata: { oldRole: member.role, newRole },
      })
      await fetchStaff(doctorId)
    }
    setEditingStaff(null)
  }

  // ── Toggle permission ──
  const handleTogglePermission = async (member: StaffMember, perm: Permission) => {
    if (!doctorId) return
    const newPerms = member.permissions.includes(perm)
      ? member.permissions.filter(p => p !== perm)
      : [...member.permissions, perm]

    const { error } = await supabase
      .from('practice_staff')
      .update({ permissions: newPerms, updated_at: new Date().toISOString() })
      .eq('id', member.id)
    if (!error) {
      logAudit({
        action: 'UPDATE_STAFF_PERMISSIONS',
        resourceType: 'staff',
        resourceId: member.id,
        description: `${member.permissions.includes(perm) ? 'Removed' : 'Added'} permission: ${perm}`,
      })
      await fetchStaff(doctorId)
    }
  }

  // ── Toggle active ──
  const handleToggleActive = async (member: StaffMember) => {
    if (!doctorId) return
    const { error } = await supabase
      .from('practice_staff')
      .update({ active: !member.active, updated_at: new Date().toISOString() })
      .eq('id', member.id)
    if (!error) {
      logAudit({
        action: member.active ? 'REMOVE_STAFF' : 'ADD_STAFF',
        resourceType: 'staff',
        resourceId: member.id,
        description: `${member.active ? 'Deactivated' : 'Reactivated'} ${member.first_name} ${member.last_name}`,
      })
      await fetchStaff(doctorId)
    }
    setMenuOpen(null)
  }

  // ── Delete ──
  const handleDelete = async (member: StaffMember) => {
    if (!doctorId) return
    if (!confirm(`Remove ${member.first_name} ${member.last_name} from your staff? This cannot be undone.`)) return

    const { error } = await supabase
      .from('practice_staff')
      .delete()
      .eq('id', member.id)
    if (!error) {
      logAudit({
        action: 'REMOVE_STAFF',
        resourceType: 'staff',
        resourceId: member.id,
        description: `Permanently removed ${member.first_name} ${member.last_name}`,
      })
      await fetchStaff(doctorId)
    }
    setMenuOpen(null)
  }

  // ── Filtered ──
  const filtered = search.trim()
    ? staff.filter(s => `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase().includes(search.toLowerCase()))
    : staff

  const activeCount = staff.filter(s => s.active).length

  if (loading) {
    return (
      <div className="h-full bg-[#0a1f1f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400" />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="h-full overflow-auto bg-[#0a1f1f] text-white">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Staff Management</h1>
              <p className="text-xs text-gray-400">{activeCount} active staff member{activeCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setShowInvite(true)} className="flex items-center space-x-1.5 bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] px-4 py-2 rounded-lg text-xs font-bold transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span>Invite Staff</span>
            </button>
            <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-lg bg-[#0a1f1f] border border-[#1a3d3d] hover:border-teal-500/50 text-gray-300 hover:text-teal-400 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-[#0a1f1f] rounded-lg p-1 border border-[#1a3d3d]">
          {([
            { key: 'team' as const, label: 'Team', icon: Users },
            { key: 'schedule' as const, label: 'Schedule', icon: Calendar },
            { key: 'activity' as const, label: 'Activity Log', icon: Activity },
            { key: 'metrics' as const, label: 'Metrics', icon: BarChart3 },
          ]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors ${
                activeTab === key ? 'bg-teal-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}>
              <Icon className="w-3.5 h-3.5" /><span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ═══ TEAM TAB ═══ */}
        {activeTab === 'team' && (<>

        {/* Role Legend */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ROLE_CONFIG) as Role[]).map(role => {
            const config = ROLE_CONFIG[role]
            const count = staff.filter(s => s.role === role && s.active).length
            return (
              <div key={role} className={`flex items-center space-x-1.5 ${config.bgColor} rounded-lg px-3 py-1.5 border border-white/5`}>
                <span className={`text-[10px] font-bold ${config.color}`}>{config.label}</span>
                <span className="text-[10px] text-gray-400">{count}</span>
              </div>
            )
          })}
        </div>

        {/* Search */}
        {staff.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff..."
              className="w-full bg-[#0d2626] border border-[#1a3d3d] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50"
            />
          </div>
        )}

        {/* Staff List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] py-16 text-center">
              <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">{staff.length === 0 ? 'No staff members yet' : 'No results'}</p>
              <p className="text-xs text-gray-500 mt-1">
                {staff.length === 0 ? 'Invite your first team member to get started.' : 'Try a different search term.'}
              </p>
              {staff.length === 0 && (
                <button onClick={() => setShowInvite(true)} className="mt-4 bg-teal-400 hover:bg-teal-500 text-[#0a1f1f] px-4 py-2 rounded-lg text-xs font-bold transition-colors">
                  Invite Staff Member
                </button>
              )}
            </div>
          ) : (
            filtered.map(member => {
              const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.assistant
              const isExpanded = showPermissions === member.id

              return (
                <div key={member.id} className={`bg-[#0d2626] rounded-lg border transition-colors ${member.active ? 'border-[#1a3d3d]' : 'border-red-500/20 opacity-60'}`}>
                  {/* Main row */}
                  <div className="flex items-center space-x-3 px-4 py-3">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-lg ${roleConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <span className={`text-sm font-bold ${roleConfig.color}`}>
                        {member.first_name[0]}{member.last_name[0]}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-bold text-white truncate">{member.first_name} {member.last_name}</p>
                        {!member.active && <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 rounded font-bold">INACTIVE</span>}
                        {member.accepted_at && <UserCheck className="w-3 h-3 text-green-400" />}
                        {!member.accepted_at && <Mail className="w-3 h-3 text-amber-400" />}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{member.email}</p>
                    </div>

                    {/* Role badge */}
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${roleConfig.bgColor} ${roleConfig.color} flex-shrink-0`}>
                      {roleConfig.label}
                    </span>

                    {/* Permissions toggle */}
                    <button
                      onClick={() => setShowPermissions(isExpanded ? null : member.id)}
                      className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                      title="View permissions"
                    >
                      <Shield className="w-4 h-4" />
                    </button>

                    {/* Menu */}
                    <div className="relative">
                      <button onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)} className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {menuOpen === member.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                          <div className="absolute right-0 top-full mt-1 w-48 bg-[#0d2626] border border-[#1a3d3d] rounded-lg shadow-2xl z-50 overflow-hidden">
                            {/* Role options */}
                            {(Object.keys(ROLE_CONFIG) as Role[]).filter(r => r !== 'doctor').map(role => (
                              <button
                                key={role}
                                onClick={() => { handleUpdateRole(member, role); setMenuOpen(null) }}
                                className={`w-full text-left px-4 py-2 text-xs hover:bg-white/5 transition-colors flex items-center justify-between ${member.role === role ? 'text-teal-400' : 'text-gray-300'}`}
                              >
                                <span>Set as {ROLE_CONFIG[role].label}</span>
                                {member.role === role && <Check className="w-3 h-3" />}
                              </button>
                            ))}
                            <div className="border-t border-[#1a3d3d]" />
                            <button onClick={() => handleToggleActive(member)} className="w-full text-left px-4 py-2 text-xs hover:bg-white/5 transition-colors text-gray-300 flex items-center space-x-2">
                              {member.active ? <UserX className="w-3 h-3 text-red-400" /> : <UserCheck className="w-3 h-3 text-green-400" />}
                              <span>{member.active ? 'Deactivate' : 'Reactivate'}</span>
                            </button>
                            <button onClick={() => handleDelete(member)} className="w-full text-left px-4 py-2 text-xs hover:bg-white/5 transition-colors text-red-400 flex items-center space-x-2">
                              <Trash2 className="w-3 h-3" />
                              <span>Remove permanently</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Permissions panel */}
                  {isExpanded && (
                    <div className="border-t border-[#1a3d3d] px-4 py-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Permissions</p>
                        <button
                          onClick={() => {
                            const defaults = getPermissionsForRole(member.role)
                            handleResetPermissions(member, defaults)
                          }}
                          className="text-[10px] text-teal-400 hover:text-teal-300 font-bold"
                        >
                          Reset to role defaults
                        </button>
                      </div>
                      {PERMISSION_GROUPS.map(group => {
                        const groupPerms = group.permissions.map(p => p.key)
                        const enabledCount = groupPerms.filter(k => member.permissions.includes(k)).length
                        return (
                          <div key={group.label} className="space-y-1">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs">{group.icon}</span>
                              <span className="text-[10px] text-gray-400 font-bold">{group.label}</span>
                              <span className="text-[9px] text-gray-600">({enabledCount}/{groupPerms.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {group.permissions.map(perm => {
                                const has = member.permissions.includes(perm.key)
                                return (
                                  <button
                                    key={perm.key}
                                    onClick={() => handleTogglePermission(member, perm.key)}
                                    title={perm.description}
                                    className={`text-[10px] px-2 py-1 rounded-md border transition-colors font-medium flex items-center space-x-1 ${
                                      has
                                        ? 'bg-teal-500/15 border-teal-500/30 text-teal-400'
                                        : 'bg-[#0a1f1f] border-[#1a3d3d] text-gray-500 hover:text-gray-300'
                                    }`}
                                  >
                                    <span>{has ? '✓' : '○'}</span>
                                    <span>{perm.label}</span>
                                    {perm.sensitive && <span className="text-[8px] text-red-400 ml-0.5">⚠</span>}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
        </>)}

        {/* ═══ SCHEDULE TAB ═══ */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">Set working hours for each staff member. This helps coordinate coverage and availability.</p>
            {staff.filter(s => s.active).length === 0 ? (
              <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] py-12 text-center">
                <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No active staff to schedule</p>
              </div>
            ) : (
              staff.filter(s => s.active).map(member => {
                const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.assistant
                const memberSchedules = schedules.filter(s => s.staff_id === member.id)
                const isEditing = editingSchedule === member.id
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

                return (
                  <div key={member.id} className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a3d3d]">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg ${roleConfig.bgColor} flex items-center justify-center`}>
                          <span className={`text-xs font-bold ${roleConfig.color}`}>{member.first_name[0]}{member.last_name[0]}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{member.first_name} {member.last_name}</p>
                          <p className={`text-[10px] font-bold ${roleConfig.color}`}>{roleConfig.label}</p>
                        </div>
                      </div>
                      <button onClick={() => setEditingSchedule(isEditing ? null : member.id)}
                        className="text-xs text-teal-400 hover:text-teal-300 font-bold">
                        {isEditing ? 'Done' : 'Edit'}
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-[#1a3d3d]">
                      {days.map((day, idx) => {
                        const sched = memberSchedules.find(s => s.day_of_week === idx)
                        return (
                          <div key={idx} className="bg-[#0d2626] p-2 text-center">
                            <p className="text-[10px] font-bold text-gray-400 mb-1">{day}</p>
                            {sched && sched.is_active ? (
                              <div>
                                <p className="text-[10px] text-teal-400 font-medium">{sched.start_time}</p>
                                <p className="text-[8px] text-gray-500">to</p>
                                <p className="text-[10px] text-teal-400 font-medium">{sched.end_time}</p>
                              </div>
                            ) : (
                              <p className="text-[10px] text-gray-600">Off</p>
                            )}
                            {isEditing && (
                              <button
                                onClick={() => {
                                  if (sched && sched.is_active) {
                                    // Remove day
                                    if (sched.id) supabase.from('staff_schedules').update({ is_active: false }).eq('id', sched.id).then(() => fetchSchedules())
                                  } else {
                                    handleSaveSchedule(member.id, idx, '09:00', '17:00')
                                  }
                                }}
                                className={`mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${sched && sched.is_active ? 'text-red-400 bg-red-500/10' : 'text-teal-400 bg-teal-500/10'}`}
                              >
                                {sched && sched.is_active ? 'Remove' : 'Add'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ═══ ACTIVITY LOG TAB ═══ */}
        {activeTab === 'activity' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Recent actions by all staff members</p>
              <button onClick={fetchAuditLog} disabled={auditLoading} className="text-xs text-teal-400 hover:text-teal-300 font-bold flex items-center space-x-1">
                <RefreshCw className={`w-3 h-3 ${auditLoading ? 'animate-spin' : ''}`} /><span>Refresh</span>
              </button>
            </div>
            {auditLoading ? (
              <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-gray-500" /></div>
            ) : auditLog.length === 0 ? (
              <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] py-12 text-center">
                <Activity className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No activity recorded yet</p>
                <p className="text-xs text-gray-600 mt-1">Staff actions will appear here as they use the system</p>
              </div>
            ) : (
              <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] overflow-hidden divide-y divide-[#1a3d3d]/50 max-h-[60vh] overflow-y-auto">
                {auditLog.map(entry => (
                  <div key={entry.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        entry.action.includes('CREATE') ? 'bg-green-500/20 text-green-400' :
                        entry.action.includes('DELETE') || entry.action.includes('REMOVE') ? 'bg-red-500/20 text-red-400' :
                        entry.action.includes('UPDATE') ? 'bg-blue-500/20 text-blue-400' :
                        entry.action.includes('SIGN') ? 'bg-purple-500/20 text-purple-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>{entry.action.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-gray-500">{new Date(entry.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-300">{entry.description}</p>
                    {entry.staff_email && <p className="text-[10px] text-gray-500 mt-0.5">by {entry.staff_email}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ METRICS TAB ═══ */}
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Staff', value: staffMetrics.total, icon: Users, color: 'text-teal-400' },
                { label: 'Active', value: staffMetrics.active, icon: UserCheck, color: 'text-green-400' },
                { label: 'Pending Invite', value: staffMetrics.pending, icon: Mail, color: 'text-amber-400' },
                { label: 'Active This Week', value: staffMetrics.recentLogins, icon: Activity, color: 'text-blue-400' },
              ].map(({ label, value, icon: Icon, color }, i) => (
                <div key={i} className="bg-[#0d2626] rounded-lg p-4 border border-[#1a3d3d]">
                  <div className="flex items-center space-x-2 mb-2"><Icon className={`w-4 h-4 ${color}`} /><span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</span></div>
                  <p className="text-2xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            {/* Role Distribution */}
            <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] p-4">
              <h3 className="text-sm font-bold text-white mb-3">Role Distribution</h3>
              <div className="space-y-2">
                {(Object.keys(ROLE_CONFIG) as Role[]).map(role => {
                  const config = ROLE_CONFIG[role]
                  const count = staffMetrics.byRole[role] || 0
                  const pct = staffMetrics.total > 0 ? Math.round((count / staffMetrics.total) * 100) : 0
                  return (
                    <div key={role} className="flex items-center space-x-3">
                      <span className={`text-xs font-bold w-20 ${config.color}`}>{config.label}</span>
                      <div className="flex-1 bg-[#0a1f1f] rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: config.color.includes('teal') ? '#2dd4bf' : config.color.includes('blue') ? '#60a5fa' : config.color.includes('purple') ? '#c084fc' : '#fbbf24' }} />
                      </div>
                      <span className="text-xs text-gray-400 w-12 text-right">{count} ({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Staff Status Table */}
            <div className="bg-[#0d2626] rounded-lg border border-[#1a3d3d] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[#1a3d3d] bg-[#0a1f1f]/50">
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Staff Performance Overview</p>
              </div>
              <div className="divide-y divide-[#1a3d3d]/50">
                {staff.map(member => {
                  const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.assistant
                  const lastActive = member.last_login_at ? new Date(member.last_login_at) : null
                  const daysSinceLogin = lastActive ? Math.round((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24)) : null
                  const permCount = member.permissions?.length || 0
                  const maxPerms = Object.values(PERMISSIONS).length
                  return (
                    <div key={member.id} className="px-4 py-3 flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-lg ${roleConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <span className={`text-xs font-bold ${roleConfig.color}`}>{member.first_name[0]}{member.last_name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{member.first_name} {member.last_name}</p>
                        <p className={`text-[10px] ${roleConfig.color} font-bold`}>{roleConfig.label}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <p className="text-[10px] text-gray-400">{permCount}/{maxPerms} perms</p>
                        <p className={`text-[10px] font-bold ${
                          !member.active ? 'text-red-400' :
                          daysSinceLogin === null ? 'text-gray-500' :
                          daysSinceLogin <= 1 ? 'text-green-400' :
                          daysSinceLogin <= 7 ? 'text-amber-400' :
                          'text-red-400'
                        }`}>
                          {!member.active ? 'Inactive' :
                           daysSinceLogin === null ? 'Never logged in' :
                           daysSinceLogin === 0 ? 'Active today' :
                           `${daysSinceLogin}d ago`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ INVITE MODAL ═══ */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="relative bg-[#0d2626] border border-[#1a3d3d] rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Invite Staff Member</h2>
              <button onClick={() => setShowInvite(false)} className="p-1 rounded hover:bg-white/10 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {inviteError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">{inviteError}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase">First Name</label>
                <input
                  type="text" value={inviteFirst} onChange={(e) => setInviteFirst(e.target.value)}
                  className="w-full mt-1 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase">Last Name</label>
                <input
                  type="text" value={inviteLast} onChange={(e) => setInviteLast(e.target.value)}
                  className="w-full mt-1 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
                  placeholder="Smith"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase">Email</label>
              <input
                type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full mt-1 bg-[#0a1f1f] border border-[#1a3d3d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
                placeholder="jane@practice.com"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase">Role</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {(['assistant', 'nurse', 'front_desk', 'admin', 'billing'] as Role[]).map(role => {
                  const config = ROLE_CONFIG[role]
                  return (
                    <button
                      key={role}
                      onClick={() => { setInviteRole(role); setInvitePermissions(getPermissionsForRole(role)) }}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        inviteRole === role
                          ? `${config.bgColor} border-teal-500/30`
                          : 'bg-[#0a1f1f] border-[#1a3d3d] hover:border-[#2a5d5d]'
                      }`}
                    >
                      <p className={`text-xs font-bold ${inviteRole === role ? config.color : 'text-gray-300'}`}>{config.label}</p>
                      <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-2">{config.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Permissions Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] text-gray-400 font-bold uppercase">Permissions ({invitePermissions.length}/{Object.keys(PERMISSIONS).length})</label>
                <button onClick={() => setInvitePermissions(getPermissionsForRole(inviteRole))} className="text-[10px] text-teal-400 hover:text-teal-300 font-bold">
                  Reset to defaults
                </button>
              </div>
              <div className="bg-[#0a1f1f] rounded-lg border border-[#1a3d3d] p-3 max-h-64 overflow-y-auto space-y-4">
                {PERMISSION_GROUPS.map(group => {
                  const groupPerms = group.permissions.map(p => p.key)
                  const allEnabled = groupPerms.every(k => invitePermissions.includes(k))
                  const someEnabled = groupPerms.some(k => invitePermissions.includes(k))
                  return (
                    <div key={group.label} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs">{group.icon}</span>
                          <span className="text-[10px] text-gray-400 font-bold">{group.label}</span>
                          <span className="text-[9px] text-gray-600">({groupPerms.filter(k => invitePermissions.includes(k)).length}/{groupPerms.length})</span>
                        </div>
                        <button onClick={() => {
                          if (allEnabled) setInvitePermissions(prev => prev.filter(p => !groupPerms.includes(p)))
                          else setInvitePermissions(prev => [...new Set([...prev, ...groupPerms])])
                        }} className={`text-[9px] font-bold ${allEnabled ? 'text-red-400' : 'text-teal-400'}`}>
                          {allEnabled ? 'Remove All' : someEnabled ? 'Enable All' : 'Enable All'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {group.permissions.map(perm => {
                          const has = invitePermissions.includes(perm.key)
                          return (
                            <button key={perm.key}
                              onClick={() => setInvitePermissions(prev => has ? prev.filter(p => p !== perm.key) : [...prev, perm.key])}
                              title={perm.description}
                              className={`text-[10px] px-2 py-1 rounded-md border transition-colors font-medium flex items-center space-x-1 ${
                                has ? 'bg-teal-500/15 border-teal-500/30 text-teal-400' : 'bg-[#0d2626] border-[#1a3d3d] text-gray-500 hover:text-gray-300'
                              }`}
                            >
                              <span>{has ? '✓' : '○'}</span>
                              <span>{perm.label}</span>
                              {perm.sensitive && <span className="text-[8px] text-red-400 ml-0.5">⚠</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              onClick={handleInvite}
              disabled={inviteLoading || !inviteEmail.trim() || !inviteFirst.trim() || !inviteLast.trim()}
              className="w-full bg-teal-400 hover:bg-teal-500 disabled:opacity-50 text-[#0a1f1f] py-2.5 rounded-lg text-sm font-bold transition-colors"
            >
              {inviteLoading ? 'Inviting...' : 'Send Invite'}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // Helper to reset permissions
  function handleResetPermissions(member: StaffMember, defaults: Permission[]) {
    if (!doctorId) return
    supabase
      .from('practice_staff')
      .update({ permissions: defaults, updated_at: new Date().toISOString() })
      .eq('id', member.id)
      .then(({ error }) => {
        if (!error) {
          logAudit({
            action: 'UPDATE_STAFF_PERMISSIONS',
            resourceType: 'staff',
            resourceId: member.id,
            description: `Reset permissions to ${member.role} defaults`,
          })
          fetchStaff(doctorId!)
        }
      })
  }
}
