const fs = require('fs');

const { DOCUMENTS_PATH, ONE_DAY_MS, ONE_WEEK_MS, SITE_URL } = require('./lib/config');
const { validateEnvVars, filterDocumentsByDate } = require('./lib/utils');
const { sendBulkEmails, fetchSubscribers } = require('./lib/email');
const { generateDigestHtml } = require('./lib/email-templates');

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
    sinceDate = new Date(now.getTime() - ONE_DAY_MS);
  } else {
    sinceDate = new Date(now.getTime() - ONE_WEEK_MS);
  }

  const sinceISO = sinceDate.toISOString();
  console.log(`Looking for documents added since ${sinceISO}`);

  if (!fs.existsSync(DOCUMENTS_PATH)) {
    console.error('documents.json not found');
    process.exit(1);
  }

  const allDocuments = JSON.parse(fs.readFileSync(DOCUMENTS_PATH, 'utf-8'));

  const newDocuments = filterDocumentsByDate(allDocuments, sinceDate);

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
    : `${periodLabel} Digest: ${newDocuments.length} New Living Verification Documents`;

  const baseHtml = generateDigestHtml(newDocuments, frequency);

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
