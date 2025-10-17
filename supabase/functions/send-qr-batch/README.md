# Supabase Edge Function: send-qr-batch

This Edge Function sends QR codes to students assigned to a session via email.

## Setup

1. Deploy the function to Supabase:
```bash
supabase functions deploy send-qr-batch
```

2. Set up environment variables in Supabase Dashboard:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key

## Usage

The function expects a POST request with:
```json
{
  "session_id": "uuid",
  "origin": "https://yourdomain.com"
}
```

## Response

Returns:
```json
{
  "success": true,
  "message": "Prepared X emails for session: Session Name",
  "emails": [
    {
      "to": "student@example.com",
      "subject": "QR Code for Session Name - Student Name"
    }
  ]
}
```

## Email Integration

To actually send emails, integrate with an email service:

1. **Resend** (Recommended):
```typescript
import { Resend } from 'https://esm.sh/resend@0.15.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

for (const email of emails) {
  await resend.emails.send({
    from: 'attendance@yourdomain.com',
    to: email.to,
    subject: email.subject,
    html: email.html,
  })
}
```

2. **SendGrid**:
```typescript
import sgMail from 'https://esm.sh/@sendgrid/mail@7.7.0'

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

## Security

- Requires authentication via Authorization header
- Validates session ownership
- Only sends emails to assigned students
- CORS enabled for web requests
