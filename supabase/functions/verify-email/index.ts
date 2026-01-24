import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/send-email.ts'
import { welcomeEmail } from '../_shared/email-templates.ts'

const SITE_URL = 'https://proofworks.cc'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': `${SITE_URL}/verify-error.html` }
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Find subscriber with this verification token
  const { data: subscriber, error: fetchError } = await supabase
    .from('subscribers')
    .select('id, email, email_frequency, verification_token_expires_at, email_verified, preferences_token, unsubscribe_token')
    .eq('verification_token', token)
    .single()

  if (fetchError || !subscriber) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': `${SITE_URL}/verify-error.html` }
    })
  }

  // Check if already verified
  if (subscriber.email_verified) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': `${SITE_URL}/already-verified.html` }
    })
  }

  // Check if token has expired
  if (subscriber.verification_token_expires_at) {
    const expiresAt = new Date(subscriber.verification_token_expires_at)
    if (expiresAt < new Date()) {
      return new Response(null, {
        status: 302,
        headers: { 'Location': `${SITE_URL}/verify-error.html` }
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
    return new Response(null, {
      status: 302,
      headers: { 'Location': `${SITE_URL}/verify-error.html` }
    })
  }

  // Send welcome email
  const preferencesUrl = `${SITE_URL}/preferences.html?token=${subscriber.preferences_token}`
  const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?token=${subscriber.unsubscribe_token}`
  const welcomeHtml = welcomeEmail(subscriber.email_frequency, preferencesUrl, unsubscribeUrl)

  const emailResult = await sendEmail({
    to: subscriber.email,
    subject: 'Welcome to AI Verification Documents',
    html: welcomeHtml
  })

  if (!emailResult.success) {
    console.error('Failed to send welcome email:', emailResult.error)
  }

  // Redirect to success page on the main site
  return new Response(null, {
    status: 302,
    headers: { 'Location': `${SITE_URL}/verified.html` }
  })
})
