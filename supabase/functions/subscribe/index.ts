import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/send-email.ts'
import { verificationEmail } from '../_shared/email-templates.ts'
import { VERIFICATION_EXPIRY_HOURS, VALID_FREQUENCIES } from '../_shared/config.ts'
import { handleCors } from '../_shared/cors.ts'
import { jsonResponse, errorResponse, successResponse } from '../_shared/responses.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const { email, frequency = 'immediate' } = await req.json()

    if (!email || typeof email !== 'string') {
      return errorResponse('Email is required')
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return errorResponse('Invalid email format')
    }

    if (!VALID_FREQUENCIES.includes(frequency)) {
      return errorResponse('Invalid frequency. Must be: immediate, daily, or weekly')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const normalizedEmail = email.toLowerCase()

    const { data: existing } = await supabase
      .from('subscribers')
      .select('id, unsubscribe_token, preferences_token, is_active, email_verified, email_frequency')
      .eq('email', normalizedEmail)
      .single()

    if (existing) {
      if (existing.is_active && existing.email_verified) {
        if (existing.email_frequency === frequency) {
          return successResponse('You are already subscribed with this frequency.', { requiresVerification: false })
        }

        const { error } = await supabase
          .from('subscribers')
          .update({ email_frequency: frequency })
          .eq('id', existing.id)

        if (error) {
          console.error('Database error:', error)
          return errorResponse('Failed to update subscription', 500)
        }

        return successResponse('Preferences updated!', { requiresVerification: false })
      }

      const verificationToken = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()
      const preferencesToken = existing.preferences_token || crypto.randomUUID()

      const { error } = await supabase
        .from('subscribers')
        .update({
          email_frequency: frequency,
          verification_token: verificationToken,
          verification_token_expires_at: expiresAt,
          preferences_token: preferencesToken,
          unsubscribe_token: existing.unsubscribe_token || crypto.randomUUID()
        })
        .eq('id', existing.id)

      if (error) {
        console.error('Database error:', error)
        return errorResponse('Failed to subscribe', 500)
      }

      const verifyUrl = `${supabaseUrl}/functions/v1/verify-email?token=${verificationToken}`
      const emailResult = await sendEmail({
        to: normalizedEmail,
        subject: 'Verify your subscription to AI Verification Documents',
        html: verificationEmail(verifyUrl)
      })

      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error)
        return errorResponse('Failed to send verification email. Please try again.', 500)
      }

      return successResponse('Check your email to verify your subscription.', { requiresVerification: true })
    }

    const verificationToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()
    const preferencesToken = crypto.randomUUID()
    const unsubscribeToken = crypto.randomUUID()

    const { error } = await supabase
      .from('subscribers')
      .insert({
        email: normalizedEmail,
        is_active: false,
        email_frequency: frequency,
        email_verified: false,
        verification_token: verificationToken,
        verification_token_expires_at: expiresAt,
        preferences_token: preferencesToken,
        unsubscribe_token: unsubscribeToken
      })

    if (error) {
      console.error('Database error:', error)
      return errorResponse('Failed to subscribe', 500)
    }

    const verifyUrl = `${supabaseUrl}/functions/v1/verify-email?token=${verificationToken}`
    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: 'Verify your subscription to AI Verification Documents',
      html: verificationEmail(verifyUrl)
    })

    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error)
      return errorResponse('Failed to send verification email. Please try again.', 500)
    }

    return successResponse('Check your email to verify your subscription.', { requiresVerification: true })
  } catch (error) {
    console.error('Error:', error)
    return errorResponse('Internal server error', 500)
  }
})
