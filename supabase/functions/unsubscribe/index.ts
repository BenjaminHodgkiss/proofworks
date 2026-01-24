import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/send-email.ts'
import { unsubscribeConfirmationEmail } from '../_shared/email-templates.ts'

const SITE_URL = 'https://proofworks.cc'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': `${SITE_URL}/unsubscribe-error.html` }
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get subscriber info first
  const { data: subscriber, error: fetchError } = await supabase
    .from('subscribers')
    .select('id, email, is_active')
    .eq('unsubscribe_token', token)
    .single()

  if (fetchError || !subscriber) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': `${SITE_URL}/unsubscribe-error.html` }
    })
  }

  // Send confirmation email before deleting (need the email address)
  const emailResult = await sendEmail({
    to: subscriber.email,
    subject: "You've been unsubscribed",
    html: unsubscribeConfirmationEmail()
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
    return new Response(null, {
      status: 302,
      headers: { 'Location': `${SITE_URL}/unsubscribe-error.html` }
    })
  }

  return new Response(null, {
    status: 302,
    headers: { 'Location': `${SITE_URL}/unsubscribed.html` }
  })
})
