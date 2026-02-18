// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface AccessControl {
  resource_type: string
  resource_id: string
  access_level: 'full' | 'read_only' | 'denied'
}

interface AccessState {
  loaded: boolean
  isProvider: boolean
  staffId: string | null
  staffRole: string | null
  controls: AccessControl[]
}

// Cache to avoid re-fetching on every component mount
let cachedState: AccessState | null = null
let cacheKey: string | null = null

/**
 * Hook to check access control for current user.
 * Provider role always gets full access.
 * Staff members are checked against staff_access_controls table.
 */
export function useAccessControl(doctorId: string | null) {
  const [state, setState] = useState<AccessState>(cachedState || {
    loaded: false,
    isProvider: true, // Default to provider until we know otherwise
    staffId: null,
    staffRole: null,
    controls: [],
  })

  useEffect(() => {
    if (!doctorId) return
    // Use cache if same doctor
    if (cacheKey === doctorId && cachedState?.loaded) {
      setState(cachedState)
      return
    }

    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) return

        // Check if this user is staff (not the doctor)
        const { data: staffRecord } = await supabase
          .from('practice_staff')
          .select('id, role, first_name, last_name')
          .eq('doctor_id', doctorId)
          .eq('email', user.email)
          .eq('active', true)
          .maybeSingle()

        if (!staffRecord) {
          // User is the doctor — full access to everything
          const newState: AccessState = { loaded: true, isProvider: true, staffId: null, staffRole: 'provider', controls: [] }
          cachedState = newState
          cacheKey = doctorId
          setState(newState)
          return
        }

        // User is staff — fetch their access controls
        const { data: controls } = await supabase
          .from('staff_access_controls')
          .select('resource_type, resource_id, access_level')
          .eq('doctor_id', doctorId)
          .eq('staff_id', staffRecord.id)

        const newState: AccessState = {
          loaded: true,
          isProvider: false,
          staffId: staffRecord.id,
          staffRole: staffRecord.role,
          controls: (controls || []) as AccessControl[],
        }
        cachedState = newState
        cacheKey = doctorId
        setState(newState)
        console.log(`[AccessControl] Loaded ${(controls || []).length} rules for staff ${staffRecord.first_name} (${staffRecord.role})`)
      } catch (err) {
        console.error('[AccessControl] Load error:', err)
        // Default to full access on error to avoid lockout
        setState({ loaded: true, isProvider: true, staffId: null, staffRole: 'provider', controls: [] })
      }
    }

    load()
  }, [doctorId])

  /**
   * Check if user can access a resource.
   * @returns 'full' | 'read_only' | 'denied'
   */
  const checkAccess = useCallback((resourceType: 'panel' | 'page' | 'action', resourceId: string): 'full' | 'read_only' | 'denied' => {
    // Provider always gets full access
    if (state.isProvider) return 'full'
    if (!state.loaded) return 'full' // Don't block while loading

    const control = state.controls.find(
      c => c.resource_type === resourceType && c.resource_id === resourceId
    )

    // If no control set, default to full access (opt-in restriction)
    if (!control) return 'full'
    return control.access_level
  }, [state])

  /**
   * Check if user can access a page by path.
   */
  const canAccessPage = useCallback((path: string): boolean => {
    const level = checkAccess('page', path)
    return level !== 'denied'
  }, [checkAccess])

  /**
   * Check if user can access a panel by ID.
   */
  const canAccessPanel = useCallback((panelId: string): 'full' | 'read_only' | 'denied' => {
    return checkAccess('panel', panelId)
  }, [checkAccess])

  /**
   * Check if user can perform an action.
   */
  const canPerformAction = useCallback((actionId: string): boolean => {
    const level = checkAccess('action', actionId)
    return level === 'full'
  }, [checkAccess])

  /**
   * Filter nav items based on access.
   */
  const filterNavItems = useCallback(<T extends { href: string }>(items: readonly T[]): T[] => {
    if (state.isProvider) return [...items]
    return items.filter(item => canAccessPage(item.href))
  }, [state.isProvider, canAccessPage])

  /**
   * Invalidate cache (call after access controls are updated).
   */
  const invalidateCache = useCallback(() => {
    cachedState = null
    cacheKey = null
  }, [])

  return {
    ...state,
    checkAccess,
    canAccessPage,
    canAccessPanel,
    canPerformAction,
    filterNavItems,
    invalidateCache,
  }
}

/**
 * Lightweight component wrapper that hides content if access is denied.
 */
export function AccessGate({
  children,
  resourceType,
  resourceId,
  doctorId,
  fallback,
}: {
  children: React.ReactNode
  resourceType: 'panel' | 'page' | 'action'
  resourceId: string
  doctorId: string | null
  fallback?: React.ReactNode
}) {
  const { checkAccess, loaded } = useAccessControl(doctorId)

  if (!loaded) return <>{children}</> // Don't block while loading
  const level = checkAccess(resourceType, resourceId)

  if (level === 'denied') {
    return fallback ? <>{fallback}</> : (
      <div className="flex items-center justify-center p-8 text-center">
        <div>
          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-white">Access Restricted</p>
          <p className="text-xs text-gray-500 mt-1">You do not have permission to view this content.</p>
          <p className="text-[10px] text-gray-600 mt-1">Contact your provider to request access.</p>
        </div>
      </div>
    )
  }

  if (level === 'read_only') {
    return (
      <div className="relative">
        <div className="pointer-events-none opacity-80">{children}</div>
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] font-bold text-amber-400">
          READ ONLY
        </div>
      </div>
    )
  }

  return <>{children}</>
}
