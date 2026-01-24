import { sendEmail } from '../_shared/send-email.ts'
import { unsubscribeConfirmationEmail } from '../_shared/email-templates.ts'
import { VALID_FREQUENCIES } from '../_shared/config.ts'
import { handleCors } from '../_shared/cors.ts'
import { jsonResponse, errorResponse, successResponse } from '../_shared/responses.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return errorResponse('Token is required')
  }

  const supabase = getSupabaseClient()

  const { data: subscriber, error: fetchError } = await supabase
    .from('subscribers')
    .select('id, email, email_frequency, is_active, preferences_token, unsubscribe_token')
    .eq('preferences_token', token)
    .single()

  if (fetchError || !subscriber) {
    return errorResponse('Invalid token', 404)
  }

  if (req.method === 'GET') {
    return jsonResponse({
      email: maskEmail(subscriber.email),
      frequency: subscriber.email_frequency,
      is_active: subscriber.is_active
    })
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      const { action, frequency } = body

      if (action === 'unsubscribe') {
        const unsubscribeHtml = unsubscribeConfirmationEmail()
        const emailResult = await sendEmail({
          to: subscriber.email,
          subject: "You've been unsubscribed",
          html: unsubscribeHtml
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
          return errorResponse('Failed to unsubscribe', 500)
        }

        return successResponse('Successfully unsubscribed')
      }

      if (frequency) {
        if (!VALID_FREQUENCIES.includes(frequency)) {
          return errorResponse('Invalid frequency')
        }

        if (frequency === subscriber.email_frequency) {
          return successResponse('No changes made')
        }

        const { error: updateError } = await supabase
          .from('subscribers')
          .update({ email_frequency: frequency })
          .eq('id', subscriber.id)

        if (updateError) {
          console.error('Database error:', updateError)
          return errorResponse('Failed to update preferences', 500)
        }

        return successResponse('Preferences updated')
      }

      return errorResponse('Invalid request')

    } catch (error) {
      console.error('Error:', error)
      return errorResponse('Invalid request body')
    }
  }

  return errorResponse('Method not allowed', 405)
})

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`
  }
  return `${local.slice(0, 2)}***@${domain}`
}
