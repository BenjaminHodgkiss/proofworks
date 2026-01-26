import { sendEmail } from '../_shared/send-email.ts'
import { verificationEmail } from '../_shared/email-templates.ts'
import { VALID_FREQUENCIES } from '../_shared/config.ts'
import { handleCors } from '../_shared/cors.ts'
import { errorResponse, successResponse } from '../_shared/responses.ts'
import { getSupabaseClient, getSupabaseUrl } from '../_shared/supabase.ts'
import { updateExistingSubscriberForVerification, createNewSubscriber } from '../_shared/subscriber-operations.ts'

async function sendVerificationAndRespond(email: string, verificationToken: string, supabaseUrl: string) {
  const verifyUrl = `${supabaseUrl}/functions/v1/verify-email?token=${verificationToken}`
  const emailResult = await sendEmail({
    to: email,
    subject: 'Verify your subscription to Living Verification Documents',
    html: verificationEmail(verifyUrl)
  })

  if (!emailResult.success) {
    console.error('Failed to send verification email:', emailResult.error)
    return errorResponse('Failed to send verification email. Please try again.', 500)
  }

  return successResponse('Check your email to verify your subscription.', { requiresVerification: true })
}

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

    const supabaseUrl = getSupabaseUrl()
    const supabase = getSupabaseClient()

    const normalizedEmail = email.toLowerCase()

    const { data: existing } = await supabase
      .from('subscribers')
      .select('id, unsubscribe_token, preferences_token, is_active, email_verified, email_frequency')
      .eq('email', normalizedEmail)
      .single()

    if (existing) {
      // Already verified - just update frequency if different
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

      // Not verified - resend verification email
      const { error, verificationToken } = await updateExistingSubscriberForVerification(
        supabase,
        existing,
        frequency
      )

      if (error) {
        console.error('Database error:', error)
        return errorResponse('Failed to subscribe', 500)
      }

      return await sendVerificationAndRespond(normalizedEmail, verificationToken, supabaseUrl)
    }

    // New subscriber
    const { error, verificationToken } = await createNewSubscriber(supabase, normalizedEmail, frequency)

    if (error) {
      console.error('Database error:', error)
      return errorResponse('Failed to subscribe', 500)
    }

    return await sendVerificationAndRespond(normalizedEmail, verificationToken, supabaseUrl)
  } catch (error) {
    console.error('Error:', error)
    return errorResponse('Internal server error', 500)
  }
})
