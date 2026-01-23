#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function loadDocuments() {
  const documentsJson = fs.readFileSync('documents.json', 'utf-8');
  return JSON.parse(documentsJson);
}

function saveDocuments(documents) {
  fs.writeFileSync('documents.json', JSON.stringify(documents, null, 2) + '\n');
}

async function listDocuments() {
  console.log('\n📚 Document List\n');

  const documents = loadDocuments();

  if (documents.length === 0) {
    console.log('No documents found.\n');
    rl.close();
    return;
  }

  documents.forEach((doc, index) => {
    const authorDisplay = Array.isArray(doc.author) ? doc.author.join(', ') : doc.author;
    const tagsDisplay = doc.tags.join(', ');
    console.log(`${index + 1}. [Order: ${doc.order}] ${doc.title}`);
    console.log(`   Author: ${authorDisplay}`);
    console.log(`   Tags: ${tagsDisplay}`);
    console.log('');
  });

  rl.close();
}

async function addDocument() {
  console.log('\n📄 Add New Document to Database\n');

  const documents = loadDocuments();

  // Get highest order number and increment
  const highestOrder = Math.max(...documents.map(d => d.order || 0));
  const newOrder = highestOrder + 10;

  // Prompt for fields
  const title = await question('Title: ');
  if (!title.trim()) {
    console.log('❌ Title is required');
    rl.close();
    return;
  }

  const url = await question('URL: ');
  if (!url.trim()) {
    console.log('❌ URL is required');
    rl.close();
    return;
  }

  console.log('\nPlatform options: google-docs, google-slides, notion, airtable');
  const platform = await question('Platform: ');
  if (!platform.trim()) {
    console.log('❌ Platform is required');
    rl.close();
    return;
  }

  const author = await question('Author: ');
  if (!author.trim()) {
    console.log('❌ Author is required');
    rl.close();
    return;
  }

  const description = await question('Description: ');
  if (!description.trim()) {
    console.log('❌ Description is required');
    rl.close();
    return;
  }

  console.log('\nCommon tags: software, hardware, firmware, technical-paper, explainer, strategy, reading-list, research-agenda');
  const tagsInput = await question('Tags (comma-separated): ');
  const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);

  // Build new document object
  const newDoc = {
    title: title.trim(),
    url: url.trim(),
    platform: platform.trim(),
    author: author.trim(),
    description: description.trim(),
    tags: tags,
    order: newOrder,
    date_added: new Date().toISOString()
  };

  // Add to beginning of array (highest order first)
  documents.unshift(newDoc);

  saveDocuments(documents);

  console.log('\n✅ Document added successfully!');
  console.log(`   Order: ${newOrder}`);

  // Automatically commit and push
  console.log('\n📤 Committing and pushing to git...');
  try {
    execSync('git add documents.json', { stdio: 'inherit' });
    execSync(`git commit -m 'Add: ${title.trim()}'`, { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    console.log('\n✅ Changes pushed to remote!\n');
  } catch (err) {
    console.log('\n⚠️  Git operation failed. You may need to push manually.\n');
  }

  rl.close();
}

async function editDocument() {
  console.log('\n✏️  Edit Document\n');

  const documents = loadDocuments();

  if (documents.length === 0) {
    console.log('No documents found.\n');
    rl.close();
    return;
  }

  // Display documents
  documents.forEach((doc, index) => {
    const authorDisplay = Array.isArray(doc.author) ? doc.author.join(', ') : doc.author;
    console.log(`${index + 1}. ${doc.title} (${authorDisplay})`);
  });

  const selection = await question('\nSelect document number to edit: ');
  const docIndex = parseInt(selection) - 1;

  if (isNaN(docIndex) || docIndex < 0 || docIndex >= documents.length) {
    console.log('❌ Invalid selection');
    rl.close();
    return;
  }

  const doc = documents[docIndex];
  console.log('\n📝 Current values (press Enter to keep current value):\n');

  // Edit each field
  const title = await question(`Title [${doc.title}]: `);
  if (title.trim()) doc.title = title.trim();

  const url = await question(`URL [${doc.url}]: `);
  if (url.trim()) doc.url = url.trim();

  const platform = await question(`Platform [${doc.platform}]: `);
  if (platform.trim()) doc.platform = platform.trim();

  const currentAuthor = Array.isArray(doc.author) ? doc.author.join(', ') : doc.author;
  const author = await question(`Author [${currentAuthor}]: `);
  if (author.trim()) doc.author = author.trim();

  const description = await question(`Description [${doc.description}]: `);
  if (description.trim()) doc.description = description.trim();

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

  console.log('\n✅ Document updated successfully!\n');
  rl.close();
}

async function deleteDocument() {
  console.log('\n🗑️  Delete Document\n');

  const documents = loadDocuments();

  if (documents.length === 0) {
    console.log('No documents found.\n');
    rl.close();
    return;
  }

  // Display documents
  documents.forEach((doc, index) => {
    const authorDisplay = Array.isArray(doc.author) ? doc.author.join(', ') : doc.author;
    console.log(`${index + 1}. ${doc.title} (${authorDisplay})`);
  });

  const selection = await question('\nSelect document number to delete: ');
  const docIndex = parseInt(selection) - 1;

  if (isNaN(docIndex) || docIndex < 0 || docIndex >= documents.length) {
    console.log('❌ Invalid selection');
    rl.close();
    return;
  }

  const doc = documents[docIndex];
  console.log('\n📄 Document to delete:');
  console.log(`   Title: ${doc.title}`);
  console.log(`   Author: ${Array.isArray(doc.author) ? doc.author.join(', ') : doc.author}`);
  console.log(`   URL: ${doc.url}`);

  const confirm = await question('\n⚠️  Are you sure you want to delete this document? (yes/no): ');

  if (confirm.toLowerCase() === 'yes') {
    documents.splice(docIndex, 1);
    saveDocuments(documents);
    console.log('\n✅ Document deleted successfully!\n');
  } else {
    console.log('\n❌ Deletion cancelled.\n');
  }

  rl.close();
}

function showUsage() {
  console.log('\n📚 Document Manager\n');
  console.log('Usage: node add-document.js [command]\n');
  console.log('Commands:');
  console.log('  add     Add a new document');
  console.log('  edit    Edit an existing document');
  console.log('  delete  Delete a document');
  console.log('  list    List all documents');
  console.log('\nIf no command is provided, defaults to "add"\n');
}

// Main command router
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
        console.log(`❌ Unknown command: ${command}`);
        showUsage();
        rl.close();
        process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    rl.close();
    process.exit(1);
  }
}

main();
