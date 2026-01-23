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

function parseExistingFeed(feedXml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(feedXml)) !== null) {
    const itemXml = match[1];
    const link = itemXml.match(/<link>([^<]*)<\/link>/)?.[1] || '';
    const title = itemXml.match(/<title>([^<]*)<\/title>/)?.[1] || '';
    const description = itemXml.match(/<description>([^<]*)<\/description>/)?.[1] || '';
    const pubDate = itemXml.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] || '';
    const guid = itemXml.match(/<guid[^>]*>([^<]*)<\/guid>/)?.[1] || link;

    items.push({ title, link, description, pubDate, guid });
  }

  return items;
}

function generateFeedXml(items) {
  const now = new Date().toUTCString();

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
    <lastBuildDate>${now}</lastBuildDate>
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

  // Read existing feed.xml if it exists
  let existingItems = [];
  let existingUrls = new Set();

  if (fs.existsSync(FEED_PATH)) {
    const existingFeed = fs.readFileSync(FEED_PATH, 'utf-8');
    existingItems = parseExistingFeed(existingFeed);
    existingUrls = new Set(existingItems.map(item => item.link));
    console.log(`Found ${existingItems.length} existing items in feed`);
  } else {
    console.log('No existing feed.xml found, creating new feed');
  }

  // Find new documents (URLs not already in feed)
  const newDocuments = documents.filter(doc => !existingUrls.has(doc.url));
  console.log(`Found ${newDocuments.length} new documents to add`);

  if (newDocuments.length === 0) {
    console.log('No new documents to add, feed unchanged');
    return;
  }

  // Write new documents to JSON file for email notifications
  fs.writeFileSync(NEW_DOCS_PATH, JSON.stringify(newDocuments, null, 2), 'utf-8');
  console.log(`Wrote ${newDocuments.length} new documents to new-documents.json`);

  // Create items for new documents with current timestamp
  const now = new Date().toUTCString();
  const newItems = newDocuments.map(doc => ({
    title: doc.title,
    link: doc.url,
    description: doc.description || '',
    pubDate: now,
    guid: doc.url
  }));

  // Combine new items first (most recent), then existing items
  const allItems = [...newItems, ...existingItems];

  // Generate and write the feed
  const feedXml = generateFeedXml(allItems);
  fs.writeFileSync(FEED_PATH, feedXml, 'utf-8');

  console.log(`Added ${newItems.length} new items to feed`);
  console.log(`Feed now contains ${allItems.length} total items`);
}

main();
