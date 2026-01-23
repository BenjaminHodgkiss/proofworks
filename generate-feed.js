const fs = require('fs');
const path = require('path');

const DOCUMENTS_PATH = path.join(__dirname, 'documents.json');
const FEED_PATH = path.join(__dirname, 'feed.xml');
const NEW_DOCS_PATH = path.join(__dirname, 'new-documents.json');

const FEED_TITLE = 'AI Verification Documents';
const FEED_DESCRIPTION = 'A shared collection of resources for AI verification researchers';
const FEED_LINK = 'https://proofworks.cc';

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function parseExistingFeed(feedXml) {
  const pubDates = new Map();
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(feedXml)) !== null) {
    const itemXml = match[1];
    const link = unescapeXml(itemXml.match(/<link>([^<]*)<\/link>/)?.[1] || '');
    const pubDate = itemXml.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] || '';

    if (link && pubDate) {
      pubDates.set(link, pubDate);
    }
  }

  return pubDates;
}

function generateFeedXml(items, lastBuildDate) {
  const itemsXml = items.map(item => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.pubDate}</pubDate>
      <guid isPermaLink="true">${escapeXml(item.guid || item.link)}</guid>
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${escapeXml(FEED_LINK)}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(FEED_LINK)}/feed.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>
`;
}

function main() {
  // Read documents.json
  const documentsJson = fs.readFileSync(DOCUMENTS_PATH, 'utf-8');
  const documents = JSON.parse(documentsJson);

  // Read existing feed.xml to get historical pubDates and lastBuildDate
  let existingPubDates = new Map();
  let existingLastBuildDate = null;

  if (fs.existsSync(FEED_PATH)) {
    const existingFeed = fs.readFileSync(FEED_PATH, 'utf-8');
    existingPubDates = parseExistingFeed(existingFeed);
    // Extract existing lastBuildDate
    const lastBuildMatch = existingFeed.match(/<lastBuildDate>([^<]*)<\/lastBuildDate>/);
    if (lastBuildMatch) {
      existingLastBuildDate = lastBuildMatch[1];
    }
    console.log(`Found ${existingPubDates.size} existing items in feed`);
  } else {
    console.log('No existing feed.xml found, creating new feed');
  }

  // Find new documents (URLs not already in feed)
  const newDocuments = documents.filter(doc => !existingPubDates.has(doc.url));
  console.log(`Found ${newDocuments.length} new documents to add`);

  // Write new documents to JSON file for email notifications (only if there are new ones)
  if (newDocuments.length > 0) {
    fs.writeFileSync(NEW_DOCS_PATH, JSON.stringify(newDocuments, null, 2), 'utf-8');
    console.log(`Wrote ${newDocuments.length} new documents to new-documents.json`);
  }

  // Create items for ALL documents from documents.json (source of truth)
  // Use historical pubDate if available, otherwise current timestamp
  const now = new Date().toUTCString();
  const allItems = documents.map(doc => ({
    title: doc.title,
    link: doc.url,
    description: doc.description || '',
    pubDate: existingPubDates.get(doc.url) || now,
    guid: doc.url
  }));

  // Only update lastBuildDate if there are new documents or content changes
  // This prevents timestamp-only divergence between local and remote
  const lastBuildDate = newDocuments.length > 0 ? now : (existingLastBuildDate || now);

  // Generate and write the feed
  const feedXml = generateFeedXml(allItems, lastBuildDate);
  fs.writeFileSync(FEED_PATH, feedXml, 'utf-8');

  if (newDocuments.length > 0) {
    console.log(`Added ${newDocuments.length} new items to feed`);
  }
  console.log(`Feed regenerated with ${allItems.length} total items`);
}

main();
