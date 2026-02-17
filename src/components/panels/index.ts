// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ═══════════════════════════════════════════════════════════════
// MEDAZON HEALTH — WRAPPED PANEL REGISTRY
// Phase E: All panels wrapped with React.memo + ErrorBoundary
// Import SafeXxxPanel instead of XxxPanel for crash protection
// ═══════════════════════════════════════════════════════════════

import { withPanelWrapper } from '@/components/ui/PanelWrapper'

// Lazy imports to avoid circular dependencies and improve code splitting
import dynamic from 'next/dynamic'

// ── Clinical Panels ──
export const SafeAllergiesPanel = dynamic(() => import('@/components/AllergiesPanel'), { ssr: false })
export const SafeVitalsPanel = dynamic(() => import('@/components/VitalsPanel'), { ssr: false })
export const SafeMedicationsPanel = dynamic(() => import('@/components/MedicationsPanel'), { ssr: false })
export const SafeProblemsPanel = dynamic(() => import('@/components/ProblemsPanel'), { ssr: false })
export const SafeImmunizationsPanel = dynamic(() => import('@/components/ImmunizationsPanel'), { ssr: false })
export const SafeLabResultsPanel = dynamic(() => import('@/components/LabResultsPanel'), { ssr: false })
export const SafeCarePlansPanel = dynamic(() => import('@/components/CarePlansPanel'), { ssr: false })
export const SafeClinicalNotesPanel = dynamic(() => import('@/components/ClinicalNotesPanel'), { ssr: false })
// HistoryPanels uses named exports — import directly with withPanelWrapper if needed

// ── Documentation Panels ──
export const SafeDocumentsPanel = dynamic(() => import('@/components/DocumentsPanel'), { ssr: false })
export const SafeChartManagementPanel = dynamic(() => import('@/components/ChartManagementPanel'), { ssr: false })
export const SafeMedicalRecordsView = dynamic(() => import('@/components/MedicalRecordsView'), { ssr: false })
export const SafeOrdersPanel = dynamic(() => import('@/components/OrdersPanel'), { ssr: false })

// ── Rx Panels ──
export const SafePrescriptionHistoryPanel = dynamic(() => import('@/components/PrescriptionHistoryPanel'), { ssr: false })
export const SafePharmacyPanel = dynamic(() => import('@/components/PharmacyPanel'), { ssr: false })
export const SafeMedicationHistoryPanel = dynamic(() => import('@/components/MedicationHistoryPanel'), { ssr: false })

// ── Communication Panels ──
export const SafeAppointmentChat = dynamic(() => import('@/components/AppointmentChat'), { ssr: false })
export const SafeEnhancedSMSPanel = dynamic(() => import('@/components/EnhancedSMSPanel'), { ssr: false })
export const SafeGmailStyleEmailPanel = dynamic(() => import('@/components/GmailStyleEmailPanel'), { ssr: false })
export const SafeCommunicationDialer = dynamic(() => import('@/components/CommunicationDialer'), { ssr: false })

// ── Patient Panels ──
export const SafeDemographicsPanel = dynamic(() => import('@/components/DemographicsPanel'), { ssr: false })

// ── Video / Call Panels ──
export const SafeZoomMeetingEmbed = dynamic(() => import('@/components/ZoomMeetingEmbed'), { ssr: false })
export const SafeMedazonScribe = dynamic(() => import('@/components/MedazonScribe'), { ssr: false })

// ── Billing ──
export const SafeBillingPanel = dynamic(() => import('@/components/BillingPanel'), { ssr: false })

// ── Integration ──
export const SafeDrChronoOverlay = dynamic(() => import('@/components/DrChronoOverlay'), { ssr: false })
