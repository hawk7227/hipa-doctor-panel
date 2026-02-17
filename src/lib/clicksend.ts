// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
/**
 * ClickSend SMS Service
 * Handles SMS sending via ClickSend API
 */

const apiUsername = process.env.CLICKSEND_USERNAME || ''
const apiKey = process.env.CLICKSEND_API_KEY || ''
const baseUrl = 'https://rest.clicksend.com/v3'

export interface ClickSendConfig {
  username: string
  apiKey: string
}

export interface ClickSendSMSResponse {
  success: boolean
  messageId?: string
  status?: string
  error?: string
}

export class ClickSendService {
  private username: string
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.username = apiUsername
    this.apiKey = apiKey
    this.baseUrl = baseUrl

    if (!this.username || !this.apiKey) {
      console.warn('⚠️ ClickSend credentials not configured')
    }
  }

  /**
   * Get Basic Auth header for ClickSend API
   */
  private getAuthHeader(): string {
    const credentials = `${this.username}:${this.apiKey}`
    return `Basic ${Buffer.from(credentials).toString('base64')}`
  }

  /**
   * Send SMS message via ClickSend
   */
  async sendSMS(to: string, message: string, from?: string): Promise<ClickSendSMSResponse> {
    try {
      // Validate ClickSend configuration
      if (!this.username || !this.apiKey) {
        throw new Error('ClickSend Username and API Key are required')
      }

      // Validate phone number format
      if (!to || typeof to !== 'string' || to.trim().length === 0) {
        throw new Error('Phone number is required')
      }

      // Validate message
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        throw new Error('Message is required')
      }

      // ClickSend has a 1600 character limit for SMS
      if (message.length > 1600) {
        throw new Error('Message is too long. Maximum length is 1600 characters.')
      }

      // Format phone number (ensure it starts with +)
      let formattedTo = to.trim()
      if (!formattedTo.startsWith('+')) {
        formattedTo = `+${formattedTo}`
      }

      // Remove any spaces or dashes from phone number
      formattedTo = formattedTo.replace(/[\s-]/g, '')

      // Use sender ID from environment or default
      const senderId = from || 'SMS'

      console.log('📱 ClickSend SMS request:', {
        from: senderId,
        to: formattedTo.substring(0, 4) + '...',
        messageLength: message.length
      })

      // ClickSend API endpoint
      const url = `${this.baseUrl}/sms/send`

      // Prepare SMS payload according to ClickSend API
      const payload = {
        messages: [
          {
            source: 'sdk',
            from: senderId,
            body: message.trim(),
            to: formattedTo
          }
        ]
      }

      // Make API request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const responseData = await response.json()

      // Check if request was successful
      if (!response.ok) {
        console.error('❌ ClickSend API error:', responseData)
        
        let errorMessage = 'Failed to send SMS'
        if (responseData.response_code === 'SUCCESS' && responseData.data?.messages) {
          // Check individual message status
          const messageResult = responseData.data.messages[0]
          if (messageResult.status !== 'SUCCESS') {
            errorMessage = messageResult.status || messageResult.error_text || errorMessage
          }
        } else if (responseData.response_code) {
          errorMessage = responseData.response_code
        } else if (responseData.message) {
          errorMessage = responseData.message
        }

        return {
          success: false,
          error: errorMessage
        }
      }

      // Parse successful response
      if (responseData.response_code === 'SUCCESS' && responseData.data?.messages) {
        const messageResult = responseData.data.messages[0]
        const messageId = messageResult.message_id || messageResult.messageid || null

        console.log('✅ SMS sent successfully:', {
          messageId: messageId,
          status: messageResult.status,
          to: formattedTo.substring(0, 4) + '...'
        })

        return {
          success: true,
          messageId: messageId || undefined,
          status: messageResult.status || 'SUCCESS'
        }
      }

      // Unexpected response format
      console.warn('⚠️ Unexpected ClickSend response format:', responseData)
      return {
        success: false,
        error: 'Unexpected response format from ClickSend API'
      }

    } catch (error: any) {
      console.error('❌ Error sending SMS via ClickSend:', error)
      
      // Provide more specific error messages
      let errorMessage = error.message || 'Unknown error'
      
      // Common ClickSend errors
      if (error.message?.includes('not configured')) {
        errorMessage = 'ClickSend is not properly configured. Please check your environment variables.'
      } else if (error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.'
      } else if (error.message?.includes('JSON')) {
        errorMessage = 'Invalid response from ClickSend API. Please try again.'
      }

      return {
        success: false,
        error: errorMessage
      }
    }
  }
}

export const clicksendService = new ClickSendService()

