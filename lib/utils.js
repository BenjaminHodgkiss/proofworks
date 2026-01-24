// Shared utility functions

const fs = require('fs');
const { DOCUMENTS_PATH } = require('./config');

/**
 * Load and parse documents.json
 * @param {boolean} exitOnError - If true, exits process on error. If false, throws error.
 */
function loadDocuments(exitOnError = true) {
  try {
    const documentsJson = fs.readFileSync(DOCUMENTS_PATH, 'utf-8');
    return JSON.parse(documentsJson);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('Error: documents.json not found');
    } else if (error instanceof SyntaxError) {
      console.error('Error: documents.json contains invalid JSON');
    } else {
      console.error('Error reading documents.json:', error.message);
    }
    if (exitOnError) process.exit(1);
    throw error;
  }
}

/**
 * Filter documents by date_added since a given date
 */
function filterDocumentsByDate(documents, sinceDate) {
  return documents.filter(doc => {
    if (!doc.date_added) return false;
    const docDate = new Date(doc.date_added);
    return docDate >= sinceDate;
  });
}

/**
 * Escape HTML special characters for safe display in HTML
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape XML special characters for safe inclusion in XML
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Unescape XML entities back to characters
 */
function unescapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/**
 * Format author for display (handles both string and array)
 */
function formatAuthor(author, fallback = 'Unknown') {
  if (!author) return fallback;
  return Array.isArray(author) ? author.join(', ') : author;
}

/**
 * Validate that required environment variables are set
 * Exits process with error if any are missing
 */
function validateEnvVars(varNames) {
  const missing = varNames.filter(name => !process.env[name]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  return varNames.reduce((acc, name) => {
    acc[name] = process.env[name];
    return acc;
  }, {});
}

module.exports = {
  loadDocuments,
  filterDocumentsByDate,
  escapeHtml,
  escapeXml,
  unescapeXml,
  formatAuthor,
  validateEnvVars
};
