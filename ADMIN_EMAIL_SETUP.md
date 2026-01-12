# Admin Email Configuration

This document describes how to configure admin email notifications for the system.

## Required Environment Variable

Add the following environment variable to your `.env.local` or `.env` file:

```bash
ADMIN_EMAIL=lamonicahodges@gmail.com
```

## What Notifications Are Sent

The following notifications are sent to the admin email:

1. **Doctor Application Notifications**: When a new doctor submits an application, the admin receives a detailed email with all the doctor's information including:
   - Name and contact information
   - Specialty and license number
   - Professional bio and education
   - Languages spoken
   - Insurance accepted
   - Consultation fee

2. **Appointment Creation Notifications**: When a new appointment is created, the admin receives a notification with:
   - Appointment ID
   - Doctor information
   - Patient information
   - Date & time
   - Visit type and service type
   - Status

## Setup Instructions

1. Create or edit your `.env.local` file in the root directory
2. Add the `ADMIN_EMAIL` variable with your email address:
   ```
   ADMIN_EMAIL=lamonicahodges@gmail.com
   ```
3. Ensure your SMTP configuration is properly set up (see SMTP configuration in your existing setup)
4. Restart your development server or redeploy your application for changes to take effect

## Note

If `ADMIN_EMAIL` is not configured, the system will log a warning but continue to function normally. Admin notifications will simply not be sent.

