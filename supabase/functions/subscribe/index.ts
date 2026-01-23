import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      .select('id, unsubscribe_token')
      .eq('email', normalizedEmail)
      .single()

    if (existing) {
      // Update existing subscriber (reactivate and update frequency)
      const { error } = await supabase
        .from('subscribers')
        .update({
          is_active: true,
          email_frequency: frequency,
          // Generate token if missing
          unsubscribe_token: existing.unsubscribe_token || crypto.randomUUID()
        })
        .eq('email', normalizedEmail)

      if (error) {
        console.error('Database error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to subscribe' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Insert new subscriber with unsubscribe token
      const { error } = await supabase
        .from('subscribers')
        .insert({
          email: normalizedEmail,
          is_active: true,
          email_frequency: frequency,
          unsubscribe_token: crypto.randomUUID()
        })

      if (error) {
        console.error('Database error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to subscribe' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Successfully subscribed!' }),
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
