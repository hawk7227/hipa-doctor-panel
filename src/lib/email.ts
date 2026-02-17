// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { supabase } from './supabase'

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export const createAppointmentAcceptedEmail = (patientName: string, doctorName: string, appointmentDate: string, meetingUrl?: string): EmailTemplate => {
  const subject = `Appointment Confirmed - HealthCare Pro`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Confirmed - HealthCare Pro</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #2d3748; 
          background-color: #f7fafc;
        }
        .email-container { 
          max-width: 650px; 
          margin: 0 auto; 
          background-color: #ffffff;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          border-radius: 12px;
          overflow: hidden;
        }
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white; 
          padding: 40px 30px; 
          text-align: center; 
          position: relative;
        }
        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
          opacity: 0.3;
        }
        .header-content { position: relative; z-index: 1; }
        .logo { 
          font-size: 28px; 
          font-weight: 700; 
          margin-bottom: 10px;
          letter-spacing: -0.5px;
        }
        .logo-subtitle {
          font-size: 14px;
          opacity: 0.9;
          font-weight: 300;
        }
        .header h1 { 
          font-size: 24px; 
          margin-top: 20px;
          font-weight: 600;
        }
        .content { 
          padding: 40px 30px; 
          background-color: #ffffff;
        }
        .greeting {
          font-size: 18px;
          color: #2d3748;
          margin-bottom: 20px;
          font-weight: 500;
        }
        .main-message {
          font-size: 16px;
          color: #4a5568;
          margin-bottom: 30px;
          line-height: 1.7;
        }
        .info-box { 
          background: linear-gradient(135deg, #e6fffa 0%, #f0fff4 100%);
          border: 1px solid #68d391;
          border-left: 5px solid #48bb78;
          padding: 25px; 
          margin: 30px 0; 
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(72, 187, 120, 0.1);
        }
        .info-box h3 {
          color: #2f855a;
          font-size: 18px;
          margin-bottom: 15px;
          font-weight: 600;
        }
        .info-item {
          color: #2d3748;
          margin-bottom: 10px;
          font-size: 15px;
        }
        .info-item strong {
          color: #1a202c;
          font-weight: 600;
        }
        .button {
          display: inline-block;
          padding: 14px 28px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }
        .support-message {
          background: #f7fafc;
          padding: 20px;
          border-radius: 8px;
          margin: 30px 0;
          border-left: 4px solid #4299e1;
        }
        .support-message h4 {
          color: #2b6cb0;
          margin-bottom: 10px;
          font-size: 16px;
        }
        .support-message p {
          color: #4a5568;
          font-size: 14px;
          line-height: 1.6;
        }
        .footer {
          background: #2d3748;
          color: #cbd5e0;
          padding: 30px;
          text-align: center;
          font-size: 13px;
        }
        .footer-brand {
          font-size: 18px;
          font-weight: 700;
          color: white;
          margin-bottom: 10px;
        }
        .social-links {
          margin: 15px 0;
        }
        .social-links a {
          color: #cbd5e0;
          text-decoration: none;
          margin: 0 5px;
        }
        .footer-disclaimer {
          margin-top: 15px;
          font-size: 11px;
          color: #718096;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div class="header-content">
            <div class="logo">🏥 HealthCare Pro</div>
            <div class="logo-subtitle">Your Trusted Healthcare Partner</div>
            <h1>Appointment Confirmed!</h1>
          </div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello ${patientName},
          </div>
          
          <div class="main-message">
            Great news! Your appointment has been confirmed. We're looking forward to seeing you and providing you with the best healthcare experience.
          </div>
          
          <div class="info-box">
            <h3>📅 Appointment Details</h3>
            <div class="info-item">
              <strong>Doctor:</strong> Dr. ${doctorName}
            </div>
            <div class="info-item">
              <strong>Date & Time:</strong> ${appointmentDate}
            </div>
            <div class="info-item">
              <strong>Status:</strong> Confirmed ✅
            </div>
            ${meetingUrl ? `
            <div class="info-item">
              <strong>Meeting Link:</strong> <a href="${meetingUrl}" style="color: #4299e1; text-decoration: underline;">Join Video Call</a>
            </div>
            ` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            ${meetingUrl ? `
              <a href="${meetingUrl}" class="button">📹 Join Video Call</a>
            ` : `
              <a href="#" class="button">📅 View Appointment Details</a>
            `}
          </div>
          
          <div class="support-message">
            <h4>💡 What to Expect</h4>
            <p>
              Please arrive a few minutes early for your appointment. If this is a video consultation, make sure you have a stable internet connection and a quiet, private space. 
              ${meetingUrl ? 'Click the link above to join when it\'s time for your appointment.' : 'Our team will contact you with additional details if needed.'}
            </p>
          </div>
          
          <div class="main-message" style="text-align: center; font-weight: 500; color: #2d3748;">
            We look forward to providing you with exceptional care! 🌟
          </div>
          
          <div class="footer">
            <div class="footer-brand">HealthCare Pro</div>
            <p>Your health is our priority. We're committed to providing you with the best possible care.</p>
            <div class="social-links">
              <a href="#">Website</a> • 
              <a href="#">Support</a> • 
              <a href="#">Privacy Policy</a>
            </div>
            <div class="footer-disclaimer">
              This is an automated message from HealthCare Pro. Please do not reply to this email.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
    HealthCare Pro - Appointment Confirmed
    
    Hello ${patientName},
    
    Great news! Your appointment has been confirmed. We're looking forward to seeing you and providing you with the best healthcare experience.
    
    APPOINTMENT DETAILS:
    - Doctor: Dr. ${doctorName}
    - Date & Time: ${appointmentDate}
    - Status: Confirmed ✅
    ${meetingUrl ? `- Meeting Link: ${meetingUrl}` : ''}
    
    ${meetingUrl ? `\nTo join your video call, click here: ${meetingUrl}` : ''}
    
    WHAT TO EXPECT:
    Please arrive a few minutes early for your appointment. If this is a video consultation, make sure you have a stable internet connection and a quiet, private space.
    
    We look forward to providing you with exceptional care!
    
    Best regards,
    HealthCare Pro Team
    Your Trusted Healthcare Partner
  `
  
  return { subject, html, text }
}

export const createAppointmentRejectedEmail = (patientName: string, doctorName: string, appointmentDate: string, reason?: string): EmailTemplate => {
  const subject = `Appointment Update - HealthCare Pro`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Update - HealthCare Pro</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #2d3748; 
          background-color: #f7fafc;
        }
        .email-container { 
          max-width: 650px; 
          margin: 0 auto; 
          background-color: #ffffff;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          border-radius: 12px;
          overflow: hidden;
        }
        .header { 
          background: linear-gradient(135deg, #f56565 0%, #c53030 100%);
          color: white; 
          padding: 40px 30px; 
          text-align: center; 
          position: relative;
        }
        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
          opacity: 0.3;
        }
        .header-content { position: relative; z-index: 1; }
        .logo { 
          font-size: 28px; 
          font-weight: 700; 
          margin-bottom: 10px;
          letter-spacing: -0.5px;
        }
        .logo-subtitle {
          font-size: 14px;
          opacity: 0.9;
          font-weight: 300;
        }
        .header h1 { 
          font-size: 24px; 
          margin-top: 20px;
          font-weight: 600;
        }
        .content { 
          padding: 40px 30px; 
          background-color: #ffffff;
        }
        .greeting {
          font-size: 18px;
          color: #2d3748;
          margin-bottom: 20px;
          font-weight: 500;
        }
        .main-message {
          font-size: 16px;
          color: #4a5568;
          margin-bottom: 30px;
          line-height: 1.7;
        }
        .info-box { 
          background: linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%);
          border: 1px solid #fc8181;
          border-left: 5px solid #f56565;
          padding: 25px; 
          margin: 30px 0; 
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(245, 101, 101, 0.1);
        }
        .info-box h3 {
          color: #c53030;
          font-size: 18px;
          margin-bottom: 15px;
          font-weight: 600;
        }
        .info-item {
          color: #2d3748;
          margin-bottom: 10px;
          font-size: 15px;
        }
        .info-item strong {
          color: #1a202c;
          font-weight: 600;
        }
        .button {
          display: inline-block;
          padding: 14px 28px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }
        .support-message {
          background: #f7fafc;
          padding: 20px;
          border-radius: 8px;
          margin: 30px 0;
          border-left: 4px solid #4299e1;
        }
        .support-message h4 {
          color: #2b6cb0;
          margin-bottom: 10px;
          font-size: 16px;
        }
        .support-message p {
          color: #4a5568;
          font-size: 14px;
          line-height: 1.6;
        }
        .support-message ul {
          color: #4a5568;
          font-size: 14px;
          line-height: 1.8;
          margin-left: 20px;
          margin-top: 10px;
        }
        .footer {
          background: #2d3748;
          color: #cbd5e0;
          padding: 30px;
          text-align: center;
          font-size: 13px;
        }
        .footer-brand {
          font-size: 18px;
          font-weight: 700;
          color: white;
          margin-bottom: 10px;
        }
        .social-links {
          margin: 15px 0;
        }
        .social-links a {
          color: #cbd5e0;
          text-decoration: none;
          margin: 0 5px;
        }
        .footer-disclaimer {
          margin-top: 15px;
          font-size: 11px;
          color: #718096;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div class="header-content">
            <div class="logo">🏥 HealthCare Pro</div>
            <div class="logo-subtitle">Your Trusted Healthcare Partner</div>
            <h1>Appointment Update</h1>
          </div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello ${patientName},
          </div>
          
          <div class="main-message">
            We regret to inform you that your appointment with Dr. ${doctorName} has been cancelled. We sincerely apologize for any inconvenience this may cause.
          </div>
          
          <div class="info-box">
            <h3>📅 Appointment Details</h3>
            <div class="info-item">
              <strong>Doctor:</strong> Dr. ${doctorName}
            </div>
            <div class="info-item">
              <strong>Original Date & Time:</strong> ${appointmentDate}
            </div>
            <div class="info-item">
              <strong>Status:</strong> Cancelled ❌
            </div>
            ${reason ? `
            <div class="info-item">
              <strong>Reason:</strong> ${reason}
            </div>
            ` : ''}
          </div>
          
          <div class="support-message">
            <h4>🔄 Next Steps</h4>
            <p>
              We apologize for any inconvenience this may cause. Please feel free to:
            </p>
            <ul>
              <li>Schedule a new appointment with Dr. ${doctorName}</li>
              <li>Choose a different doctor if needed</li>
              <li>Contact us for assistance with rescheduling</li>
              <li>Explore our other available time slots</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" class="button">📅 Schedule New Appointment</a>
          </div>
          
          <div class="support-message">
            <h4>💬 We're Here to Help</h4>
            <p>
              If you have any questions or need immediate assistance, please don't hesitate to contact our support team. We're available 24/7 to help you reschedule and ensure you receive the care you need.
            </p>
          </div>
          
          <div class="main-message" style="text-align: center; font-weight: 500; color: #2d3748;">
            Thank you for your understanding and patience. 🌟
          </div>
          
          <div class="footer">
            <div class="footer-brand">HealthCare Pro</div>
            <p>Your health is our priority. We're committed to providing you with the best possible care.</p>
            <div class="social-links">
              <a href="#">Website</a> • 
              <a href="#">Support</a> • 
              <a href="#">Privacy Policy</a>
            </div>
            <div class="footer-disclaimer">
              This is an automated message from HealthCare Pro. Please do not reply to this email.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
    HealthCare Pro - Appointment Update
    
    Hello ${patientName},
    
    We regret to inform you that your appointment with Dr. ${doctorName} has been cancelled. We sincerely apologize for any inconvenience this may cause.
    
    APPOINTMENT DETAILS:
    - Doctor: Dr. ${doctorName}
    - Date & Time: ${appointmentDate}
    - Status: Cancelled
    ${reason ? `- Reason: ${reason}` : ''}
    
    NEXT STEPS:
    We apologize for any inconvenience this may cause. Please feel free to:
    - Schedule a new appointment with Dr. ${doctorName}
    - Choose a different doctor if needed
    - Contact us for assistance with rescheduling
    - Explore our other available time slots
    
    WE'RE HERE TO HELP:
    If you have any questions or need immediate assistance, please don't hesitate to contact our support team. We're available 24/7 to help you reschedule and ensure you receive the care you need.
    
    Thank you for your understanding and patience.
    
    Best regards,
    HealthCare Pro Team
    Your Trusted Healthcare Partner
  `
  
  return { subject, html, text }
}

export const createAppointmentRescheduledEmail = (patientName: string, doctorName: string, oldDate: string, newDate: string, meetingUrl?: string): EmailTemplate => {
  const subject = `Appointment Rescheduled - HealthCare Pro`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Rescheduled - HealthCare Pro</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #2d3748; 
          background-color: #f7fafc;
        }
        .email-container { 
          max-width: 650px; 
          margin: 0 auto; 
          background-color: #ffffff;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          border-radius: 12px;
          overflow: hidden;
        }
        .header { 
          background: linear-gradient(135deg, #f6ad55 0%, #ed8936 100%);
          color: white; 
          padding: 40px 30px; 
          text-align: center; 
          position: relative;
        }
        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
          opacity: 0.3;
        }
        .header-content { position: relative; z-index: 1; }
        .logo { 
          font-size: 28px; 
          font-weight: 700; 
          margin-bottom: 10px;
          letter-spacing: -0.5px;
        }
        .logo-subtitle {
          font-size: 14px;
          opacity: 0.9;
          font-weight: 300;
        }
        .header h1 { 
          font-size: 24px; 
          margin-top: 20px;
          font-weight: 600;
        }
        .content { 
          padding: 40px 30px; 
          background-color: #ffffff;
        }
        .greeting {
          font-size: 18px;
          color: #2d3748;
          margin-bottom: 20px;
          font-weight: 500;
        }
        .main-message {
          font-size: 16px;
          color: #4a5568;
          margin-bottom: 30px;
          line-height: 1.7;
        }
        .info-box { 
          background: linear-gradient(135deg, #feebc8 0%, #fbd38d 100%);
          border: 1px solid #f6ad55;
          border-left: 5px solid #ed8936;
          padding: 25px; 
          margin: 30px 0; 
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(237, 137, 54, 0.1);
        }
        .info-box h3 {
          color: #c05621;
          font-size: 18px;
          margin-bottom: 15px;
          font-weight: 600;
        }
        .info-item {
          color: #2d3748;
          margin-bottom: 10px;
          font-size: 15px;
        }
        .info-item strong {
          color: #1a202c;
          font-weight: 600;
        }
        .change-item {
          background: #fff5e6;
          padding: 15px;
          border-radius: 6px;
          margin: 15px 0;
          border-left: 3px solid #ed8936;
        }
        .change-item .old {
          color: #c05621;
          text-decoration: line-through;
          font-size: 14px;
        }
        .change-item .new {
          color: #2f855a;
          font-weight: 600;
          font-size: 16px;
          margin-top: 5px;
        }
        .button {
          display: inline-block;
          padding: 14px 28px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }
        .support-message {
          background: #f7fafc;
          padding: 20px;
          border-radius: 8px;
          margin: 30px 0;
          border-left: 4px solid #4299e1;
        }
        .support-message h4 {
          color: #2b6cb0;
          margin-bottom: 10px;
          font-size: 16px;
        }
        .support-message p {
          color: #4a5568;
          font-size: 14px;
          line-height: 1.6;
        }
        .footer {
          background: #2d3748;
          color: #cbd5e0;
          padding: 30px;
          text-align: center;
          font-size: 13px;
        }
        .footer-brand {
          font-size: 18px;
          font-weight: 700;
          color: white;
          margin-bottom: 10px;
        }
        .social-links {
          margin: 15px 0;
        }
        .social-links a {
          color: #cbd5e0;
          text-decoration: none;
          margin: 0 5px;
        }
        .footer-disclaimer {
          margin-top: 15px;
          font-size: 11px;
          color: #718096;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div class="header-content">
            <div class="logo">🏥 HealthCare Pro</div>
            <div class="logo-subtitle">Your Trusted Healthcare Partner</div>
            <h1>Appointment Rescheduled</h1>
          </div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello ${patientName},
          </div>
          
          <div class="main-message">
            Your appointment with Dr. ${doctorName} has been rescheduled. Please review the updated details below.
          </div>
          
          <div class="info-box">
            <h3>🔄 Appointment Change</h3>
            <div class="info-item">
              <strong>Doctor:</strong> Dr. ${doctorName}
            </div>
            <div class="change-item">
              <div class="old">
                <strong>Previous Date & Time:</strong> ${oldDate}
              </div>
              <div class="new">
                <strong>New Date & Time:</strong> ${newDate}
              </div>
            </div>
            ${meetingUrl ? `
            <div class="info-item" style="margin-top: 15px;">
              <strong>Meeting Link:</strong> <a href="${meetingUrl}" style="color: #4299e1; text-decoration: underline;">Join Video Call</a>
            </div>
            ` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            ${meetingUrl ? `
              <a href="${meetingUrl}" class="button">📹 Join Video Call</a>
            ` : `
              <a href="#" class="button">📅 View Appointment Details</a>
            `}
          </div>
          
          <div class="support-message">
            <h4>💡 Important Reminders</h4>
            <p>
              Please make a note of your new appointment time. If this is a video consultation, make sure you have a stable internet connection and a quiet, private space. 
              ${meetingUrl ? 'Click the link above to join when it\'s time for your appointment.' : 'Our team will contact you with additional details if needed.'}
            </p>
          </div>
          
          <div class="main-message" style="text-align: center; font-weight: 500; color: #2d3748;">
            We apologize for any inconvenience and look forward to seeing you at your rescheduled appointment! 🌟
          </div>
          
          <div class="footer">
            <div class="footer-brand">HealthCare Pro</div>
            <p>Your health is our priority. We're committed to providing you with the best possible care.</p>
            <div class="social-links">
              <a href="#">Website</a> • 
              <a href="#">Support</a> • 
              <a href="#">Privacy Policy</a>
            </div>
            <div class="footer-disclaimer">
              This is an automated message from HealthCare Pro. Please do not reply to this email.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
    HealthCare Pro - Appointment Rescheduled
    
    Hello ${patientName},
    
    Your appointment with Dr. ${doctorName} has been rescheduled. Please review the updated details below.
    
    APPOINTMENT CHANGE:
    - Doctor: Dr. ${doctorName}
    - Previous Date & Time: ${oldDate}
    - New Date & Time: ${newDate}
    ${meetingUrl ? `- Meeting Link: ${meetingUrl}` : ''}
    
    ${meetingUrl ? `\nTo join your video call, click here: ${meetingUrl}` : ''}
    
    IMPORTANT REMINDERS:
    Please make a note of your new appointment time. If this is a video consultation, make sure you have a stable internet connection and a quiet, private space.
    
    We apologize for any inconvenience and look forward to seeing you at your rescheduled appointment!
    
    Best regards,
    HealthCare Pro Team
    Your Trusted Healthcare Partner
  `
  
  return { subject, html, text }
}

export const sendEmail = async (to: string, template: EmailTemplate): Promise<{ success: boolean; error?: any }> => {
  try {
    // If running on server-side, use SMTP service directly
    if (typeof window === 'undefined') {
      const { smtpEmailService } = await import('./smtp')
      const emailResult = await smtpEmailService.sendEmail({
        to,
        subject: template.subject,
        html: template.html,
        text: template.text
      })
      
      if (!emailResult.success) {
        console.error('Error sending email:', emailResult.error)
        return { success: false, error: emailResult.error }
      }
      
      console.log('Email sent successfully via SMTP')
      return { success: true, error: null }
    }
    
    // Client-side: use API endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const apiUrl = `${baseUrl}/api/send-email`
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject: template.subject,
        html: template.html,
        text: template.text
      })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Error sending email:', result.error)
      return { success: false, error: result.error }
    }

    console.log('Email sent successfully:', result.message)
    return { success: true, error: null }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error }
  }
}

export const sendAppointmentStatusEmail = async (
  patientEmail: string,
  patientName: string,
  doctorName: string,
  appointmentDate: string,
  status: 'accepted' | 'rejected',
  meetingUrl?: string,
  reason?: string
) => {
  let template: EmailTemplate

  if (status === 'accepted') {
    template = createAppointmentAcceptedEmail(patientName, doctorName, appointmentDate, meetingUrl)
  } else {
    template = createAppointmentRejectedEmail(patientName, doctorName, appointmentDate, reason)
  }

  return await sendEmail(patientEmail, template)
}

export const sendAppointmentRescheduledEmail = async (
  patientEmail: string,
  patientName: string,
  doctorName: string,
  oldDate: string,
  newDate: string,
  meetingUrl?: string
) => {
  const template = createAppointmentRescheduledEmail(patientName, doctorName, oldDate, newDate, meetingUrl)
  return await sendEmail(patientEmail, template)
}

export const createDoctorApplicationNotificationEmail = (doctorData: {
  firstName: string
  lastName: string
  email: string
  specialty: string
  licenseNumber: string
  phone?: string
  bio?: string
  experienceYears?: number
  education?: string
  languages?: string[]
  insuranceAccepted?: string[]
  consultationFee?: number
}): EmailTemplate => {
  const subject = `New Doctor Application - ${doctorData.firstName} ${doctorData.lastName}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Doctor Application - HealthCare Pro</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #2d3748; 
          background-color: #f7fafc;
        }
        .email-container { 
          max-width: 650px; 
          margin: 0 auto; 
          background-color: #ffffff;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          border-radius: 12px;
          overflow: hidden;
        }
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white; 
          padding: 40px 30px; 
          text-align: center; 
        }
        .header h1 { 
          font-size: 24px; 
          margin-top: 10px;
          font-weight: 600;
        }
        .content { 
          padding: 40px 30px; 
          background-color: #ffffff;
        }
        .info-box { 
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-left: 5px solid #667eea;
          padding: 25px; 
          margin: 20px 0; 
          border-radius: 8px;
        }
        .info-box h3 {
          color: #2d3748;
          font-size: 18px;
          margin-bottom: 15px;
          font-weight: 600;
        }
        .info-item {
          color: #4a5568;
          margin-bottom: 10px;
          font-size: 15px;
        }
        .info-item strong {
          color: #1a202c;
          font-weight: 600;
        }
        .button {
          display: inline-block;
          padding: 14px 28px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin-top: 20px;
        }
        .footer {
          background: #2d3748;
          color: #cbd5e0;
          padding: 30px;
          text-align: center;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>New Doctor Application Received</h1>
        </div>
        
        <div class="content">
          <p style="font-size: 16px; color: #2d3748; margin-bottom: 20px;">
            A new doctor has submitted an application that requires your review.
          </p>
          
          <div class="info-box">
            <h3>Doctor Information</h3>
            <div class="info-item"><strong>Name:</strong> Dr. ${doctorData.firstName} ${doctorData.lastName}</div>
            <div class="info-item"><strong>Email:</strong> ${doctorData.email}</div>
            <div class="info-item"><strong>Specialty:</strong> ${doctorData.specialty}</div>
            <div class="info-item"><strong>License Number:</strong> ${doctorData.licenseNumber}</div>
            ${doctorData.phone ? `<div class="info-item"><strong>Phone:</strong> ${doctorData.phone}</div>` : ''}
            ${doctorData.experienceYears ? `<div class="info-item"><strong>Years of Experience:</strong> ${doctorData.experienceYears}</div>` : ''}
            ${doctorData.consultationFee ? `<div class="info-item"><strong>Consultation Fee:</strong> $${(doctorData.consultationFee / 100).toFixed(2)}</div>` : ''}
          </div>
          
          ${doctorData.bio ? `
          <div class="info-box">
            <h3>Professional Bio</h3>
            <p style="color: #4a5568; line-height: 1.7;">${doctorData.bio}</p>
          </div>
          ` : ''}
          
          ${doctorData.education ? `
          <div class="info-box">
            <h3>Education & Qualifications</h3>
            <p style="color: #4a5568; line-height: 1.7;">${doctorData.education}</p>
          </div>
          ` : ''}
          
          ${doctorData.languages && doctorData.languages.length > 0 ? `
          <div class="info-box">
            <h3>Languages Spoken</h3>
            <p style="color: #4a5568;">${doctorData.languages.join(', ')}</p>
          </div>
          ` : ''}
          
          ${doctorData.insuranceAccepted && doctorData.insuranceAccepted.length > 0 ? `
          <div class="info-box">
            <h3>Insurance Accepted</h3>
            <p style="color: #4a5568;">${doctorData.insuranceAccepted.join(', ')}</p>
          </div>
          ` : ''}
          
          <p style="margin-top: 30px; font-size: 14px; color: #718096;">
            Please review this application in the admin panel and approve or reject accordingly.
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from HealthCare Pro Admin System.</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
    New Doctor Application - HealthCare Pro
    
    A new doctor has submitted an application that requires your review.
    
    DOCTOR INFORMATION:
    - Name: Dr. ${doctorData.firstName} ${doctorData.lastName}
    - Email: ${doctorData.email}
    - Specialty: ${doctorData.specialty}
    - License Number: ${doctorData.licenseNumber}
    ${doctorData.phone ? `- Phone: ${doctorData.phone}\n` : ''}
    ${doctorData.experienceYears ? `- Years of Experience: ${doctorData.experienceYears}\n` : ''}
    ${doctorData.consultationFee ? `- Consultation Fee: $${(doctorData.consultationFee / 100).toFixed(2)}\n` : ''}
    
    ${doctorData.bio ? `PROFESSIONAL BIO:\n${doctorData.bio}\n\n` : ''}
    ${doctorData.education ? `EDUCATION & QUALIFICATIONS:\n${doctorData.education}\n\n` : ''}
    ${doctorData.languages && doctorData.languages.length > 0 ? `LANGUAGES SPOKEN:\n${doctorData.languages.join(', ')}\n\n` : ''}
    ${doctorData.insuranceAccepted && doctorData.insuranceAccepted.length > 0 ? `INSURANCE ACCEPTED:\n${doctorData.insuranceAccepted.join(', ')}\n\n` : ''}
    
    Please review this application in the admin panel and approve or reject accordingly.
  `
  
  return { subject, html, text }
}

export const sendAdminNotification = async (
  subject: string,
  message: string,
  details?: Record<string, any>
): Promise<{ success: boolean; error?: any }> => {
  const adminEmail = process.env.ADMIN_EMAIL
  
  if (!adminEmail) {
    console.warn('⚠️ ADMIN_EMAIL not configured. Skipping admin notification.')
    return { success: false, error: 'ADMIN_EMAIL not configured' }
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #2d3748; 
          background-color: #f7fafc;
        }
        .email-container { 
          max-width: 650px; 
          margin: 0 auto; 
          background-color: #ffffff;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          border-radius: 12px;
          overflow: hidden;
        }
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white; 
          padding: 40px 30px; 
          text-align: center; 
        }
        .header h1 { 
          font-size: 24px; 
          font-weight: 600;
        }
        .content { 
          padding: 40px 30px; 
          background-color: #ffffff;
        }
        .message {
          font-size: 16px;
          color: #2d3748;
          margin-bottom: 20px;
          line-height: 1.7;
        }
        .details-box { 
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-left: 5px solid #667eea;
          padding: 25px; 
          margin: 20px 0; 
          border-radius: 8px;
        }
        .details-box h3 {
          color: #2d3748;
          font-size: 18px;
          margin-bottom: 15px;
          font-weight: 600;
        }
        .detail-item {
          color: #4a5568;
          margin-bottom: 10px;
          font-size: 15px;
        }
        .detail-item strong {
          color: #1a202c;
          font-weight: 600;
        }
        .footer {
          background: #2d3748;
          color: #cbd5e0;
          padding: 30px;
          text-align: center;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>${subject}</h1>
        </div>
        
        <div class="content">
          <div class="message">
            ${message.replace(/\n/g, '<br>')}
          </div>
          
          ${details && Object.keys(details).length > 0 ? `
          <div class="details-box">
            <h3>Details</h3>
            ${Object.entries(details).map(([key, value]) => `
              <div class="detail-item">
                <strong>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> ${value}
              </div>
            `).join('')}
          </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <p>This is an automated notification from HealthCare Pro Admin System.</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
    ${subject}
    
    ${message}
    
    ${details && Object.keys(details).length > 0 ? `
    DETAILS:
    ${Object.entries(details).map(([key, value]) => `- ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${value}`).join('\n')}
    ` : ''}
  `
  
  const template: EmailTemplate = { subject, html, text }
  return await sendEmail(adminEmail, template)
}

export const sendDoctorApplicationNotification = async (doctorData: {
  firstName: string
  lastName: string
  email: string
  specialty: string
  licenseNumber: string
  phone?: string
  bio?: string
  experienceYears?: number
  education?: string
  languages?: string[]
  insuranceAccepted?: string[]
  consultationFee?: number
}): Promise<{ success: boolean; error?: any }> => {
  const template = createDoctorApplicationNotificationEmail(doctorData)
  const adminEmail = process.env.ADMIN_EMAIL
  
  if (!adminEmail) {
    console.warn('⚠️ ADMIN_EMAIL not configured. Skipping doctor application notification.')
    return { success: false, error: 'ADMIN_EMAIL not configured' }
  }
  
  return await sendEmail(adminEmail, template)
}
