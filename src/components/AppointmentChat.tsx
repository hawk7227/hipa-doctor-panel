// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Send, Paperclip, FileText, Image, Download, X } from 'lucide-react'

interface AppointmentMessage {
  id: string
  appointment_id: string
  sender_id: string
  sender_type: 'doctor' | 'user'
  message_text: string
  message_type: 'text' | 'system' | 'notification'
  created_at: string
  is_read: boolean
  read_at?: string
  sender_name?: string
}

interface AppointmentChatProps {
  appointmentId: string
  currentUserId: string
  currentUserType: 'doctor' | 'patient'
  patientName?: string
  doctorName?: string
}

export default function AppointmentChat({
  appointmentId,
  currentUserId,
  currentUserType,
  patientName,
  doctorName
}: AppointmentChatProps) {
  const [messages, setMessages] = useState<AppointmentMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchMessages()
    
    // Set up real-time subscription for new messages
    const subscription = supabase
      .channel(`appointment_messages_${appointmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointment_messages',
          filter: `appointment_id=eq.${appointmentId}`
        },
        (payload) => {
          const newMessage = payload.new as AppointmentMessage
          setMessages(prev => [...prev, newMessage])
          scrollToBottom()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [appointmentId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchMessages = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('appointment_messages')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Process messages to add sender names
      const processedMessages = data?.map(msg => ({
        ...msg,
        sender_name: msg.sender_type === 'doctor' 
          ? 'Dr. Provider'
          : 'Patient'
      })) || []

      setMessages(processedMessages)

      // Mark messages as read
      await markMessagesAsRead()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const markMessagesAsRead = async () => {
    try {
      await supabase
        .from('appointment_messages')
        .update({ is_read: true })
        .eq('appointment_id', appointmentId)
        .eq('sender_type', currentUserType === 'doctor' ? 'user' : 'doctor')
        .eq('is_read', false)
    } catch (err) {
      console.error('Error marking messages as read:', err)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return

    setSending(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('appointment_messages')
        .insert({
          appointment_id: appointmentId,
          sender_id: currentUserId,
          sender_type: currentUserType === 'doctor' ? 'doctor' : 'user',
          message_text: newMessage.trim(),
          message_type: 'text',
          is_read: false
        })
        .select()
        .single()

      if (error) throw error

      setNewMessage('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      // Upload file to Supabase storage
      const bucketName = 'appointment-documents'
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      // Store in chat folder inside appointment-documents bucket
      const filePath = `chat/${appointmentId}/${fileName}`

      // Check if bucket exists, create if it doesn't
      const { data: buckets, error: listError } = await supabase.storage.listBuckets()
      if (listError) {
        console.warn('Could not list buckets:', listError)
      } else {
        const bucketExists = buckets?.some(b => b.name === bucketName)
        if (!bucketExists) {
          console.log(`Creating storage bucket: ${bucketName}`)
          const { error: createError } = await supabase.storage.createBucket(bucketName, {
            public: false,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: null
          })
          if (createError) {
            console.warn('Bucket creation error (may already exist):', createError)
          }
        }
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Generate signed URL for private bucket
      const { data: urlData, error: urlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 3600) // 1 hour expiry
      
      if (urlError) {
        console.warn('Error creating signed URL:', urlError)
      }

      // Save message with document
      const { data, error } = await supabase
        .from('appointment_messages')
        .insert({
          appointment_id: appointmentId,
          sender_id: currentUserId,
          sender_type: currentUserType === 'doctor' ? 'doctor' : 'user',
          message_text: `Shared document: ${file.name}`,
          message_type: 'text',
          is_read: false
        })
        .select()
        .single()

      if (error) throw error

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-4 w-4" />
    }
    return <FileText className="h-4 w-4" />
  }

  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error('Error downloading file:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-96 bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div>
          <h3 className="font-medium text-gray-900">Chat Messages</h3>
          <p className="text-sm text-gray-500">
            {currentUserType === 'doctor' ? `Chat with ${patientName}` : `Chat with ${doctorName}`}
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isCurrentUser = message.sender_type === currentUserType
            const showDate = index === 0 || 
              formatDate(message.created_at) !== formatDate(messages[index - 1].created_at)

            return (
              <div key={message.id}>
                {showDate && (
                  <div className="text-center text-xs text-gray-500 py-2">
                    {formatDate(message.created_at)}
                  </div>
                )}
                
                <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isCurrentUser 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    {!isCurrentUser && (
                      <div className="text-xs font-medium mb-1 opacity-75">
                        {message.sender_name}
                      </div>
                    )}
                    
                    <p className="text-sm whitespace-pre-wrap">{message.message_text}</p>
                    
                    <div className={`text-xs mt-1 ${
                      isCurrentUser ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {formatTime(message.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Message Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            {uploading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </button>
          
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={sending}
          />
          
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
