'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface AIMessage {
  id: string
  user_message: string
  ai_response: string
  interaction_type: string
  created_at: string
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [interactionType, setInteractionType] = useState<'health_question' | 'triage' | 'general_chat'>('health_question')

  useEffect(() => {
    fetchAIMessages()
  }, [])

  const fetchAIMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_interactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error fetching AI messages:', error)
        return
      }

      setMessages(data || [])
    } catch (error) {
      console.error('Error fetching AI messages:', error)
    }
  }

  const sendMessage = async () => {
    if (!currentMessage.trim()) return

    setLoading(true)
    const userMessage = currentMessage.trim()
    setCurrentMessage('')

    try {
      // Simulate AI response (in real implementation, this would call your AI service)
      const aiResponse = await simulateAIResponse(userMessage, interactionType)

      // Save to database
      const { data, error } = await supabase
        .from('ai_interactions')
        .insert({
          user_message: userMessage,
          ai_response: aiResponse,
          interaction_type: interactionType,
          is_anonymous: false
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving AI interaction:', error)
        return
      }

      // Add to messages
      setMessages(prev => [data, ...prev])
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setLoading(false)
    }
  }

  const simulateAIResponse = async (message: string, type: string): Promise<string> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Mock responses based on interaction type
    switch (type) {
      case 'health_question':
        return `Based on your question about "${message}", I can provide some general guidance. However, please remember that this is for informational purposes only and should not replace professional medical advice. For specific symptoms or concerns, please consult with a healthcare provider directly.`
      
      case 'triage':
        return `For triage purposes regarding "${message}", I recommend the following assessment: If symptoms are severe or life-threatening, seek immediate emergency care. For moderate symptoms, consider scheduling an appointment within 24-48 hours. For mild symptoms, monitor and consider self-care measures. Always consult with a healthcare provider for proper evaluation.`
      
      case 'general_chat':
        return `Thank you for your message about "${message}". I'm here to help with general health information and guidance. How can I assist you further today?`
      
      default:
        return `I understand you're asking about "${message}". I'm here to help with health-related questions and provide general guidance. Please let me know if you need more specific information.`
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#151D28] rounded-lg border border-[#1E2A3A] p-6">
        <h1 className="text-3xl font-bold text-[#E8ECF1]">AI Assistant</h1>
        <p className="text-[#7B8CA3] mt-2">Get AI-powered assistance for diagnoses, treatments, and note summaries</p>
      </div>

      {/* Interaction Type Selector */}
      <div className="bg-[#151D28] rounded-lg border border-[#1E2A3A] p-6">
        <h2 className="text-lg font-semibold text-[#E8ECF1] mb-4">Interaction Type</h2>
        <div className="flex space-x-4">
          <button
            onClick={() => setInteractionType('health_question')}
            className={`px-4 py-2 rounded-lg font-medium ${
              interactionType === 'health_question' 
                ? 'bg-blue-600 text-[#E8ECF1]' 
                : 'bg-[#151D28] text-[#7B8CA3] hover:bg-[#1E2A3A]'
            }`}
          >
            Health Questions
          </button>
          <button
            onClick={() => setInteractionType('triage')}
            className={`px-4 py-2 rounded-lg font-medium ${
              interactionType === 'triage' 
                ? 'bg-blue-600 text-[#E8ECF1]' 
                : 'bg-[#151D28] text-[#7B8CA3] hover:bg-[#1E2A3A]'
            }`}
          >
            Triage Assessment
          </button>
          <button
            onClick={() => setInteractionType('general_chat')}
            className={`px-4 py-2 rounded-lg font-medium ${
              interactionType === 'general_chat' 
                ? 'bg-blue-600 text-[#E8ECF1]' 
                : 'bg-[#151D28] text-[#7B8CA3] hover:bg-[#1E2A3A]'
            }`}
          >
            General Chat
          </button>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="bg-[#151D28] rounded-lg border border-[#1E2A3A]">
        <div className="p-6 border-b border-[#1E2A3A]">
          <h2 className="text-lg font-semibold text-[#E8ECF1]">Chat with AI Assistant</h2>
        </div>
        
        {/* Messages */}
        <div className="h-96 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-[#7B8CA3] py-8">
              <svg className="mx-auto h-12 w-12 text-[#7B8CA3] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p>Start a conversation with the AI assistant</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="space-y-2">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-[#E8ECF1] rounded-lg p-3 max-w-xs lg:max-w-md">
                    <p className="text-sm">{message.user_message}</p>
                  </div>
                </div>
                
                {/* AI Response */}
                <div className="flex justify-start">
                  <div className="bg-[#151D28] text-[#E8ECF1] rounded-lg p-3 max-w-xs lg:max-w-md">
                    <p className="text-sm">{message.ai_response}</p>
                    <p className="text-xs text-[#7B8CA3] mt-2">
                      {new Date(message.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#151D28] text-[#E8ECF1] rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1E2A3A]"></div>
                  <span className="text-sm">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-6 border-t border-[#1E2A3A]">
          <div className="flex space-x-4">
            <textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              className="flex-1 px-3 py-2 border border-[#1E2A3A] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !currentMessage.trim()}
              className="px-6 py-2 bg-blue-600 text-[#E8ECF1] rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>

    
    </div>
  )
}
