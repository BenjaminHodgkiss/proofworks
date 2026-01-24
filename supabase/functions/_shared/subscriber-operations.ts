import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from './send-email.ts'
import { verificationEmail } from './email-templates.ts'
import { VERIFICATION_EXPIRY_HOURS } from './config.ts'

interface Subscriber {
  id: string
  unsubscribe_token: string | null
  preferences_token: string | null
  is_active: boolean
  email_verified: boolean
  email_frequency: string
}

interface SendVerificationResult {
  success: boolean
  error?: string
}

export async function sendVerificationEmail(
  email: string,
  supabaseUrl: string
): Promise<SendVerificationResult> {
  const verificationToken = crypto.randomUUID()
  const verifyUrl = `${supabaseUrl}/functions/v1/verify-email?token=${verificationToken}`

  const emailResult = await sendEmail({
    to: email,
    subject: 'Verify your subscription to Living Verification Documents',
    html: verificationEmail(verifyUrl)
  })

  if (!emailResult.success) {
    return { success: false, error: emailResult.error }
  }

  return { success: true }
}

export function generateVerificationData() {
  const verificationToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()

  return { verificationToken, expiresAt }
}

export async function updateExistingSubscriberForVerification(
  supabase: SupabaseClient,
  existing: Subscriber,
  frequency: string
): Promise<{ error: Error | null; verificationToken: string }> {
  const { verificationToken, expiresAt } = generateVerificationData()

  const { error } = await supabase
    .from('subscribers')
    .update({
      email_frequency: frequency,
      verification_token: verificationToken,
      verification_token_expires_at: expiresAt,
      preferences_token: existing.preferences_token || crypto.randomUUID(),
      unsubscribe_token: existing.unsubscribe_token || crypto.randomUUID()
    })
    .eq('id', existing.id)

  return { error, verificationToken }
}

export async function createNewSubscriber(
  supabase: SupabaseClient,
  email: string,
  frequency: string
): Promise<{ error: Error | null; verificationToken: string }> {
  const { verificationToken, expiresAt } = generateVerificationData()
  const preferencesToken = crypto.randomUUID()
  const unsubscribeToken = crypto.randomUUID()

  const { error } = await supabase
    .from('subscribers')
    .insert({
      email,
      is_active: false,
      email_frequency: frequency,
      email_verified: false,
      verification_token: verificationToken,
      verification_token_expires_at: expiresAt,
      preferences_token: preferencesToken,
      unsubscribe_token: unsubscribeToken
    })

  return { error, verificationToken }
}
