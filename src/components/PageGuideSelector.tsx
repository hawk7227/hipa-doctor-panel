'use client'

import { usePathname } from 'next/navigation'
import PageGuide from '@/components/PageGuide'
import {
  GUIDE_DASHBOARD, GUIDE_APPOINTMENTS, GUIDE_PATIENTS, GUIDE_STAFF_HUB,
  GUIDE_CHART_MANAGEMENT, GUIDE_COMMUNICATION, GUIDE_DATA_EXPORT,
  GUIDE_ADMIN_BUGS, GUIDE_PRESCRIPTIONS, GUIDE_LABS, GUIDE_BILLING,
  GUIDE_AVAILABILITY, GUIDE_SETTINGS, GUIDE_ALERTS, GUIDE_REPORTS,
  GUIDE_REFERRALS, GUIDE_QUALITY, GUIDE_AI_ASSISTANT, GUIDE_PROFILE,
} from '@/lib/system-manifest/page-guides'
import type { PageGuideConfig } from '@/components/PageGuide'

const ROUTE_MAP: Record<string, PageGuideConfig> = {
  '/doctor/dashboard': GUIDE_DASHBOARD,
  '/doctor/appointments': GUIDE_APPOINTMENTS,
  '/doctor/patients': GUIDE_PATIENTS,
  '/doctor/staff-hub': GUIDE_STAFF_HUB,
  '/doctor/chart-management': GUIDE_CHART_MANAGEMENT,
  '/doctor/communication': GUIDE_COMMUNICATION,
  '/doctor/data-export': GUIDE_DATA_EXPORT,
  '/doctor/admin-bugs': GUIDE_ADMIN_BUGS,
  '/doctor/bug-reports': GUIDE_ADMIN_BUGS,
  '/doctor/prescriptions': GUIDE_PRESCRIPTIONS,
  '/doctor/labs': GUIDE_LABS,
  '/doctor/billing': GUIDE_BILLING,
  '/doctor/availability': GUIDE_AVAILABILITY,
  '/doctor/settings': GUIDE_SETTINGS,
  '/doctor/alerts': GUIDE_ALERTS,
  '/doctor/reports': GUIDE_REPORTS,
  '/doctor/referrals': GUIDE_REFERRALS,
  '/doctor/quality': GUIDE_QUALITY,
  '/doctor/ai-assistant': GUIDE_AI_ASSISTANT,
  '/doctor/profile': GUIDE_PROFILE,
}

export default function PageGuideSelector() {
  const pathname = usePathname()
  const config = ROUTE_MAP[pathname]
  if (!config) return null
  return <PageGuide config={config} />
}
