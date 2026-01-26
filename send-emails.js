const fs = require('fs');

const { DOCUMENTS_PATH, SITE_URL, NEW_DOCUMENT_WINDOW_MS } = require('./lib/config');
const { validateEnvVars, filterDocumentsByDate } = require('./lib/utils');
const { sendBulkEmails, fetchSubscribers } = require('./lib/email');
const { generateImmediateNotificationHtml } = require('./lib/email-templates');

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

  const baseHtml = generateImmediateNotificationHtml(newDocuments);

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

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
