import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/send-email.ts'
import { welcomeEmail } from '../_shared/email-templates.ts'

const SITE_URL = 'https://proofworks.cc'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response(renderHtml('Error', 'Invalid verification link.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' }
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Find subscriber with this verification token
  const { data: subscriber, error: fetchError } = await supabase
    .from('subscribers')
    .select('id, email, email_frequency, verification_token_expires_at, email_verified, preferences_token')
    .eq('verification_token', token)
    .single()

  if (fetchError || !subscriber) {
    return new Response(renderHtml('Error', 'Invalid or expired verification link.'), {
      status: 404,
      headers: { 'Content-Type': 'text/html' }
    })
  }

  // Check if already verified
  if (subscriber.email_verified) {
    return new Response(renderHtml('Already Verified', 'Your email has already been verified. You\'re all set!'), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    })
  }

  // Check if token has expired
  if (subscriber.verification_token_expires_at) {
    const expiresAt = new Date(subscriber.verification_token_expires_at)
    if (expiresAt < new Date()) {
      return new Response(renderHtml('Link Expired', 'This verification link has expired. Please subscribe again to receive a new link.'), {
        status: 410,
        headers: { 'Content-Type': 'text/html' }
      })
    }
  }

  // Mark as verified
  const { error: updateError } = await supabase
    .from('subscribers')
    .update({
      email_verified: true,
      verified_at: new Date().toISOString(),
      verification_token: null,
      verification_token_expires_at: null,
      is_active: true
    })
    .eq('id', subscriber.id)

  if (updateError) {
    console.error('Database error:', updateError)
    return new Response(renderHtml('Error', 'Something went wrong. Please try again.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    })
  }

  // Send welcome email
  const preferencesUrl = `${SITE_URL}/preferences.html?token=${subscriber.preferences_token}`
  const welcomeHtml = welcomeEmail(subscriber.email_frequency, preferencesUrl)

  await sendEmail({
    to: subscriber.email,
    subject: 'Welcome to AI Verification Documents',
    html: welcomeHtml
  })

  return new Response(
    renderHtml('Email Verified', 'Your subscription is now active. You\'ll start receiving updates based on your chosen frequency.'),
    {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    }
  )
})

function renderHtml(title: string, message: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - AI Verification Documents</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background-color: #faf9f7;
      color: #333;
    }
    .container {
      text-align: center;
      padding: 40px;
      max-width: 400px;
    }
    h1 {
      color: #5b8a8a;
      margin-bottom: 16px;
    }
    p {
      color: #666;
      line-height: 1.6;
    }
    a {
      color: #5b8a8a;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background-color: #5b8a8a;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin-top: 16px;
    }
    .btn:hover {
      background-color: #4a7979;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${SITE_URL}" class="btn">Browse Documents</a>
  </div>
</body>
</html>
  `
}
