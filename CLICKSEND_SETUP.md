# ClickSend SMS Integration Setup Guide

This guide will help you set up ClickSend for SMS functionality in the doctor panel application.

## Step 1: Create a ClickSend Account

1. Visit [ClickSend's website](https://www.clicksend.com/)
2. Click on **"Sign Up"** or **"Get Started"** to create a new account
3. Complete the registration process with your email address and password
4. Verify your email address if required

## Step 2: Get Your API Credentials

1. **Log in** to your ClickSend account
2. Click on your **profile/account icon** at the top right corner
3. Navigate to **"API Credentials"** or **"API Settings"** from the dropdown menu
4. You will see:
   - **API Username**: Your ClickSend username (usually your account email or a custom username)
   - **API Key**: Your API key (a long alphanumeric string)

   **Important**: Copy both values and keep them secure. The API key is sensitive and should not be shared.

## Step 3: Get a Sender ID (Optional but Recommended)

1. In your ClickSend dashboard, go to **"SMS"** → **"Sender IDs"**
2. You can either:
   - **Use a default sender ID**: ClickSend provides a default sender ID
   - **Register a custom sender ID**: For better branding, register your own sender ID (may require verification depending on your country)
3. Note down your sender ID (it will be used in the `CLICKSEND_SENDER_ID` environment variable)

## Step 4: Add Credits to Your Account

1. Go to **"Billing"** or **"Account"** → **"Top Up"**
2. Add credits to your account (ClickSend uses a pay-as-you-go model)
3. Credits are used when sending SMS messages

## Step 5: Configure Environment Variables

Add the following environment variables to your `.env.local` file (or your deployment environment):

```env
# ClickSend SMS Configuration
CLICKSEND_USERNAME=your_username_here
CLICKSEND_API_KEY=your_api_key_here
CLICKSEND_SENDER_ID=your_sender_id_here
```

### Example:
```env
CLICKSEND_USERNAME=yourname@example.com
CLICKSEND_API_KEY=ABCD1234-5678-90EF-GHIJ-KLMNOPQRSTUV
CLICKSEND_SENDER_ID=SMS
```

**Note**: 
- Replace `your_username_here` with your actual ClickSend API username
- Replace `your_api_key_here` with your actual ClickSend API key
- Replace `your_sender_id_here` with your sender ID (or use "SMS" as default)

## Step 6: Database Migration (Optional)

If you want to track ClickSend message IDs separately from Twilio SIDs, you may need to add a new column to your `communication_history` table:

```sql
ALTER TABLE communication_history 
ADD COLUMN clicksend_message_id VARCHAR(255);
```

**Note**: This is optional. The application will work without this column, but message IDs won't be stored in the database.

## Step 7: Test Your Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the communication panel in your application
3. Try sending a test SMS to your phone number
4. Check the console logs for any errors
5. Verify that you receive the SMS message

## Troubleshooting

### Common Issues:

1. **"ClickSend Username and API Key are required"**
   - Make sure you've added `CLICKSEND_USERNAME` and `CLICKSEND_API_KEY` to your `.env.local` file
   - Restart your development server after adding environment variables

2. **"Failed to send SMS"**
   - Verify your API credentials are correct
   - Check that you have sufficient credits in your ClickSend account
   - Ensure the phone number format is correct (should include country code, e.g., +1234567890)

3. **"Invalid phone number"**
   - Phone numbers must include country code (e.g., +1 for US, +44 for UK)
   - Remove any spaces, dashes, or parentheses from the phone number
   - Format: `+[country code][number]` (e.g., +1234567890)

4. **"Network error"**
   - Check your internet connection
   - Verify ClickSend API is accessible from your server
   - Check firewall settings if deploying

## API Documentation

For more detailed API documentation, visit:
- [ClickSend API Documentation](https://developers.clicksend.com/docs)
- [ClickSend SMS API Reference](https://developers.clicksend.com/docs/rest/v3/#send-sms)

## Support

If you encounter issues:
1. Check the ClickSend dashboard for account status and credits
2. Review the application logs for detailed error messages
3. Contact ClickSend support if API-related issues persist

## Migration from Twilio

This integration replaces Twilio for SMS functionality only. Voice calls still use Twilio. Make sure to:
- Keep Twilio credentials for voice call functionality
- Only replace SMS-related environment variables with ClickSend credentials
- Test both SMS and voice calls after migration

