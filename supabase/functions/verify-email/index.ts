import { sendEmail } from '../_shared/send-email.ts'
import { welcomeEmail } from '../_shared/email-templates.ts'
import { SITE_URL } from '../_shared/config.ts'
import { redirectResponse } from '../_shared/responses.ts'
import { getSupabaseClient, getSupabaseUrl } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return redirectResponse(`${SITE_URL}/verify-error.html`)
  }

  const supabaseUrl = getSupabaseUrl()
  const supabase = getSupabaseClient()

  const { data: subscriber, error: fetchError } = await supabase
    .from('subscribers')
    .select('id, email, email_frequency, verification_token_expires_at, email_verified, preferences_token, unsubscribe_token')
    .eq('verification_token', token)
    .single()

  if (fetchError || !subscriber) {
    return redirectResponse(`${SITE_URL}/verify-error.html`)
  }

  if (subscriber.email_verified) {
    return redirectResponse(`${SITE_URL}/already-verified.html`)
  }

  if (subscriber.verification_token_expires_at) {
    const expiresAt = new Date(subscriber.verification_token_expires_at)
    if (expiresAt < new Date()) {
      return redirectResponse(`${SITE_URL}/verify-error.html`)
    }
  }

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
    return redirectResponse(`${SITE_URL}/verify-error.html`)
  }

  const preferencesUrl = `${SITE_URL}/preferences.html?token=${subscriber.preferences_token}`
  const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?token=${subscriber.unsubscribe_token}`
  const welcomeHtml = welcomeEmail(subscriber.email_frequency, preferencesUrl, unsubscribeUrl)

  const emailResult = await sendEmail({
    to: subscriber.email,
    subject: 'Welcome to Living Verification Documents',
    html: welcomeHtml
  })

  if (!emailResult.success) {
    console.error('Failed to send welcome email:', emailResult.error)
  }

  return redirectResponse(`${SITE_URL}/verified.html`)
})
