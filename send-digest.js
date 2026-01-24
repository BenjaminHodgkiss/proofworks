const fs = require('fs');

const { DOCUMENTS_PATH, SITE_URL } = require('./lib/config');
const { escapeHtml, formatAuthor, validateEnvVars } = require('./lib/utils');
const { sendBulkEmails, fetchSubscribers } = require('./lib/email');

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
  const env = validateEnvVars(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY']);

  // Calculate the time window based on frequency
  const now = new Date();
  let sinceDate;

  if (frequency === 'daily') {
    sinceDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else {
    sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const sinceISO = sinceDate.toISOString();
  console.log(`Looking for documents added since ${sinceISO}`);

  if (!fs.existsSync(DOCUMENTS_PATH)) {
    console.error('documents.json not found');
    process.exit(1);
  }

  const allDocuments = JSON.parse(fs.readFileSync(DOCUMENTS_PATH, 'utf-8'));

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

  const subscribers = await fetchSubscribers(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    frequency
  );

  console.log(`Found ${subscribers.length} verified subscriber(s) with ${frequency} preference`);

  if (subscribers.length === 0) {
    console.log('No subscribers to notify');
    return;
  }

  const periodLabel = frequency === 'daily' ? 'Daily' : 'Weekly';
  const subject = newDocuments.length === 1
    ? `${periodLabel} Digest: ${newDocuments[0].title}`
    : `${periodLabel} Digest: ${newDocuments.length} New AI Verification Documents`;

  const baseHtml = generateDigestEmailHtml(newDocuments, frequency);

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

function generateDigestEmailHtml(documents, frequency) {
  const periodLabel = frequency === 'daily' ? 'Daily' : 'Weekly';
  const periodDescription = frequency === 'daily' ? 'the past 24 hours' : 'the past week';

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

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
