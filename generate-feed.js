const fs = require('fs');

const { DOCUMENTS_PATH, FEED_PATH, NEW_DOCS_PATH, FEED_TITLE, FEED_DESCRIPTION, SITE_URL } = require('./lib/config');
const { escapeXml, unescapeXml } = require('./lib/utils');

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
    <link>${escapeXml(SITE_URL)}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(SITE_URL)}/feed.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>
`;
}

function main() {
  let documents;
  try {
    const documentsJson = fs.readFileSync(DOCUMENTS_PATH, 'utf-8');
    documents = JSON.parse(documentsJson);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('Error: documents.json not found');
    } else if (error instanceof SyntaxError) {
      console.error('Error: documents.json contains invalid JSON');
    } else {
      console.error('Error reading documents.json:', error.message);
    }
    process.exit(1);
  }

  let existingPubDates = new Map();
  let existingLastBuildDate = null;

  if (fs.existsSync(FEED_PATH)) {
    const existingFeed = fs.readFileSync(FEED_PATH, 'utf-8');
    existingPubDates = parseExistingFeed(existingFeed);
    const lastBuildMatch = existingFeed.match(/<lastBuildDate>([^<]*)<\/lastBuildDate>/);
    if (lastBuildMatch) {
      existingLastBuildDate = lastBuildMatch[1];
    }
    console.log(`Found ${existingPubDates.size} existing items in feed`);
  } else {
    console.log('No existing feed.xml found, creating new feed');
  }

  const newDocuments = documents.filter(doc => !existingPubDates.has(doc.url));
  console.log(`Found ${newDocuments.length} new documents to add`);

  if (newDocuments.length > 0) {
    try {
      fs.writeFileSync(NEW_DOCS_PATH, JSON.stringify(newDocuments, null, 2), 'utf-8');
      console.log(`Wrote ${newDocuments.length} new documents to new-documents.json`);
    } catch (error) {
      console.error('Error writing new-documents.json:', error.message);
    }
  }

  const now = new Date().toUTCString();
  const allItems = documents.map(doc => ({
    title: doc.title,
    link: doc.url,
    description: doc.description || '',
    pubDate: existingPubDates.get(doc.url) || now,
    guid: doc.url
  }));

  const lastBuildDate = newDocuments.length > 0 ? now : (existingLastBuildDate || now);

  const feedXml = generateFeedXml(allItems, lastBuildDate);

  try {
    fs.writeFileSync(FEED_PATH, feedXml, 'utf-8');
  } catch (error) {
    console.error('Error writing feed.xml:', error.message);
    process.exit(1);
  }

  if (newDocuments.length > 0) {
    console.log(`Added ${newDocuments.length} new items to feed`);
  }
  console.log(`Feed regenerated with ${allItems.length} total items`);
}

main();
