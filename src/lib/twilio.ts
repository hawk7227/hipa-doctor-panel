// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID || ''
const authToken = process.env.TWILIO_AUTH_TOKEN || ''
const phoneNumber = process.env.TWILIO_PHONE_NUMBER || ''
// API Key and Secret for AccessToken (different from Account SID/Auth Token)
const apiKey = process.env.TWILIO_API_KEY || process.env.TWILIO_ACCOUNT_SID || ''
const apiSecret = process.env.TWILIO_API_SECRET || process.env.TWILIO_AUTH_TOKEN || ''

const client = twilio(accountSid, authToken)

export interface TwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
}

export class TwilioService {
  private client: twilio.Twilio

  constructor() {
    if (!accountSid || !authToken) {
      console.warn('⚠️ Twilio credentials not configured')
    }
    this.client = client
  }

  /**
   * Send SMS message
   */
  async sendSMS(to: string, message: string) {
    try {
      // Validate Twilio configuration
      if (!accountSid || !authToken) {
        throw new Error('Twilio Account SID and Auth Token are required')
      }

      if (!phoneNumber) {
        throw new Error('TWILIO_PHONE_NUMBER is not configured. Please set it in your environment variables.')
      }

      // Validate phone number format
      if (!to || typeof to !== 'string' || to.trim().length === 0) {
        throw new Error('Phone number is required')
      }

      // Validate message
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        throw new Error('Message is required')
      }

      // Twilio has a 1600 character limit for SMS
      if (message.length > 1600) {
        throw new Error('Message is too long. Maximum length is 1600 characters.')
      }

      // Format phone number (ensure it starts with +)
      let formattedTo = to.trim()
      if (!formattedTo.startsWith('+')) {
        formattedTo = `+${formattedTo}`
      }

      console.log('📱 Twilio SMS request:', {
        from: phoneNumber.substring(0, 4) + '...',
        to: formattedTo.substring(0, 4) + '...',
        messageLength: message.length
      })

      const result = await this.client.messages.create({
        body: message.trim(),
        from: phoneNumber,
        to: formattedTo
      })

      console.log('✅ SMS sent successfully:', {
        sid: result.sid,
        status: result.status,
        dateCreated: result.dateCreated
      })

      return {
        success: true,
        sid: result.sid,
        status: result.status
      }
    } catch (error: any) {
      console.error('❌ Error sending SMS via Twilio:', error)
      
      // Provide more specific error messages
      let errorMessage = error.message || 'Unknown error'
      
      // Common Twilio errors
      if (error.code === 21211) {
        errorMessage = 'Invalid phone number format. Please include country code (e.g., +1234567890)'
      } else if (error.code === 21608) {
        errorMessage = 'This phone number is not verified. For trial accounts, you must verify numbers first.'
      } else if (error.code === 21610) {
        errorMessage = 'Your Twilio account does not have permission to send to this number.'
      } else if (error.code === 21614) {
        errorMessage = 'Invalid phone number. Please check the number and try again.'
      } else if (error.message?.includes('not configured')) {
        errorMessage = 'Twilio is not properly configured. Please check your environment variables.'
      }

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Create a phone call
   */
  async createCall(to: string, from: string, url: string) {
    try {
      if (!phoneNumber) {
        throw new Error('Twilio phone number not configured')
      }

      const call = await this.client.calls.create({
        to: to,
        from: phoneNumber,
        url: url, // TwiML URL for call instructions
        method: 'POST'
      })

      return {
        success: true,
        callSid: call.sid,
        status: call.status
      }
    } catch (error: any) {
      console.error('Error creating call:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Generate Twilio Access Token for Voice SDK
   */
  async generateVoiceToken(identity: string, roomName?: string) {
    try {
      if (!identity || identity.trim() === '') {
        throw new Error('Identity is required and cannot be empty')
      }

      // Verify Twilio credentials are set
      if (!accountSid || accountSid.trim() === '') {
        console.error('TWILIO_ACCOUNT_SID is empty or not set')
        throw new Error('TWILIO_ACCOUNT_SID is not configured. Please check your .env.local file.')
      }
      if (!authToken || authToken.trim() === '') {
        console.error('TWILIO_AUTH_TOKEN is empty or not set')
        throw new Error('TWILIO_AUTH_TOKEN is not configured. Please check your .env.local file.')
      }

      // Get AccessToken and VoiceGrant from twilio
      const AccessToken = twilio.jwt.AccessToken
      const VoiceGrant = twilio.jwt.AccessToken.VoiceGrant
      
      // Ensure AccessToken is available
      if (!AccessToken) {
        throw new Error('Twilio AccessToken class not found. Check Twilio SDK installation.')
      }

      // Create token with validated identity
      const cleanIdentity = identity.trim()
      
      // Final validation - ensure identity is not empty
      if (!cleanIdentity || cleanIdentity.length === 0) {
        throw new Error('Identity cannot be empty after trimming')
      }
      
      // Validate credentials are strings and not empty
      const validAccountSid = String(accountSid).trim()
      
      if (!validAccountSid || validAccountSid.length === 0) {
        throw new Error('Account SID is invalid or empty')
      }
      
      // For AccessToken, Twilio requires:
      // - accountSid: Your Account SID
      // - signingKeySid: API Key SID (starts with SK) OR Account SID if using Account SID + Auth Token
      // - secret: API Key Secret OR Auth Token
      
      // Determine if we're using API Key/Secret or Account SID/Auth Token
      const hasApiKey = process.env.TWILIO_API_KEY && process.env.TWILIO_API_KEY.trim().length > 0
      const hasApiSecret = process.env.TWILIO_API_SECRET && process.env.TWILIO_API_SECRET.trim().length > 0
      
      let signingKeySid: string
      let secret: string
      
      if (hasApiKey && hasApiSecret) {
        // Use API Key + API Secret (recommended)
        signingKeySid = String(process.env.TWILIO_API_KEY).trim()
        secret = String(process.env.TWILIO_API_SECRET).trim()
        console.log('Using API Key + API Secret for token generation')
      } else {
        // Use Account SID + Auth Token (fallback)
        signingKeySid = validAccountSid
        secret = String(authToken).trim()
        
        if (!secret || secret.length === 0) {
          throw new Error('Auth Token is required when API Key/Secret not provided')
        }
        console.log('Using Account SID + Auth Token for token generation')
      }
      
      // Validate TwiML App SID
      const twimlAppSid = process.env.TWILIO_TWIML_APP_SID?.trim()
      if (!twimlAppSid || twimlAppSid.length === 0) {
        throw new Error('TWILIO_TWIML_APP_SID is required for Voice tokens')
      }
      
      if (!twimlAppSid.startsWith('AP')) {
        console.warn('⚠️ TWILIO_TWIML_APP_SID should start with "AP"')
      }
      
      // Validate identity format (alphanumeric and underscore only, max 121 chars)
      // Replace @ with _at_ and . with _dot_ to preserve meaning
      let validIdentity = cleanIdentity
        .replace(/@/g, '_at_')
        .replace(/\./g, '_dot_')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .substring(0, 121)
      
      // Remove consecutive underscores and trim
      validIdentity = validIdentity.replace(/_+/g, '_').replace(/^_+|_+$/g, '').trim()
      
      // Ensure identity is not empty after cleaning
      if (!validIdentity || validIdentity.length === 0) {
        throw new Error('Identity became empty after sanitization')
      }
      
      if (validIdentity !== cleanIdentity) {
        console.log(`ℹ️ Identity sanitized: ${cleanIdentity} -> ${validIdentity}`)
      }
      
      console.log('Creating Twilio token with:', {
        accountSid: validAccountSid.substring(0, 8) + '...',
        signingKeySid: signingKeySid.substring(0, 8) + '...',
        usingApiKey: hasApiKey,
        identity: validIdentity,
        identityLength: validIdentity.length,
        twimlAppSid: twimlAppSid.substring(0, 8) + '...',
        hasTwimlApp: !!twimlAppSid
      })
      
      // Create AccessToken - Twilio SDK v5.x
      // Constructor: new AccessToken(accountSid, signingKeySid, secret, { identity: string, ttl?: number })
      // Note: When using Account SID + Auth Token, signingKeySid should be the Account SID
      const tokenOptions: any = {
        identity: validIdentity,
        ttl: 3600 // Token expires in 1 hour (3600 seconds)
      }
      
      const token = new AccessToken(
        validAccountSid,
        signingKeySid,
        secret,
        tokenOptions
      )
      
      // Verify token was created successfully
      if (!token || typeof token !== 'object') {
        throw new Error('Failed to create AccessToken - invalid token object')
      }

      // Voice grant - REQUIRED for Voice SDK
      // This must be added BEFORE generating the JWT
      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: twimlAppSid
      })

      token.addGrant(voiceGrant)
      
      // Generate the JWT token
      const jwtToken = token.toJwt()
      
      // Verify the token was generated (should be a string)
      if (!jwtToken || typeof jwtToken !== 'string') {
        throw new Error('Failed to generate JWT token')
      }
      
      console.log('✅ Token created successfully with VoiceGrant')
      console.log('Token preview:', jwtToken.substring(0, 50) + '...')
      
      return {
        success: true,
        token: jwtToken
      }
    } catch (error: any) {
      console.error('Error generating voice token:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Generate TwiML for calls
   */
  generateTwiML(message: string) {
    const twiml = new twilio.twiml.VoiceResponse()
    twiml.say(message)
    return twiml.toString()
  }

  /**
   * Fetch call recordings by Call SID
   * Returns the recording URL if available
   */
  async getCallRecordings(callSid: string) {
    try {
      if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured')
      }

      if (!callSid || callSid.trim().length === 0) {
        throw new Error('Call SID is required')
      }

      console.log('📹 Fetching recordings for call:', callSid.substring(0, 8) + '...')

      // Fetch recordings for this call
      const recordings = await this.client.recordings.list({
        callSid: callSid,
        limit: 10 // Get the most recent recordings for this call
      })

      if (!recordings || recordings.length === 0) {
        console.log('⚠️ No recordings found for call:', callSid)
        return {
          success: false,
          error: 'No recordings found for this call. Recording may still be processing.',
          recordings: []
        }
      }

      // Find the most recent completed recording
      const completedRecordings = recordings.filter((rec: any) => rec.status === 'completed')
      
      if (completedRecordings.length === 0) {
        console.log('⚠️ No completed recordings found for call:', callSid)
        return {
          success: false,
          error: 'Recording is still processing. Please try again in a few moments.',
          recordings: recordings.map((rec: any) => ({
            sid: rec.sid,
            status: rec.status,
            uri: rec.uri
          }))
        }
      }

      // For dual-channel recordings, we might have multiple recordings
      // Find the recording with the longest duration (most likely the combined/mixed one)
      // If using record-from-answer-dual, we get 2 recordings - we'll use the one with audio
      const sortedRecordings = completedRecordings.sort((a: any, b: any) => {
        const durationA = parseInt(a.duration) || 0
        const durationB = parseInt(b.duration) || 0
        return durationB - durationA // Sort descending by duration
      })
      
      // Get the recording with the longest duration (usually the mixed one, or the main leg)
      const latestRecording = sortedRecordings[0]
      
      console.log('📊 Found recordings:', {
        total: completedRecordings.length,
        usingRecording: latestRecording.sid,
        duration: latestRecording.duration,
        allDurations: sortedRecordings.map((r: any) => ({ sid: r.sid, duration: r.duration }))
      })
      
      // Construct the recording URL
      // Twilio recording URLs format: https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Recordings/{RecordingSid}.mp3
      // The URI from the API is a JSON endpoint, we need to construct the MP3 URL
      // Format: https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Recordings/{RecordingSid}.mp3
      let recordingUrl = latestRecording.uri
      
      // If URI is JSON format, convert to MP3
      if (recordingUrl.endsWith('.json')) {
        recordingUrl = recordingUrl.replace('.json', '.mp3')
      } else if (recordingUrl.includes('/Recordings/')) {
        // Ensure it ends with .mp3
        if (!recordingUrl.endsWith('.mp3')) {
          recordingUrl = `${recordingUrl}.mp3`
        }
      }
      
      // Alternative: Construct URL directly if needed
      if (!recordingUrl || !recordingUrl.startsWith('http')) {
        recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${latestRecording.sid}.mp3`
      }
      
      console.log('✅ Recording found:', {
        recordingSid: latestRecording.sid,
        status: latestRecording.status,
        duration: latestRecording.duration,
        url: recordingUrl
      })

      return {
        success: true,
        recordingUrl: recordingUrl,
        recordingSid: latestRecording.sid,
        duration: latestRecording.duration,
        status: latestRecording.status,
        dateCreated: latestRecording.dateCreated,
        allRecordings: recordings.map((rec: any) => ({
          sid: rec.sid,
          status: rec.status,
          uri: rec.uri,
          duration: rec.duration
        }))
      }
    } catch (error: any) {
      console.error('❌ Error fetching call recordings:', error)
      return {
        success: false,
        error: error.message || 'Failed to fetch recordings'
      }
    }
  }
}

export const twilioService = new TwilioService()

