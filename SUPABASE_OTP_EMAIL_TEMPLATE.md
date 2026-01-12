# Supabase OTP Email Template Configuration

## Overview
This guide explains how to configure Supabase to send OTP (One-Time Password) codes instead of magic links for email authentication.

## Important Configuration Steps

### 1. Access Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Find the **"Magic Link"** or **"OTP"** template

### 2. Configure Email Template for OTP

The key difference between Magic Link and OTP:
- **Magic Link**: Contains a clickable link that automatically logs in the user
- **OTP**: Contains a 6-digit code that the user must enter manually

### 3. Email Template Configuration

In your Supabase dashboard, you need to configure the **OTP** email template. Here's the correct template:

#### Subject Line:
```
Your OTP Code for Doctor Panel Login
```

#### Email Body (HTML):
```html
<h2>Your OTP Code</h2>
<p>Hello,</p>
<p>You requested a one-time password (OTP) to sign in to your doctor panel account.</p>
<p><strong>Your OTP code is: {{ .Token }}</strong></p>
<p>This code will expire in 60 minutes.</p>
<p>If you didn't request this code, please ignore this email.</p>
<p>Best regards,<br>Doctor Panel Team</p>
```

#### Email Body (Plain Text):
```
Your OTP Code

Hello,

You requested a one-time password (OTP) to sign in to your doctor panel account.

Your OTP code is: {{ .Token }}

This code will expire in 60 minutes.

If you didn't request this code, please ignore this email.

Best regards,
Doctor Panel Team
```

### 4. Key Template Variables

- `{{ .Token }}` - The 6-digit OTP code
- `{{ .Email }}` - The user's email address
- `{{ .SiteURL }}` - Your site URL

### 5. Important Settings in Supabase Dashboard

1. **Authentication Settings**:
   - Go to **Authentication** → **Settings**
   - Under **Email Auth**, ensure:
     - ✅ **Enable email confirmations** is enabled (if required)
     - ✅ **Enable email OTP** is enabled
     - ❌ **Disable magic link** (or keep it disabled if you only want OTP)

2. **Email Provider Settings**:
   - Ensure your email provider (SMTP) is configured correctly
   - Test the email sending functionality

### 6. Code Configuration

The code has been updated to:
- Use `signInWithOtp()` **without** `emailRedirectTo` option
- This ensures Supabase sends an OTP code instead of a magic link
- The OTP is verified using `verifyOtp()` with type `'email'`

### 7. Testing

1. Go to the login page
2. Select "OTP Code" method
3. Enter your email
4. Click "Send OTP Code"
5. Check your email for the 6-digit code
6. Enter the code in the verification form
7. Click "Verify OTP"

### 8. Troubleshooting

**Issue**: Still receiving magic links instead of OTP codes
- **Solution**: Check that `emailRedirectTo` is NOT included in the `signInWithOtp()` options
- Verify the email template in Supabase dashboard uses `{{ .Token }}` instead of a link

**Issue**: OTP code not received
- **Solution**: 
  - Check spam folder
  - Verify SMTP configuration in Supabase
  - Check Supabase logs for email sending errors
  - Ensure email provider is properly configured

**Issue**: OTP code invalid
- **Solution**:
  - Ensure code is entered within 60 minutes (default expiry)
  - Check that code is exactly 6 digits
  - Verify the code hasn't been used already (OTP codes are single-use)

## Password Reset OTP Email Template

For password reset functionality, you can use the same OTP template or create a separate one. The template should be similar:

#### Subject Line:
```
Password Reset OTP Code - Doctor Panel
```

#### Email Body (HTML):
```html
<h2>Password Reset Request</h2>
<p>Hello,</p>
<p>You requested to reset your password for your doctor panel account.</p>
<p><strong>Your OTP code is: {{ .Token }}</strong></p>
<p>This code will expire in 60 minutes.</p>
<p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
<p>Best regards,<br>Doctor Panel Team</p>
```

#### Email Body (Plain Text):
```
Password Reset Request

Hello,

You requested to reset your password for your doctor panel account.

Your OTP code is: {{ .Token }}

This code will expire in 60 minutes.

If you didn't request a password reset, please ignore this email and your password will remain unchanged.

Best regards,
Doctor Panel Team
```

### Password Reset Flow

1. User clicks "Forgot Password" on login page
2. User enters email address
3. System sends OTP code to email
4. User enters OTP code to verify
5. User sets new password
6. User is automatically signed out and redirected to login

## Notes

- OTP codes typically expire after 60 minutes (configurable in Supabase)
- Each OTP code can only be used once
- The code automatically handles resending OTP if needed
- Email validation ensures only approved doctors can receive OTP codes
- For password reset, the OTP verification temporarily signs the user in to allow password update
- After password update, the user is automatically signed out for security

