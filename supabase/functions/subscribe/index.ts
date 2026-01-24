import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/send-email.ts'
import { verificationEmail } from '../_shared/email-templates.ts'

const SITE_URL = 'https://proofworks.cc'
const VERIFICATION_EXPIRY_HOURS = 24

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const VALID_FREQUENCIES = ['immediate', 'daily', 'weekly']

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { email, frequency = 'immediate' } = await req.json()

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate frequency
    if (!VALID_FREQUENCIES.includes(frequency)) {
      return new Response(
        JSON.stringify({ error: 'Invalid frequency. Must be: immediate, daily, or weekly' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const normalizedEmail = email.toLowerCase()

    // Check if subscriber already exists
    const { data: existing } = await supabase
      .from('subscribers')
      .select('id, unsubscribe_token, preferences_token, is_active, email_verified, email_frequency')
      .eq('email', normalizedEmail)
      .single()

    if (existing) {
      // Case 1: Active and verified subscriber changing frequency
      if (existing.is_active && existing.email_verified) {
        if (existing.email_frequency === frequency) {
          // No change needed
          return new Response(
            JSON.stringify({
              success: true,
              message: 'You are already subscribed with this frequency.',
              requiresVerification: false
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Update frequency
        const { error } = await supabase
          .from('subscribers')
          .update({ email_frequency: frequency })
          .eq('id', existing.id)

        if (error) {
          console.error('Database error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to update subscription' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Preferences updated!',
            requiresVerification: false
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Case 2: Never verified - send new verification email
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
        return new Response(
          JSON.stringify({ error: 'Failed to subscribe' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Send verification email
      const verifyUrl = `${supabaseUrl}/functions/v1/verify-email?token=${verificationToken}`
      const emailResult = await sendEmail({
        to: normalizedEmail,
        subject: 'Verify your subscription to AI Verification Documents',
        html: verificationEmail(verifyUrl)
      })

      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error)
        return new Response(
          JSON.stringify({ error: 'Failed to send verification email. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Check your email to verify your subscription.',
          requiresVerification: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // New subscriber - create with verification required
    const verificationToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()
    const preferencesToken = crypto.randomUUID()
    const unsubscribeToken = crypto.randomUUID()

    const { error } = await supabase
      .from('subscribers')
      .insert({
        email: normalizedEmail,
        is_active: false, // Will be set to true upon verification
        email_frequency: frequency,
        email_verified: false,
        verification_token: verificationToken,
        verification_token_expires_at: expiresAt,
        preferences_token: preferencesToken,
        unsubscribe_token: unsubscribeToken
      })

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to subscribe' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send verification email
    const verifyUrl = `${supabaseUrl}/functions/v1/verify-email?token=${verificationToken}`
    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: 'Verify your subscription to AI Verification Documents',
      html: verificationEmail(verifyUrl)
    })

    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error)
      return new Response(
        JSON.stringify({ error: 'Failed to send verification email. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Check your email to verify your subscription.',
        requiresVerification: true
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
