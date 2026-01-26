// Shared email template functions for Node.js scripts

const { SITE_URL, BRAND_COLOR } = require('./config');
const { escapeHtml, formatAuthor } = require('./utils');

function documentCard(doc) {
  const author = formatAuthor(doc.author);
  return `
      <div style="margin-bottom: 24px; padding: 16px; background-color: #f8f8f8; border-radius: 8px;">
        <h2 style="margin: 0 0 8px 0; font-size: 18px;">
          <a href="${escapeHtml(doc.url)}" style="color: ${BRAND_COLOR}; text-decoration: none;">${escapeHtml(doc.title)}</a>
        </h2>
        <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">By ${escapeHtml(author)}</p>
        ${doc.description ? `<p style="margin: 0; color: #333; font-size: 14px;">${escapeHtml(doc.description)}</p>` : ''}
      </div>
    `;
}

function emailWrapper(title, content, subtitle = '') {
  const subtitleHtml = subtitle
    ? `<p style="color: #666; font-size: 14px; margin-top: 0; margin-bottom: 24px;">${subtitle}</p>`
    : '';
  const titleMargin = subtitle ? '8px' : '24px';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h1 style="color: ${BRAND_COLOR}; font-size: 24px; margin-bottom: ${titleMargin};">${title}</h1>
  ${subtitleHtml}
  ${content}

  <p style="margin-top: 32px;">
    <a href="${SITE_URL}" style="display: inline-block; padding: 12px 24px; background-color: ${BRAND_COLOR}; color: white; text-decoration: none; border-radius: 4px;">View All Documents</a>
  </p>

  <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;">

  <p style="font-size: 12px; color: #999; margin-bottom: 16px;">
    You're receiving this{{FREQUENCY_TEXT}} because you subscribed to Living Verification Documents updates.
    <a href="{{PREFERENCES_URL}}" style="color: #999;">Manage preferences</a>
  </p>

  <p style="text-align: center;">
    <a href="{{UNSUBSCRIBE_URL}}" style="display: inline-block; padding: 10px 20px; background-color: #666; color: white; text-decoration: none; border-radius: 4px; font-size: 14px;">Unsubscribe</a>
  </p>
</body>
</html>
  `;
}

function generateImmediateNotificationHtml(documents) {
  const documentsList = documents.map(documentCard).join('');
  return emailWrapper('New Living Verification Documents', documentsList)
    .replace('{{FREQUENCY_TEXT}}', '');
}

function generateDigestHtml(documents, frequency) {
  const periodLabel = frequency === 'daily' ? 'Daily' : 'Weekly';
  const periodDescription = frequency === 'daily' ? 'the past 24 hours' : 'the past week';
  const documentsList = documents.map(documentCard).join('');
  const subtitle = `${documents.length} new document${documents.length === 1 ? '' : 's'} added in ${periodDescription}`;

  return emailWrapper(`${periodLabel} Digest`, documentsList, subtitle)
    .replace('{{FREQUENCY_TEXT}}', ` ${frequency} digest`);
}

module.exports = {
  generateImmediateNotificationHtml,
  generateDigestHtml
};
