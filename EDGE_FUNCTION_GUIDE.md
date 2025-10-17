# Complete Guide: Edge Functions, Migrations & Email Integration

## 🚀 **Edge Functions - Complete Setup Guide**

### **What is an Edge Function?**
Edge Functions are serverless functions that run on Supabase's edge network. They allow you to:
- Run server-side code securely
- Access API keys without exposing them to frontend
- Send emails, process payments, integrate with external APIs

### **Why We Need It for Email**
```javascript
// ❌ This WON'T work in frontend (browser):
const response = await fetch('https://api.resend.com/emails', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }, // ❌ Exposed!
  body: JSON.stringify({ to: 'student@example.com', ... })
});

// ✅ This WORKS with Edge Function:
const response = await supabase.functions.invoke('send-qr-batch', {
  body: { session_id: 'xxx', origin: 'https://yourapp.com' }
});
```

---

## 📋 **Step-by-Step Edge Function Setup**

### **Step 1: Initialize Supabase Project**
```bash
# In your project directory
npx supabase init
```

### **Step 2: Link to Your Supabase Project**
```bash
# Get your project URL and anon key from Supabase Dashboard
npx supabase link --project-ref YOUR_PROJECT_ID
```

### **Step 3: Deploy the Function**
```bash
# Deploy the function we created
npx supabase functions deploy send-qr-batch
```

### **Step 4: Test the Function**
```bash
# Test locally
npx supabase functions serve send-qr-batch

# Test deployed function
curl -X POST 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/send-qr-batch' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"session_id": "test-session-id", "origin": "https://yourapp.com"}'
```

---

## 🗄️ **Database Migrations - Complete Guide**

### **What are Migrations?**
Migrations are SQL scripts that modify your database schema safely and version-controlled.

### **Why We Need the Migration**
Our migration makes the `password` field nullable because:
- Supabase Auth handles passwords securely
- We don't need to store plaintext passwords
- Prevents registration errors

### **Step 1: Create Migration**
```bash
# Create a new migration file
npx supabase migration new make_password_nullable
```

### **Step 2: Add Migration Content**
The migration file is already created at:
`supabase/migrations/001_make_password_nullable.sql`

### **Step 3: Apply Migration**
```bash
# Apply migration to your database
npx supabase db push
```

### **Step 4: Verify Migration**
```sql
-- Check if password field is now nullable
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'teachers' AND column_name = 'password';
-- Should show: is_nullable = 'YES'
```

---

## 📧 **Email Service Integration - Complete Guide**

### **Option 1: Resend (Recommended - Easiest)**

#### **Step 1: Sign Up**
1. Go to [resend.com](https://resend.com)
2. Sign up for free account
3. Get your API key from dashboard

#### **Step 2: Update Edge Function**
Replace the email section in `supabase/functions/send-qr-batch/index.ts`:

```typescript
// Add this import at the top
import { Resend } from 'https://esm.sh/resend@0.15.0'

// Replace the email preparation section with:
const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

// Send emails
for (const email of emails) {
  await resend.emails.send({
    from: 'attendance@yourdomain.com', // Use your verified domain
    to: email.to,
    subject: email.subject,
    html: email.html,
  })
}
```

#### **Step 3: Set Environment Variables**
In Supabase Dashboard → Settings → Edge Functions:
```
RESEND_API_KEY=re_your_api_key_here
```

#### **Step 4: Verify Domain (Optional)**
- Add your domain in Resend dashboard
- Or use their test domain: `onboarding@resend.dev`

---

### **Option 2: SendGrid**

#### **Step 1: Sign Up**
1. Go to [sendgrid.com](https://sendgrid.com)
2. Create account
3. Get API key from Settings → API Keys

#### **Step 2: Update Edge Function**
```typescript
// Add this import
import sgMail from 'https://esm.sh/@sendgrid/mail@7.7.0'

// Replace email section with:
sgMail.setApiKey(Deno.env.get('SENDGRID_API_KEY'))

for (const email of emails) {
  await sgMail.send({
    from: 'attendance@yourdomain.com',
    to: email.to,
    subject: email.subject,
    html: email.html,
  })
}
```

#### **Step 3: Set Environment Variables**
```
SENDGRID_API_KEY=SG.your_api_key_here
```

---

### **Option 3: SMTP (Custom Server)**

#### **Step 1: Update Edge Function**
```typescript
// Add SMTP configuration
const smtpConfig = {
  host: Deno.env.get('SMTP_HOST'),
  port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
  secure: false,
  auth: {
    user: Deno.env.get('SMTP_USER'),
    pass: Deno.env.get('SMTP_PASS'),
  },
}

// Use nodemailer or similar
import nodemailer from 'https://esm.sh/nodemailer@6.9.0'

const transporter = nodemailer.createTransporter(smtpConfig)

for (const email of emails) {
  await transporter.sendMail({
    from: 'attendance@yourdomain.com',
    to: email.to,
    subject: email.subject,
    html: email.html,
  })
}
```

#### **Step 2: Set Environment Variables**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

---

## 🔧 **Complete Setup Commands**

### **1. Initialize Everything**
```bash
# In your project directory
npx supabase init
npx supabase link --project-ref YOUR_PROJECT_ID
```

### **2. Apply Migration**
```bash
npx supabase db push
```

### **3. Deploy Edge Function**
```bash
npx supabase functions deploy send-qr-batch
```

### **4. Set Environment Variables**
In Supabase Dashboard → Settings → Edge Functions:
```
RESEND_API_KEY=re_your_key_here
# OR
SENDGRID_API_KEY=SG.your_key_here
# OR
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### **5. Test Everything**
```bash
# Test the complete flow:
# 1. Register teacher
# 2. Create session
# 3. Add students
# 4. Assign students to session
# 5. Click "Email QR codes to assigned"
# 6. Check email inbox
```

---

## 🎯 **Quick Start (Recommended)**

**For fastest setup, use Resend:**

1. **Sign up at resend.com** (free tier: 3,000 emails/month)
2. **Get API key** from dashboard
3. **Set environment variable** in Supabase Dashboard
4. **Deploy function**: `npx supabase functions deploy send-qr-batch`
5. **Test**: Create session → assign students → click email button

**That's it!** Your email functionality will work immediately.

---

## 🚨 **Troubleshooting**

### **Edge Function Not Working?**
```bash
# Check function logs
npx supabase functions logs send-qr-batch

# Test function locally
npx supabase functions serve send-qr-batch
```

### **Migration Failed?**
```bash
# Check migration status
npx supabase migration list

# Reset if needed
npx supabase db reset
```

### **Email Not Sending?**
1. Check API key is correct
2. Verify domain in email service dashboard
3. Check function logs for errors
4. Test with a simple email first

---

## 📊 **Cost Breakdown**

- **Resend**: Free tier (3,000 emails/month)
- **SendGrid**: Free tier (100 emails/day)
- **SMTP**: Usually free with your hosting provider
- **Supabase Edge Functions**: Free tier (500,000 requests/month)

**Total cost for small school**: $0/month
