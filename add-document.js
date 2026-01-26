#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const { execSync } = require('child_process');

const { DOCUMENTS_PATH, ORDER_INCREMENT } = require('./lib/config');
const { formatAuthor, loadDocuments: loadDocumentsBase } = require('./lib/utils');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function promptRequired(prompt, fieldName) {
  const value = await question(prompt);
  if (!value.trim()) {
    console.log(`Error: ${fieldName} is required`);
    rl.close();
    process.exit(1);
  }
  return value.trim();
}

async function editField(doc, fieldName, displayName, formatter = (v) => v) {
  const currentValue = formatter(doc[fieldName]);
  const newValue = await question(`${displayName} [${currentValue}]: `);
  if (newValue.trim()) {
    doc[fieldName] = newValue.trim();
  }
}

function loadDocuments() {
  try {
    return loadDocumentsBase(false);
  } catch (error) {
    rl.close();
    process.exit(1);
  }
}

function saveDocuments(documents) {
  fs.writeFileSync(DOCUMENTS_PATH, JSON.stringify(documents, null, 2) + '\n');
}

function commitAndPush(title) {
  console.log('\nCommitting and pushing to git...');
  try {
    execSync('git add documents.json feed.xml', { stdio: 'inherit' });
    execSync(`git commit -m 'Add: ${title}'`, { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    console.log('\nChanges pushed to remote!\n');
  } catch (err) {
    console.log('\nGit operation failed. You may need to push manually.\n');
  }
}

function regenerateFeed() {
  console.log('\nRegenerating RSS feed...');
  try {
    execSync('node generate-feed.js', { stdio: 'inherit' });
  } catch (err) {
    console.log('\nFeed generation failed. Continuing with git commit...\n');
  }
}

async function listDocuments() {
  console.log('\nDocument List\n');

  const documents = loadDocuments();

  if (documents.length === 0) {
    console.log('No documents found.\n');
    rl.close();
    return;
  }

  documents.forEach((doc, index) => {
    console.log(`${index + 1}. [Order: ${doc.order}] ${doc.title}`);
    console.log(`   Author: ${formatAuthor(doc.author)}`);
    console.log(`   Tags: ${doc.tags.join(', ')}`);
    console.log('');
  });

  rl.close();
}

async function addDocument() {
  console.log('\nAdd New Document to Database\n');

  const documents = loadDocuments();

  const highestOrder = Math.max(...documents.map(d => d.order || 0));
  const newOrder = highestOrder + ORDER_INCREMENT;

  const title = await promptRequired('Title: ', 'Title');
  const url = await promptRequired('URL: ', 'URL');

  console.log('\nPlatform options: google-docs, google-slides, notion, airtable');
  const platform = await promptRequired('Platform: ', 'Platform');
  const author = await promptRequired('Author: ', 'Author');
  const description = await promptRequired('Description: ', 'Description');

  console.log('\nCommon tags: software, hardware, firmware, technical-paper, explainer, strategy, reading-list, research-agenda');
  const tagsInput = await question('Tags (comma-separated): ');
  const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);

  const newDoc = {
    title,
    url,
    platform,
    author,
    description,
    tags,
    order: newOrder,
    date_added: new Date().toISOString()
  };

  documents.unshift(newDoc);
  saveDocuments(documents);

  console.log('\nDocument added successfully!');
  console.log(`   Order: ${newOrder}`);

  regenerateFeed();
  commitAndPush(title);

  rl.close();
}

async function editDocument() {
  console.log('\nEdit Document\n');

  const documents = loadDocuments();

  if (documents.length === 0) {
    console.log('No documents found.\n');
    rl.close();
    return;
  }

  documents.forEach((doc, index) => {
    console.log(`${index + 1}. ${doc.title} (${formatAuthor(doc.author)})`);
  });

  const selection = await question('\nSelect document number to edit: ');
  const docIndex = parseInt(selection) - 1;

  if (isNaN(docIndex) || docIndex < 0 || docIndex >= documents.length) {
    console.log('Error: Invalid selection');
    rl.close();
    return;
  }

  const doc = documents[docIndex];
  console.log('\nCurrent values (press Enter to keep current value):\n');

  await editField(doc, 'title', 'Title');
  await editField(doc, 'url', 'URL');
  await editField(doc, 'platform', 'Platform');
  await editField(doc, 'author', 'Author', formatAuthor);
  await editField(doc, 'description', 'Description');

  const currentTags = doc.tags.join(', ');
  const tagsInput = await question(`Tags [${currentTags}]: `);
  if (tagsInput.trim()) {
    doc.tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
  }

  const order = await question(`Order [${doc.order}]: `);
  if (order.trim() && !isNaN(parseInt(order))) {
    doc.order = parseInt(order);
  }

  saveDocuments(documents);

  console.log('\nDocument updated successfully!\n');
  rl.close();
}

async function deleteDocument() {
  console.log('\nDelete Document\n');

  const documents = loadDocuments();

  if (documents.length === 0) {
    console.log('No documents found.\n');
    rl.close();
    return;
  }

  documents.forEach((doc, index) => {
    console.log(`${index + 1}. ${doc.title} (${formatAuthor(doc.author)})`);
  });

  const selection = await question('\nSelect document number to delete: ');
  const docIndex = parseInt(selection) - 1;

  if (isNaN(docIndex) || docIndex < 0 || docIndex >= documents.length) {
    console.log('Error: Invalid selection');
    rl.close();
    return;
  }

  const doc = documents[docIndex];
  console.log('\nDocument to delete:');
  console.log(`   Title: ${doc.title}`);
  console.log(`   Author: ${formatAuthor(doc.author)}`);
  console.log(`   URL: ${doc.url}`);

  const confirm = await question('\nAre you sure you want to delete this document? (yes/no): ');

  if (confirm.toLowerCase() === 'yes') {
    documents.splice(docIndex, 1);
    saveDocuments(documents);
    console.log('\nDocument deleted successfully!\n');
  } else {
    console.log('\nDeletion cancelled.\n');
  }

  rl.close();
}

function showUsage() {
  console.log('\nDocument Manager\n');
  console.log('Usage: node add-document.js [command]\n');
  console.log('Commands:');
  console.log('  add     Add a new document');
  console.log('  edit    Edit an existing document');
  console.log('  delete  Delete a document');
  console.log('  list    List all documents');
  console.log('\nIf no command is provided, defaults to "add"\n');
}

async function main() {
  const command = process.argv[2] || 'add';

  try {
    switch (command.toLowerCase()) {
      case 'add':
        await addDocument();
        break;
      case 'edit':
        await editDocument();
        break;
      case 'delete':
        await deleteDocument();
        break;
      case 'list':
        await listDocuments();
        break;
      case 'help':
      case '--help':
      case '-h':
        showUsage();
        rl.close();
        break;
      default:
        console.log(`Error: Unknown command: ${command}`);
        showUsage();
        rl.close();
        process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    rl.close();
    process.exit(1);
  }
}

main();
