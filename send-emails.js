const fs = require('fs');
const path = require('path');

const DOCUMENTS_PATH = path.join(__dirname, 'documents.json');
const SITE_URL = 'https://proofworks.cc';

// Time window for considering documents as "new" for immediate emails (10 minutes)
const NEW_DOCUMENT_WINDOW_MS = 10 * 60 * 1000;

async function main() {
  // Check for required environment variables
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  // Check if documents.json exists
  if (!fs.existsSync(DOCUMENTS_PATH)) {
    console.error('documents.json not found');
    process.exit(1);
  }

  // Read all documents and filter by date_added within the time window
  const allDocuments = JSON.parse(fs.readFileSync(DOCUMENTS_PATH, 'utf-8'));
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - NEW_DOCUMENT_WINDOW_MS);

  const newDocuments = allDocuments.filter(doc => {
    if (!doc.date_added) return false;
    const docDate = new Date(doc.date_added);
    return docDate >= cutoffTime;
  });

  if (newDocuments.length === 0) {
    console.log('No new documents to notify about');
    return;
  }

  console.log(`Sending notifications for ${newDocuments.length} new document(s)`);

  // Fetch active subscribers who want immediate emails
  const subscribersResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/subscribers?is_active=eq.true&email_frequency=eq.immediate&select=email,unsubscribe_token`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  if (!subscribersResponse.ok) {
    console.error('Failed to fetch subscribers:', await subscribersResponse.text());
    process.exit(1);
  }

  const subscribers = await subscribersResponse.json();
  console.log(`Found ${subscribers.length} active subscriber(s)`);

  if (subscribers.length === 0) {
    console.log('No subscribers to notify');
    return;
  }

  // Generate email subject
  const subject = newDocuments.length === 1
    ? `New Document: ${newDocuments[0].title}`
    : `${newDocuments.length} New AI Verification Documents`;

  // Generate email HTML
  const emailHtml = generateEmailHtml(newDocuments);

  // Send emails to each subscriber
  let successCount = 0;
  let errorCount = 0;

  for (const subscriber of subscribers) {
    const personalizedHtml = emailHtml.replace(
      '{{UNSUBSCRIBE_URL}}',
      `${SUPABASE_URL}/functions/v1/unsubscribe?token=${subscriber.unsubscribe_token}`
    );

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'AI Verification Docs <updates@proofworks.cc>',
          to: subscriber.email,
          subject: subject,
          html: personalizedHtml
        })
      });

      if (response.ok) {
        successCount++;
        console.log(`Sent email to ${subscriber.email}`);
      } else {
        errorCount++;
        const errorText = await response.text();
        console.error(`Failed to send to ${subscriber.email}: ${errorText}`);
      }

      // Rate limiting: 100ms delay between sends
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      errorCount++;
      console.error(`Error sending to ${subscriber.email}:`, error.message);
    }
  }

  console.log(`Email sending complete: ${successCount} sent, ${errorCount} failed`);
}

function generateEmailHtml(documents) {
  const documentsList = documents.map(doc => {
    const author = Array.isArray(doc.author) ? doc.author.join(', ') : (doc.author || 'Unknown');
    return `
      <div style="margin-bottom: 24px; padding: 16px; background-color: #f8f8f8; border-radius: 8px;">
        <h2 style="margin: 0 0 8px 0; font-size: 18px;">
          <a href="${escapeHtml(doc.url)}" style="color: #5b8a8a; text-decoration: none;">${escapeHtml(doc.title)}</a>
        </h2>
        <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">By ${escapeHtml(author)}</p>
        ${doc.description ? `<p style="margin: 0; color: #333; font-size: 14px;">${escapeHtml(doc.description)}</p>` : ''}
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h1 style="color: #5b8a8a; font-size: 24px; margin-bottom: 24px;">New AI Verification Documents</h1>

  ${documentsList}

  <p style="margin-top: 32px;">
    <a href="${SITE_URL}" style="display: inline-block; padding: 12px 24px; background-color: #5b8a8a; color: white; text-decoration: none; border-radius: 4px;">View All Documents</a>
  </p>

  <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;">

  <p style="font-size: 12px; color: #999;">
    You're receiving this because you subscribed to AI Verification Document updates.
    <br><a href="{{UNSUBSCRIBE_URL}}" style="color: #999;">Unsubscribe</a>
  </p>
</body>
</html>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
