'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Bot, User, MessageSquare, Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface AIChatInteraction {
  id: string
  user_message: string
  ai_response: string
  interaction_type: string
  created_at: string
  session_id: string
}

interface AIChatHistoryProps {
  patientId: string
  appointmentId: string
}

export default function AIChatHistory({ patientId, appointmentId }: AIChatHistoryProps) {
  const [interactions, setInteractions] = useState<AIChatInteraction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetchAIChatHistory()
  }, [patientId])

  const fetchAIChatHistory = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('ai_interactions')
        .select('*')
        .eq('user_id', patientId)
        .eq('is_anonymous', false)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setInteractions(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getInteractionTypeColor = (type: string) => {
    const colors = {
      health_question: 'bg-blue-100 text-blue-800',
      triage: 'bg-orange-100 text-orange-800',
      general_chat: 'bg-green-100 text-green-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getInteractionTypeLabel = (type: string) => {
    const labels = {
      health_question: 'Health Question',
      triage: 'Triage',
      general_chat: 'General Chat'
    }
    return labels[type as keyof typeof labels] || type
  }

  // Group interactions by session
  const groupedInteractions = interactions.reduce((acc, interaction) => {
    const sessionId = interaction.session_id
    if (!acc[sessionId]) {
      acc[sessionId] = []
    }
    acc[sessionId].push(interaction)
    return acc
  }, {} as Record<string, AIChatInteraction[]>)

  const sessionIds = Object.keys(groupedInteractions)
  const displaySessions = showAll ? sessionIds : sessionIds.slice(0, 3)

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedSessions(newExpanded)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI Chat History</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI Chat History</h3>
        </div>
        <div className="text-red-600 text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">AI Chat History</h3>
        <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full">
          {interactions.length} interaction{interactions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {interactions.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No AI chat history found for this patient</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displaySessions.map((sessionId) => {
            const sessionInteractions = groupedInteractions[sessionId]
            const isExpanded = expandedSessions.has(sessionId)
            const firstInteraction = sessionInteractions[sessionInteractions.length - 1] // Oldest first
            const lastInteraction = sessionInteractions[0] // Newest first

            return (
              <div key={sessionId} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleSession(sessionId)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                        <MessageSquare className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Chat Session - {sessionInteractions.length} message{sessionInteractions.length !== 1 ? 's' : ''}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getInteractionTypeColor(firstInteraction.interaction_type)}`}>
                            {getInteractionTypeLabel(firstInteraction.interaction_type)}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            {formatDate(firstInteraction.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(lastInteraction.created_at)}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <div className="space-y-4">
                      {sessionInteractions.reverse().map((interaction) => (
                        <div key={interaction.id} className="space-y-3">
                          {/* User Message */}
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="h-4 w-4 text-blue-600" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="bg-white border border-gray-200 rounded-lg p-3">
                                <p className="text-sm text-gray-900">{interaction.user_message}</p>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(interaction.created_at)}
                              </p>
                            </div>
                          </div>

                          {/* AI Response */}
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                <Bot className="h-4 w-4 text-purple-600" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                <p className="text-sm text-gray-900 whitespace-pre-wrap">{interaction.ai_response}</p>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                AI Response - {formatDate(interaction.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {sessionIds.length > 3 && (
            <div className="text-center pt-4">
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-purple-600 hover:text-purple-700 text-sm font-medium"
              >
                {showAll ? 'Show Less' : `Show All ${sessionIds.length} Sessions`}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
        <p className="text-sm text-purple-700">
          <strong>Note:</strong> This shows the patient's AI assistant chat history. 
          This information can help you understand the patient's concerns and questions before the appointment.
        </p>
      </div>
    </div>
  )
}
