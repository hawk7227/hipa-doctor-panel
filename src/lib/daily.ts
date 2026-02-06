// Daily.co API service for live support sessions

interface DailyRoomConfig {
  name?: string  // Optional - will be auto-generated if not provided
  privacy?: 'public' | 'private'
  properties?: {
    enable_screenshare?: boolean
    enable_chat?: boolean
    enable_prejoin_ui?: boolean
    enable_recording?: 'cloud' | 'local' | string | false
    start_audio_off?: boolean
    start_video_off?: boolean
    exp?: number // Expiration timestamp
    eject_at_room_exp?: boolean
    enable_knocking?: boolean
  }
}

interface DailyRoom {
  id: string
  name: string
  url: string
  created_at: string
  config: any
}

interface DailyMeetingToken {
  token: string
}

class DailyService {
  private apiKey: string | null = null
  private baseUrl = 'https://api.daily.co/v1'

  private getApiKey(): string {
    if (!this.apiKey) {
      this.apiKey = process.env.DAILY_API_KEY || ''
    }
    if (!this.apiKey) {
      throw new Error('DAILY_API_KEY environment variable is not set')
    }
    return this.apiKey
  }

  async createRoom(config: DailyRoomConfig): Promise<DailyRoom> {
    const apiKey = this.getApiKey()
    
    // Room expires in 24 hours
    const expiry = Math.floor(Date.now() / 1000) + 86400
    
    // Auto-generate name if not provided
    const roomName = config.name || `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    
    const response = await fetch(`${this.baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: config.privacy || 'public',
        properties: {
          ...config.properties,
          exp: config.properties?.exp || expiry,
          eject_at_room_exp: config.properties?.eject_at_room_exp ?? true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Daily.co create room error:', errorText)
      throw new Error(`Failed to create Daily room: ${response.status} ${errorText}`)
    }

    const room = await response.json()
    return room
  }

  async getRoom(roomName: string): Promise<DailyRoom | null> {
    const apiKey = this.getApiKey()
    
    const response = await fetch(`${this.baseUrl}/rooms/${roomName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to get Daily room: ${response.status} ${errorText}`)
    }

    return response.json()
  }

  async deleteRoom(roomName: string): Promise<boolean> {
    const apiKey = this.getApiKey()
    
    const response = await fetch(`${this.baseUrl}/rooms/${roomName}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (response.status === 404) {
      // Room doesn't exist, consider it deleted
      return true
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to delete Daily room: ${response.status} ${errorText}`)
    }

    return true
  }

  // Create a meeting token for a specific participant
  // Supports two calling styles:
  // 1. createMeetingToken(roomName, options) - simple style
  // 2. createMeetingToken({ properties: { room_name, ... } }) - object style
  async createMeetingToken(
    roomNameOrConfig: string | { properties: Record<string, any> },
    options?: {
      user_name?: string
      is_owner?: boolean
      enable_screenshare?: boolean
      start_video_off?: boolean
      start_audio_off?: boolean
      start_cloud_recording?: boolean
    }
  ): Promise<string> {
    const apiKey = this.getApiKey()
    
    // Token expires in 24 hours
    const expiry = Math.floor(Date.now() / 1000) + 86400
    
    let tokenProperties: Record<string, any>
    
    if (typeof roomNameOrConfig === 'string') {
      // Simple style: createMeetingToken(roomName, options)
      tokenProperties = {
        room_name: roomNameOrConfig,
        exp: expiry,
        user_name: options?.user_name || 'Participant',
        is_owner: options?.is_owner ?? false,
        enable_screenshare: options?.enable_screenshare ?? true,
        start_video_off: options?.start_video_off ?? false,
        start_audio_off: options?.start_audio_off ?? false,
        start_cloud_recording: options?.start_cloud_recording ?? false,
      }
    } else {
      // Object style: createMeetingToken({ properties: { ... } })
      tokenProperties = {
        exp: expiry,
        ...roomNameOrConfig.properties,
      }
    }
    
    const response = await fetch(`${this.baseUrl}/meeting-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        properties: tokenProperties,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create meeting token: ${response.status} ${errorText}`)
    }

    const data: DailyMeetingToken = await response.json()
    return data.token
  }
}

export const dailyService = new DailyService()
