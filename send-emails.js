const fs = require('fs');

const { DOCUMENTS_PATH, SITE_URL, NEW_DOCUMENT_WINDOW_MS } = require('./lib/config');
const { escapeHtml, formatAuthor, validateEnvVars, filterDocumentsByDate } = require('./lib/utils');
const { sendBulkEmails, fetchSubscribers } = require('./lib/email');

async function main() {
  const env = validateEnvVars(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY']);

  if (!fs.existsSync(DOCUMENTS_PATH)) {
    console.error('documents.json not found');
    process.exit(1);
  }

  // Read all documents and filter by date_added within the time window
  const allDocuments = JSON.parse(fs.readFileSync(DOCUMENTS_PATH, 'utf-8'));
  const cutoffTime = new Date(Date.now() - NEW_DOCUMENT_WINDOW_MS);

  const newDocuments = filterDocumentsByDate(allDocuments, cutoffTime);

  if (newDocuments.length === 0) {
    console.log('No new documents to notify about');
    return;
  }

  console.log(`Sending notifications for ${newDocuments.length} new document(s)`);

  const subscribers = await fetchSubscribers(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    'immediate'
  );

  console.log(`Found ${subscribers.length} active verified subscriber(s)`);

  if (subscribers.length === 0) {
    console.log('No subscribers to notify');
    return;
  }

  const subject = newDocuments.length === 1
    ? `New Document: ${newDocuments[0].title}`
    : `${newDocuments.length} New Living Verification Documents`;

  const baseHtml = generateEmailHtml(newDocuments);

  const generatePersonalizedHtml = (subscriber) => {
    const unsubscribeUrl = `${env.SUPABASE_URL}/functions/v1/unsubscribe?token=${subscriber.unsubscribe_token}`;
    const preferencesUrl = `${SITE_URL}/preferences.html?token=${subscriber.preferences_token}`;
    return baseHtml
      .replace('{{UNSUBSCRIBE_URL}}', unsubscribeUrl)
      .replace('{{PREFERENCES_URL}}', preferencesUrl);
  };

  const { successCount, errorCount } = await sendBulkEmails(
    subscribers,
    generatePersonalizedHtml,
    subject,
    env.RESEND_API_KEY
  );

  console.log(`Email sending complete: ${successCount} sent, ${errorCount} failed`);
}

function generateEmailHtml(documents) {
  const documentsList = documents.map(doc => {
    const author = formatAuthor(doc.author);
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
  <h1 style="color: #5b8a8a; font-size: 24px; margin-bottom: 24px;">New Living Verification Documents</h1>

  ${documentsList}

  <p style="margin-top: 32px;">
    <a href="${SITE_URL}" style="display: inline-block; padding: 12px 24px; background-color: #5b8a8a; color: white; text-decoration: none; border-radius: 4px;">View All Documents</a>
  </p>

  <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;">

  <p style="font-size: 12px; color: #999; margin-bottom: 16px;">
    You're receiving this because you subscribed to Living Verification Documents updates.
    <a href="{{PREFERENCES_URL}}" style="color: #999;">Manage preferences</a>
  </p>

  <p style="text-align: center;">
    <a href="{{UNSUBSCRIBE_URL}}" style="display: inline-block; padding: 10px 20px; background-color: #666; color: white; text-decoration: none; border-radius: 4px; font-size: 14px;">Unsubscribe</a>
  </p>
</body>
</html>
  `;
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
