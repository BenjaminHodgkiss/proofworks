// Shared utility functions

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
  escapeHtml,
  escapeXml,
  unescapeXml,
  formatAuthor,
  validateEnvVars
};
