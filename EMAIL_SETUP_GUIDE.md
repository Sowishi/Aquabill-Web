# Email Setup Guide for AquaBill

This guide will help you set up email functionality to send temporary passwords to new users.

## Current Implementation

The `Household.jsx` component now:
- ✅ Generates a 6-digit numeric temporary password (easy to remember)
- ✅ Saves user data to Firestore (without Firebase Auth)
- ✅ Automatically assigns "resident" role to new users
- ✅ Has email sending structure ready
- ⚠️ Email sending needs to be configured

## Option 1: Using EmailJS (Easiest - Client Side)

EmailJS is a free service that allows sending emails directly from the browser.

### Steps:

1. **Sign up at [EmailJS](https://www.emailjs.com/)**
   - Create a free account
   - You get 200 emails/month for free

2. **Set up Email Service**
   - Go to Email Services → Add New Service
   - Connect your email (Gmail, Outlook, etc.)
   - Note your `Service ID`

3. **Create Email Template**
   - Go to Email Templates → Create New Template
   - Template content:
     ```
     Hello {{to_name}},

     Your AquaBill account has been created!

     Login Credentials:
     Email: {{to_email}}
     Temporary Password: {{temporary_password}} (6-digit numeric code)

     Please log in and change your password immediately.

     Best regards,
     AquaBill Team
     ```
   - Note your `Template ID`

4. **Get Public Key**
   - Go to Account → API Keys
   - Copy your `Public Key`

5. **Update the code in `Household.jsx`**
   
   Uncomment lines 128-145 and replace the placeholders:
   ```javascript
   const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       service_id: 'YOUR_SERVICE_ID',        // Replace with your Service ID
       template_id: 'YOUR_TEMPLATE_ID',      // Replace with your Template ID
       user_id: 'YOUR_PUBLIC_KEY',           // Replace with your Public Key
       template_params: emailData
     })
   });
   ```

## Option 2: Backend Email Service (Recommended for Production)

For better security and more control, use a backend service.

### Option 2A: Firebase Cloud Functions

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init functions
   ```

2. **Install email package**
   ```bash
   cd functions
   npm install nodemailer
   ```

3. **Create Cloud Function** (`functions/index.js`):
   ```javascript
   const functions = require('firebase-functions');
   const nodemailer = require('nodemailer');

   // Configure your email service
   const transporter = nodemailer.createTransport({
     service: 'gmail',
     auth: {
       user: 'your-email@gmail.com',
       pass: 'your-app-password'
     }
   });

   exports.sendTemporaryPassword = functions.https.onCall(async (data, context) => {
     const { email, fullName, temporaryPassword } = data;

     const mailOptions = {
       from: 'AquaBill <your-email@gmail.com>',
       to: email,
       subject: 'Your AquaBill Account - Temporary Password',
       html: `
         <h2>Welcome to AquaBill, ${fullName}!</h2>
         <p>Your account has been created successfully.</p>
         <p><strong>Login Credentials:</strong></p>
         <ul>
           <li>Email: ${email}</li>
           <li>Temporary Password: ${temporaryPassword}</li>
         </ul>
         <p>Please log in and change your password immediately.</p>
         <p>Best regards,<br>AquaBill Team</p>
       `
     };

     await transporter.sendMail(mailOptions);
     return { success: true };
   });
   ```

4. **Deploy the function**
   ```bash
   firebase deploy --only functions
   ```

5. **Update `Household.jsx`** - Replace the `sendTemporaryPasswordEmail` function:
   ```javascript
   import { getFunctions, httpsCallable } from 'firebase/functions';

   const sendTemporaryPasswordEmail = async (email, fullName, tempPassword) => {
     const functions = getFunctions();
     const sendEmail = httpsCallable(functions, 'sendTemporaryPassword');
     await sendEmail({ email, fullName, temporaryPassword: tempPassword });
   };
   ```

### Option 2B: SendGrid API

1. **Sign up at [SendGrid](https://sendgrid.com/)**
   - Free tier: 100 emails/day

2. **Get API Key**
   - Go to Settings → API Keys
   - Create an API key

3. **Create a backend endpoint** (Node.js example):
   ```javascript
   const sgMail = require('@sendgrid/mail');
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);

   app.post('/send-email', async (req, res) => {
     const { to_email, to_name, temporary_password } = req.body;

     const msg = {
       to: to_email,
       from: 'noreply@aquabill.com',
       subject: 'Your AquaBill Account - Temporary Password',
       text: `Hello ${to_name}...`,
       html: '<strong>...</strong>',
     };

     await sgMail.send(msg);
     res.json({ success: true });
   });
   ```

4. **Update `Household.jsx`** - Update the fetch URL in lines 148-154

## Option 3: Gmail with App Password (Quick Testing)

For development/testing only:

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password
3. Use the backend approach (Option 2A) with your Gmail credentials

## Security Notes

⚠️ **Important:**
- Never expose API keys in client-side code
- Use environment variables for sensitive data
- For production, always use a backend service
- Consider encrypting temporary passwords in Firestore
- Implement password expiration

## Firestore Data Structure

Each user document in the `users` collection contains:
```javascript
{
  fullName: "John Doe",
  email: "john@example.com",
  contactNumber: "+1234567890",
  gender: "Male",
  age: 30,
  meterNumber: "MTR-12345",
  temporaryPassword: "123456",  // 6-digit numeric code
  passwordChanged: false,
  role: "resident",             // Automatically assigned
  createdAt: "2025-10-31T...",
  status: "active"
}
```

## Current Behavior

Currently, the app will:
- ✅ Create the user in Firestore with role "resident"
- ✅ Generate a 6-digit numeric temporary password (e.g., 123456)
- ⚠️ Log email data to console (for testing)
- ✅ Show the temporary password in the success message
- ✅ Display user role in the users table

Choose one of the options above to enable actual email sending!

