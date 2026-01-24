// Resend API wrapper for sending transactional emails

const FROM_ADDRESS = 'Living Verification Documents <updates@proofworks.cc>'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')

  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: options.to,
        subject: options.subject,
        html: options.html
      })
    })

    if (response.ok) {
      const data = await response.json()
      return { success: true, id: data.id }
    } else {
      const errorText = await response.text()
      console.error('Resend API error:', errorText)
      return { success: false, error: errorText }
    }
  } catch (error) {
    console.error('Failed to send email:', error)
    return { success: false, error: error.message }
  }
}
