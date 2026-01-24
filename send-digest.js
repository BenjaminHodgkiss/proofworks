const fs = require('fs');
const path = require('path');

const DOCUMENTS_PATH = path.join(__dirname, 'documents.json');
const SITE_URL = 'https://proofworks.cc';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let frequency = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--frequency' && args[i + 1]) {
      frequency = args[i + 1];
    }
  }

  if (!frequency || !['daily', 'weekly'].includes(frequency)) {
    console.error('Usage: node send-digest.js --frequency daily|weekly');
    process.exit(1);
  }

  return { frequency };
}

async function main() {
  const { frequency } = parseArgs();

  // Check for required environment variables
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  // Calculate the time window based on frequency
  const now = new Date();
  let sinceDate;

  if (frequency === 'daily') {
    sinceDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
  } else {
    sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  }

  const sinceISO = sinceDate.toISOString();
  console.log(`Looking for documents added since ${sinceISO}`);

  // Read documents.json and filter by date_added
  if (!fs.existsSync(DOCUMENTS_PATH)) {
    console.error('documents.json not found');
    process.exit(1);
  }

  const allDocuments = JSON.parse(fs.readFileSync(DOCUMENTS_PATH, 'utf-8'));

  // Filter documents added within the time window
  const newDocuments = allDocuments.filter(doc => {
    if (!doc.date_added) return false;
    const docDate = new Date(doc.date_added);
    return docDate >= sinceDate;
  });

  if (newDocuments.length === 0) {
    console.log(`No new documents in the ${frequency} window`);
    return;
  }

  console.log(`Found ${newDocuments.length} document(s) added in the ${frequency} window`);

  // Fetch active and verified subscribers with matching frequency
  const subscribersResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/subscribers?is_active=eq.true&email_verified=eq.true&email_frequency=eq.${frequency}&select=email,unsubscribe_token,preferences_token`,
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
  console.log(`Found ${subscribers.length} verified subscriber(s) with ${frequency} preference`);

  if (subscribers.length === 0) {
    console.log('No subscribers to notify');
    return;
  }

  // Generate email subject
  const periodLabel = frequency === 'daily' ? 'Daily' : 'Weekly';
  const subject = newDocuments.length === 1
    ? `${periodLabel} Digest: ${newDocuments[0].title}`
    : `${periodLabel} Digest: ${newDocuments.length} New AI Verification Documents`;

  // Generate email HTML
  const emailHtml = generateDigestEmailHtml(newDocuments, frequency);

  // Send emails to each subscriber
  let successCount = 0;
  let errorCount = 0;

  for (const subscriber of subscribers) {
    const unsubscribeUrl = `${SUPABASE_URL}/functions/v1/unsubscribe?token=${subscriber.unsubscribe_token}`;
    const preferencesUrl = `${SITE_URL}/preferences.html?token=${subscriber.preferences_token}`;

    const personalizedHtml = emailHtml
      .replace('{{UNSUBSCRIBE_URL}}', unsubscribeUrl)
      .replace('{{PREFERENCES_URL}}', preferencesUrl);

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

function generateDigestEmailHtml(documents, frequency) {
  const periodLabel = frequency === 'daily' ? 'Daily' : 'Weekly';
  const periodDescription = frequency === 'daily' ? 'the past 24 hours' : 'the past week';

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
  <h1 style="color: #5b8a8a; font-size: 24px; margin-bottom: 8px;">${periodLabel} Digest</h1>
  <p style="color: #666; font-size: 14px; margin-top: 0; margin-bottom: 24px;">
    ${documents.length} new document${documents.length === 1 ? '' : 's'} added in ${periodDescription}
  </p>

  ${documentsList}

  <p style="margin-top: 32px;">
    <a href="${SITE_URL}" style="display: inline-block; padding: 12px 24px; background-color: #5b8a8a; color: white; text-decoration: none; border-radius: 4px;">View All Documents</a>
  </p>

  <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;">

  <p style="font-size: 12px; color: #999; margin-bottom: 16px;">
    You're receiving this ${frequency} digest because you subscribed to AI Verification Document updates.
    <a href="{{PREFERENCES_URL}}" style="color: #999;">Manage preferences</a>
  </p>

  <p style="text-align: center;">
    <a href="{{UNSUBSCRIBE_URL}}" style="display: inline-block; padding: 10px 20px; background-color: #666; color: white; text-decoration: none; border-radius: 4px; font-size: 14px;">Unsubscribe</a>
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
