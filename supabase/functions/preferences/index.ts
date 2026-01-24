import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/send-email.ts'
import { unsubscribeConfirmationEmail } from '../_shared/email-templates.ts'

const SITE_URL = 'https://proofworks.cc'
const VALID_FREQUENCIES = ['immediate', 'daily', 'weekly']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Token is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Find subscriber by preferences token
  const { data: subscriber, error: fetchError } = await supabase
    .from('subscribers')
    .select('id, email, email_frequency, is_active, preferences_token, unsubscribe_token')
    .eq('preferences_token', token)
    .single()

  if (fetchError || !subscriber) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // GET: Return current preferences
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        email: maskEmail(subscriber.email),
        frequency: subscriber.email_frequency,
        is_active: subscriber.is_active
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // POST: Update preferences
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      const { action, frequency } = body

      // Handle unsubscribe action
      if (action === 'unsubscribe') {
        // Send confirmation email before deleting (need the email address)
        const unsubscribeHtml = unsubscribeConfirmationEmail()
        const emailResult = await sendEmail({
          to: subscriber.email,
          subject: "You've been unsubscribed",
          html: unsubscribeHtml
        })

        if (!emailResult.success) {
          console.error('Failed to send unsubscribe confirmation email:', emailResult.error)
        }

        // Delete subscriber record
        const { error: deleteError } = await supabase
          .from('subscribers')
          .delete()
          .eq('id', subscriber.id)

        if (deleteError) {
          console.error('Database error:', deleteError)
          return new Response(
            JSON.stringify({ error: 'Failed to unsubscribe' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Successfully unsubscribed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Handle frequency update
      if (frequency) {
        if (!VALID_FREQUENCIES.includes(frequency)) {
          return new Response(
            JSON.stringify({ error: 'Invalid frequency' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Skip update if frequency hasn't changed
        if (frequency === subscriber.email_frequency) {
          return new Response(
            JSON.stringify({ success: true, message: 'No changes made' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error: updateError } = await supabase
          .from('subscribers')
          .update({ email_frequency: frequency })
          .eq('id', subscriber.id)

        if (updateError) {
          console.error('Database error:', updateError)
          return new Response(
            JSON.stringify({ error: 'Failed to update preferences' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Preferences updated' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (error) {
      console.error('Error:', error)
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})

// Mask email for privacy (show first 2 chars and domain)
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`
  }
  return `${local.slice(0, 2)}***@${domain}`
}
