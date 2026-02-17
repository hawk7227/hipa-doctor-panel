// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import axios, { AxiosError } from 'axios'

export interface ZoomMeeting {
  id: string
  join_url: string
  start_url: string
  password?: string
  topic: string
  start_time: string
  duration: number
}

interface AxiosErrorData {
  message?: string
  code?: number | string
  [key: string]: unknown
}

export interface ZoomRecordingFile {
  id: string
  recording_type: string
  recording_start: string
  recording_end: string
  file_size: number
  file_type: string
  file_extension: string
  play_url?: string
  download_url: string
  status: string
}

export interface ZoomRecordingsResponse {
  id: string
  uuid: string
  host_id: string
  topic: string
  start_time: string
  duration: number
  total_size: number
  recording_count: number
  recording_files: ZoomRecordingFile[]
}

export interface CreateMeetingParams {
  topic: string
  start_time: string
  duration: number
  timezone?: string
  password?: string
  waiting_room?: boolean
}

class ZoomService {
  private apiKey: string
  private apiSecret: string
  private accountId: string
  private userId: string | null = null // Cached user ID for Server-to-Server OAuth
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor() {
    this.apiKey = process.env.ZOOM_API_KEY || ''
    this.apiSecret = process.env.ZOOM_API_SECRET || ''
    this.accountId = process.env.ZOOM_ACCOUNT_ID || ''
    
    // Optional: Allow manual user ID override via environment variable
    if (process.env.ZOOM_USER_ID) {
      this.userId = process.env.ZOOM_USER_ID
    }
    
    console.log('🏗️ ZoomService initialized:', {
      hasApiKey: !!this.apiKey,
      hasApiSecret: !!this.apiSecret,
      hasAccountId: !!this.accountId,
      hasUserId: !!this.userId,
      apiKeyLength: this.apiKey.length,
      apiSecretLength: this.apiSecret.length,
      accountIdLength: this.accountId.length
    })
  }

  private async getAccessToken(): Promise<string> {
    console.log('🔑 Getting Zoom access token...')
    
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      console.log('✅ Using cached Zoom access token')
      return this.accessToken
    }

    console.log('🔄 Requesting new Zoom access token...')
    console.log('📋 Zoom API Config:', {
      apiKey: this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'NOT_SET',
      apiSecret: this.apiSecret ? `${this.apiSecret.substring(0, 8)}...` : 'NOT_SET',
      accountId: this.accountId ? `${this.accountId.substring(0, 8)}...` : 'NOT_SET'
    })

    try {
      const requestData = {
        grant_type: 'account_credentials',
        account_id: this.accountId
      }
      
      console.log('📤 Sending OAuth request:', requestData)
      
      const response = await axios.post('https://zoom.us/oauth/token', requestData, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      console.log('✅ Zoom OAuth response received:', {
        status: response.status,
        hasAccessToken: !!response.data.access_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type
      })

      this.accessToken = response.data.access_token
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000 // 1 minute buffer

      console.log('💾 Zoom access token cached, expires at:', new Date(this.tokenExpiry).toISOString())
      return this.accessToken!
    } catch (err: unknown) {
      const error = err as AxiosError<AxiosErrorData>
      console.error('❌ Error getting Zoom access token:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers ? Object.keys(error.config.headers) : 'No headers'
        }
      })
      throw new Error(`Failed to authenticate with Zoom API: ${error.message}`)
    }
  }

  private async getUserId(): Promise<string> {
    // If we have a cached user ID, return it
    if (this.userId) {
      return this.userId
    }

    // If manually configured via env var, use it
    if (process.env.ZOOM_USER_ID) {
      this.userId = process.env.ZOOM_USER_ID
      return this.userId
    }

    // Otherwise, try to get the account owner/user from Zoom API
    console.log('👤 Getting Zoom account user ID...')
    try {
      const token = await this.getAccessToken()
      
      // Try to get account owner/users - for Server-to-Server OAuth, we can get the primary user
      // First, try to get users list and find the account owner or first user
      const usersResponse = await axios.get('https://api.zoom.us/v2/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          status: 'active',
          page_size: 1,
          role_id: '0' // Account owner role
        }
      })

      if (usersResponse.data?.users && usersResponse.data.users.length > 0) {
        this.userId = usersResponse.data.users[0].id
        console.log('✅ Found Zoom user ID:', this.userId)
        return this.userId!
      }

      // Fallback: try to use "me" endpoint to get current user
      try {
        const meResponse = await axios.get('https://api.zoom.us/v2/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        this.userId = meResponse.data.id
        console.log('✅ Found Zoom user ID via /me endpoint:', this.userId)
        return this.userId!
      } catch (meError: unknown) {
        const error = meError as Error
        console.warn('⚠️ /me endpoint not available, will try /users/me/meetings directly')
        // For Server-to-Server OAuth, sometimes /users/me/meetings works without explicit user ID
        return 'me'
      }
    } catch (err: unknown) {
      const error = err as Error
      console.warn('⚠️ Could not fetch user ID, will try /users/me/meetings directly:', error.message)
      // Fallback to "me" - this might work with some Zoom account configurations
      return 'me'
    }
  }

  async createMeeting(params: CreateMeetingParams): Promise<ZoomMeeting> {
    console.log('📹 Creating Zoom meeting...')
    console.log('📋 Meeting parameters:', {
      topic: params.topic,
      start_time: params.start_time,
      duration: params.duration,
      timezone: params.timezone || 'UTC',
      hasPassword: !!params.password,
      waiting_room: params.waiting_room !== false
    })

    try {
      const token = await this.getAccessToken()
      console.log('🔑 Access token obtained for meeting creation')
      
      // Get the user ID to use for meeting creation
      const userId = await this.getUserId()
      
      const meetingData = {
        topic: params.topic,
        type: 2, // Scheduled meeting
        start_time: params.start_time,
        duration: params.duration,
        timezone: params.timezone || 'UTC',
        password: params.password || this.generatePassword(),
        settings: {
          waiting_room: params.waiting_room !== false,
          join_before_host: false,
          host_video: true,
          participant_video: true,
          mute_upon_entry: true,
          auto_recording: 'cloud', // Enable automatic cloud recording
          recording_authentication: false,
          cloud_recording: true,
          cloud_recording_download: true,
          cloud_recording_download_host: true,
          cloud_recording_download_participants: true
        }
      }

      const meetingUrl = `https://api.zoom.us/v2/users/${userId}/meetings`
      console.log('📤 Sending meeting creation request:', {
        url: meetingUrl,
        userId,
        data: meetingData,
        hasToken: !!token
      })

      const response = await axios.post(
        meetingUrl,
        meetingData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      console.log('✅ Zoom meeting created successfully:', {
        status: response.status,
        meetingId: response.data.id,
        topic: response.data.topic,
        hasJoinUrl: !!response.data.join_url,
        hasStartUrl: !!response.data.start_url,
        hasPassword: !!response.data.password
      })

      const meeting: ZoomMeeting = {
        id: response.data.id,
        join_url: response.data.join_url,
        start_url: response.data.start_url,
        password: response.data.password,
        topic: response.data.topic,
        start_time: response.data.start_time,
        duration: response.data.duration
      }

      console.log('📋 Final meeting object:', meeting)
      return meeting
    } catch (err: unknown) {
      const error = err as AxiosError<AxiosErrorData>
      console.error('❌ Error creating Zoom meeting:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers ? Object.keys(error.config.headers) : 'No headers',
          data: error.config?.data
        }
      })
      
      // Provide more helpful error messages
      let errorMessage = `Failed to create Zoom meeting: ${error.message}`
      if (error.response?.status === 401) {
        errorMessage = 'Zoom API authentication failed. Please check your ZOOM_API_KEY, ZOOM_API_SECRET, and ZOOM_ACCOUNT_ID.'
      } else if (error.response?.status === 403) {
        errorMessage = 'Zoom API access forbidden. Please check that your app has the required scopes (meeting:write:admin).'
      } else if (error.response?.data?.message) {
        errorMessage = `Zoom API error: ${error.response.data.message}`
      }
      
      throw new Error(errorMessage)
    }
  }

  async getMeeting(meetingId: string): Promise<ZoomMeeting> {
    console.log('🔍 Getting Zoom meeting:', meetingId)
    
    try {
      const token = await this.getAccessToken()
      console.log('🔑 Access token obtained for meeting retrieval')
      
      const url = `https://api.zoom.us/v2/meetings/${meetingId}`
      console.log('📤 Sending meeting retrieval request:', { url, hasToken: !!token })
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      console.log('✅ Zoom meeting retrieved successfully:', {
        status: response.status,
        meetingId: response.data.id,
        topic: response.data.topic
      })

      return {
        id: response.data.id,
        join_url: response.data.join_url,
        start_url: response.data.start_url,
        password: response.data.password,
        topic: response.data.topic,
        start_time: response.data.start_time,
        duration: response.data.duration
      }
    } catch (err: unknown) {
      const error = err as AxiosError<AxiosErrorData>
      console.error('❌ Error getting Zoom meeting:', {
        meetingId,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      })
      throw new Error(`Failed to get Zoom meeting: ${error.message}`)
    }
  }

  async updateMeeting(meetingId: string, params: Partial<CreateMeetingParams>): Promise<ZoomMeeting> {
    console.log('🔄 Updating Zoom meeting:', meetingId)
    console.log('📋 Update parameters:', params)
    
    try {
      const token = await this.getAccessToken()
      console.log('🔑 Access token obtained for meeting update')
      
      const url = `https://api.zoom.us/v2/meetings/${meetingId}`
      
      const updateData: Record<string, string | number> = {}
      if (params.topic) updateData.topic = params.topic
      if (params.start_time) updateData.start_time = params.start_time
      if (params.duration) updateData.duration = params.duration
      if (params.timezone) updateData.timezone = params.timezone
      if (params.password) updateData.password = params.password
      
      console.log('📤 Sending meeting update request:', { url, updateData, hasToken: !!token })
      
      const response = await axios.patch(url, updateData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('✅ Zoom meeting updated successfully:', {
        status: response.status,
        meetingId: response.data.id,
        topic: response.data.topic,
        startTime: response.data.start_time
      })
      
      return {
        id: response.data.id,
        join_url: response.data.join_url,
        start_url: response.data.start_url,
        password: response.data.password,
        topic: response.data.topic,
        start_time: response.data.start_time,
        duration: response.data.duration
      }
    } catch (err: unknown) {
      const error = err as AxiosError<AxiosErrorData>
      console.error('❌ Error updating Zoom meeting:', {
        meetingId,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      })
      throw new Error(`Failed to update Zoom meeting: ${error.message}`)
    }
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    console.log('🗑️ Deleting Zoom meeting:', meetingId)
    
    try {
      const token = await this.getAccessToken()
      console.log('🔑 Access token obtained for meeting deletion')
      
      const url = `https://api.zoom.us/v2/meetings/${meetingId}`
      console.log('📤 Sending meeting deletion request:', { url, hasToken: !!token })
      
      await axios.delete(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      console.log('✅ Zoom meeting deleted successfully:', meetingId)
    } catch (err: unknown) {
      const error = err as AxiosError<AxiosErrorData>
      console.error('❌ Error deleting Zoom meeting:', {
        meetingId,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      })
      throw new Error(`Failed to delete Zoom meeting: ${error.message}`)
    }
  }

  async getMeetingRecordings(meetingId: string): Promise<ZoomRecordingsResponse> {
    console.log('📹 Getting Zoom meeting recordings:', meetingId)
    try {
      const token = await this.getAccessToken()
      console.log('🔑 Access token obtained for recording retrieval')
      
      // First, check if the meeting exists and get its details
      try {
        const meetingDetails = await this.getMeeting(meetingId)
        const meetingStartTime = new Date(meetingDetails.start_time)
        const meetingDuration = meetingDetails.duration || 30
        const meetingEndTime = new Date(meetingStartTime.getTime() + meetingDuration * 60 * 1000)
        const now = new Date()
        
        console.log('📅 Meeting timing info:', {
          startTime: meetingStartTime.toISOString(),
          duration: meetingDuration,
          endTime: meetingEndTime.toISOString(),
          now: now.toISOString(),
          hasEnded: now > meetingEndTime,
          minutesSinceEnd: meetingEndTime < now ? Math.floor((now.getTime() - meetingEndTime.getTime()) / 60000) : 0
        })
        
        // If meeting hasn't ended yet, throw a more helpful error
        if (now < meetingEndTime) {
          const minutesUntilEnd = Math.ceil((meetingEndTime.getTime() - now.getTime()) / 60000)
          throw new Error(`Meeting is still in progress or hasn't started yet. Please wait until the meeting ends. (${minutesUntilEnd} minutes remaining)`)
        }
        
        // If meeting just ended, recordings may take time to process
        if (meetingEndTime < now && (now.getTime() - meetingEndTime.getTime()) < 30 * 60 * 1000) {
          const minutesSinceEnd = Math.floor((now.getTime() - meetingEndTime.getTime()) / 60000)
          console.log(`ℹ️ Meeting ended ${minutesSinceEnd} minutes ago. Recordings may still be processing...`)
        }
      } catch (meetingErr: unknown) {
        // If we can't get meeting details, continue with recording request anyway
        const meetingError = meetingErr as Error
        console.warn('⚠️ Could not verify meeting details:', meetingError.message)
      }
      
      const url = `https://api.zoom.us/v2/meetings/${meetingId}/recordings`
      console.log('📤 Sending recording retrieval request:', { url, hasToken: !!token })
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      console.log('✅ Zoom meeting recordings retrieved:', {
        status: response.status,
        meetingId: meetingId,
        hasRecordings: !!response.data.recording_files?.length,
        recordingCount: response.data.recording_files?.length || 0
      })
      
      return response.data
    } catch (err: unknown) {
      const error = err as AxiosError<AxiosErrorData>
      
      // Handle specific Zoom error codes
      if (error.response?.data?.code === 3301) {
        const errorMessage = 'Recording is not available yet. This could mean:\n' +
          '1. The meeting has not ended yet\n' +
          '2. Recording is still being processed (can take 5-30 minutes after meeting ends)\n' +
          '3. Recording was not enabled for this meeting\n\n' +
          'Please wait a few minutes and try again.'
        
        console.error('❌ Zoom recording not available (Error 3301):', {
          meetingId,
          message: errorMessage,
          code: error.response.data.code
        })
        
        throw new Error(errorMessage)
      }
      
      // If it's a custom error we threw (meeting not ended), pass it through
      if (error.message && error.message.includes('still in progress')) {
        throw error
      }
      
      console.error('❌ Error getting Zoom meeting recordings:', {
        meetingId,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      })
      
      throw new Error(`Failed to get Zoom meeting recordings: ${error.message}`)
    }
  }

  private generatePassword(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }
}

export const zoomService = new ZoomService()
