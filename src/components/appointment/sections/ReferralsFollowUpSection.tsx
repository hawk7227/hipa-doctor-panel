import React from 'react'
import { Calendar } from 'lucide-react'
import type { Referral, FollowUpData } from '../hooks/useReferralsFollowUp'

interface ReferralsFollowUpSectionProps {
  referrals: Referral[]
  showReferralForm: boolean
  setShowReferralForm: (show: boolean) => void
  newReferral: {
    specialistName: string
    specialty: string
    reason: string
    urgency: 'routine' | 'urgent' | 'stat'
    notes: string
  }
  setNewReferral: (referral: any) => void
  showFollowUpScheduler: boolean
  setShowFollowUpScheduler: (show: boolean) => void
  followUpData: FollowUpData
  setFollowUpData: (data: FollowUpData) => void
  isSchedulingFollowUp: boolean
  isCustomizeMode: boolean
  sectionProps: any
  onCreateReferral: () => Promise<void>
  onScheduleFollowUp: () => Promise<void>
  error?: string | null
}

export default function ReferralsFollowUpSection({
  referrals,
  showReferralForm,
  setShowReferralForm,
  newReferral,
  setNewReferral,
  showFollowUpScheduler,
  setShowFollowUpScheduler,
  followUpData,
  setFollowUpData,
  isSchedulingFollowUp,
  isCustomizeMode,
  sectionProps,
  onCreateReferral,
  onScheduleFollowUp,
  error
}: ReferralsFollowUpSectionProps) {
  return (
    <div {...sectionProps}>
      {isCustomizeMode && (
        <div className="absolute -top-2 -left-2 z-10 bg-purple-600 text-white p-1 rounded-full">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      )}
      <div className="bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-white/10">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
          Referrals & Follow-up
        </h3>

        {/* Follow-up Scheduling */}
        <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-white">Schedule Follow-up</span>
            <button
              onClick={() => setShowFollowUpScheduler(!showFollowUpScheduler)}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              {showFollowUpScheduler ? 'Cancel' : '+ New'}
            </button>
          </div>
          {showFollowUpScheduler && (
            <div className="space-y-2 mt-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={followUpData.date}
                  onChange={(e) => setFollowUpData({ ...followUpData, date: e.target.value })}
                  className="h-8 px-2 rounded border border-white/20 bg-slate-700/50 text-white text-sm"
                />
                <input
                  type="time"
                  value={followUpData.time}
                  onChange={(e) => setFollowUpData({ ...followUpData, time: e.target.value })}
                  className="h-8 px-2 rounded border border-white/20 bg-slate-700/50 text-white text-sm"
                />
              </div>
              <select
                value={followUpData.visitType}
                onChange={(e) =>
                  setFollowUpData({ ...followUpData, visitType: e.target.value as any })
                }
                className="w-full h-8 px-2 rounded border border-white/20 bg-slate-700/50 text-white text-sm"
              >
                <option value="video">Video Visit</option>
                <option value="phone">Phone Call</option>
                <option value="async">Async Consult</option>
              </select>
              <input
                type="text"
                placeholder="Reason for follow-up"
                value={followUpData.reason}
                onChange={(e) => setFollowUpData({ ...followUpData, reason: e.target.value })}
                className="w-full h-8 px-2 rounded border border-white/20 bg-slate-700/50 text-white text-sm placeholder-gray-400"
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                onClick={onScheduleFollowUp}
                disabled={isSchedulingFollowUp}
                className="w-full py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 disabled:opacity-50"
              >
                {isSchedulingFollowUp ? 'Scheduling...' : 'Schedule Follow-up'}
              </button>
            </div>
          )}
        </div>

        {/* Referrals */}
        <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-white">Specialist Referrals</span>
            <button
              onClick={() => setShowReferralForm(!showReferralForm)}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              {showReferralForm ? 'Cancel' : '+ New Referral'}
            </button>
          </div>
          {showReferralForm && (
            <div className="space-y-2 mt-3">
              <input
                type="text"
                placeholder="Specialist Name"
                value={newReferral.specialistName}
                onChange={(e) => setNewReferral({ ...newReferral, specialistName: e.target.value })}
                className="w-full h-8 px-2 rounded border border-white/20 bg-slate-700/50 text-white text-sm placeholder-gray-400"
              />
              <input
                type="text"
                placeholder="Specialty (e.g., Urology, Infectious Disease)"
                value={newReferral.specialty}
                onChange={(e) => setNewReferral({ ...newReferral, specialty: e.target.value })}
                className="w-full h-8 px-2 rounded border border-white/20 bg-slate-700/50 text-white text-sm placeholder-gray-400"
              />
              <textarea
                placeholder="Reason for referral"
                value={newReferral.reason}
                onChange={(e) => setNewReferral({ ...newReferral, reason: e.target.value })}
                className="w-full px-2 py-1 rounded border border-white/20 bg-slate-700/50 text-white text-sm placeholder-gray-400 resize-none"
                rows={2}
              />
              <select
                value={newReferral.urgency}
                onChange={(e) => setNewReferral({ ...newReferral, urgency: e.target.value as any })}
                className="w-full h-8 px-2 rounded border border-white/20 bg-slate-700/50 text-white text-sm"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT</option>
              </select>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                onClick={onCreateReferral}
                className="w-full py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
              >
                Create Referral
              </button>
            </div>
          )}
          {referrals.length > 0 && (
            <div className="mt-3 space-y-2">
              {referrals.map((ref) => (
                <div key={ref.id} className="p-2 bg-slate-700/50 rounded border border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{ref.specialty}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        ref.status === 'completed'
                          ? 'bg-green-600'
                          : ref.status === 'scheduled'
                          ? 'bg-cyan-600'
                          : ref.status === 'sent'
                          ? 'bg-yellow-600'
                          : 'bg-gray-600'
                      } text-white`}
                    >
                      {ref.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{ref.specialist_name}</div>
                  <div className="text-xs text-gray-500">{ref.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

