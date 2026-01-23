import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response(renderHtml('Error', 'Invalid unsubscribe link.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' }
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Mark subscriber as inactive
  const { data, error } = await supabase
    .from('subscribers')
    .update({ is_active: false })
    .eq('unsubscribe_token', token)
    .select()

  if (error) {
    console.error('Database error:', error)
    return new Response(renderHtml('Error', 'Something went wrong. Please try again.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    })
  }

  if (!data || data.length === 0) {
    return new Response(renderHtml('Error', 'Invalid or expired unsubscribe link.'), {
      status: 404,
      headers: { 'Content-Type': 'text/html' }
    })
  }

  return new Response(
    renderHtml('Unsubscribed', 'You have been successfully unsubscribed from AI Verification Document updates.'),
    {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    }
  )
})

function renderHtml(title: string, message: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - AI Verification Documents</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background-color: #faf9f7;
      color: #333;
    }
    .container {
      text-align: center;
      padding: 40px;
      max-width: 400px;
    }
    h1 {
      color: #5b8a8a;
      margin-bottom: 16px;
    }
    p {
      color: #666;
      line-height: 1.6;
    }
    a {
      color: #5b8a8a;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="https://proofworks.cc">Return to AI Verification Documents</a></p>
  </div>
</body>
</html>
  `
}
