import nodemailer from 'nodemailer'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

export interface EmailData {
  to: string
  subject: string
  html: string
  text: string
  from?: string
}

class SMTPEmailService {
  private transporter: nodemailer.Transporter | null = null
  private config: EmailConfig | null = null

  constructor() {
    this.initializeTransporter()
  }

  private initializeTransporter() {
    try {
      // Get SMTP configuration from environment variables
      const host = process.env.SMTP_HOST
      const port = process.env.SMTP_PORT
      const user = process.env.SMTP_USER
      const pass = process.env.SMTP_PASS
      const secure = process.env.SMTP_SECURE === 'true'

      if (!host || !port || !user || !pass) {
        console.warn('⚠️ SMTP configuration incomplete. Email sending will be disabled.')
        console.warn('📝 Required environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
        return
      }

      this.config = {
        host,
        port: parseInt(port),
        secure,
        auth: {
          user,
          pass
        }
      }

      this.transporter = nodemailer.createTransport(this.config)
      console.log('✅ SMTP Email service initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize SMTP email service:', error)
    }
  }

  async sendEmail(emailData: EmailData): Promise<{ success: boolean; error?: any; messageId?: string }> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'SMTP service not configured. Please check your environment variables.'
      }
    }

    try {
      const mailOptions = {
        from: emailData.from || process.env.SMTP_FROM || process.env.SMTP_USER,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text
      }

      console.log('📧 Sending email via SMTP...')
      console.log('To:', emailData.to)
      console.log('Subject:', emailData.subject)

      const result = await this.transporter.sendMail(mailOptions)
      
      console.log('✅ Email sent successfully via SMTP')
      console.log('Message ID:', result.messageId)

      return {
        success: true,
        messageId: result.messageId
      }
    } catch (error) {
      console.error('❌ Failed to send email via SMTP:', error)
      return {
        success: false,
        error: error
      }
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false
    }

    try {
      await this.transporter.verify()
      console.log('✅ SMTP connection verified successfully')
      return true
    } catch (error) {
      console.error('❌ SMTP connection verification failed:', error)
      return false
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null
  }
}

// Export singleton instance
export const smtpEmailService = new SMTPEmailService()
