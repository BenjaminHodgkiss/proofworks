import { sendEmail } from '../_shared/send-email.ts'
import { unsubscribeConfirmationEmail } from '../_shared/email-templates.ts'
import { SITE_URL } from '../_shared/config.ts'
import { redirectResponse } from '../_shared/responses.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return redirectResponse(`${SITE_URL}/unsubscribe-error.html`)
  }

  const supabase = getSupabaseClient()

  const { data: subscriber, error: fetchError } = await supabase
    .from('subscribers')
    .select('id, email, is_active')
    .eq('unsubscribe_token', token)
    .single()

  if (fetchError || !subscriber) {
    return redirectResponse(`${SITE_URL}/unsubscribe-error.html`)
  }

  const emailResult = await sendEmail({
    to: subscriber.email,
    subject: "You've been unsubscribed",
    html: unsubscribeConfirmationEmail()
  })

  if (!emailResult.success) {
    console.error('Failed to send unsubscribe confirmation email:', emailResult.error)
  }

  const { error: deleteError } = await supabase
    .from('subscribers')
    .delete()
    .eq('id', subscriber.id)

  if (deleteError) {
    console.error('Database error:', deleteError)
    return redirectResponse(`${SITE_URL}/unsubscribe-error.html`)
  }

  return redirectResponse(`${SITE_URL}/unsubscribed.html`)
})
