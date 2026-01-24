# Refactoring Plan

## Executive Summary

The Proofworks codebase is a well-structured static website with email subscription functionality. The code is generally clean and functional, with good foundations already in place (`lib/config.js`, `lib/utils.js`, `_shared/` modules).

**Overall Health: Good with room for improvement**

Key improvement areas:
1. **Duplicated code** across email-sending scripts and HTML templates
2. **Long functions** that could benefit from extraction
3. **Configuration drift potential** - same values defined in multiple places
4. **One bug** - undefined variable reference in preferences.html

The refactoring should build on existing patterns rather than introducing new architectural concepts.

---

## Current Architecture

### What Works Well

1. **Clear separation of concerns**: Node.js scripts handle server-side tasks, static HTML/JS handles frontend
2. **Centralized configuration**: `lib/config.js` and `_shared/config.ts` centralize constants
3. **Utility extraction**: Common functions already in `lib/utils.js`
4. **Shared response helpers**: Edge functions use standardized `jsonResponse`, `errorResponse`, etc.
5. **Simple frontend**: Vanilla HTML/CSS/JS with no build step keeps complexity low
6. **CSS variables**: Consistent theming with `--accent`, `--bg-primary`, etc.

### Dependency Map

```
documents.json
    |
    +---> generate-feed.js ---> feed.xml
    |
    +---> send-emails.js ----+
    |                        |
    +---> send-digest.js ----+---> lib/email.js ---> Resend API
                             |
                             +---> lib/config.js
                             |
                             +---> lib/utils.js

index.html, living-docs/index.html (static)
    |
    +---> script.js ---> documents.json (fetch)
    +---> styles.css

supabase/functions/
    |
    +---> subscribe/      ---+
    +---> verify-email/   ---+---> _shared/send-email.ts ---> Resend API
    +---> preferences/    ---+---> _shared/email-templates.ts
    +---> unsubscribe/    ---+---> _shared/config.ts
                             +---> _shared/cors.ts
                             +---> _shared/responses.ts

GitHub Actions:
    update-feed.yml ---> generate-feed.js, send-emails.js
    daily-digest.yml ---> send-digest.js
    weekly-digest.yml ---> send-digest.js
```

**Critical Dependencies:**
- `documents.json` is the source of truth for all document data
- `lib/config.js` and `_shared/config.ts` must stay in sync
- Email templates in Node.js and Deno are completely separate codebases

---

## Code Smell Analysis

### High Priority

| Issue | Location | Impact |
|-------|----------|--------|
| Duplicated email HTML generation | `send-emails.js:70-113` and `send-digest.js:100-149` | ~80% shared code, maintenance burden |
| Long subscribe handler | `supabase/functions/subscribe/index.ts:8-139` | 131 lines, multiple responsibilities |
| Bug: undefined variable | `preferences.html:465` references `unsubscribedStateEl` | Runtime error when resubscribing |

### Medium Priority

| Issue | Location | Impact |
|-------|----------|--------|
| Status page CSS duplication | 5 HTML files with identical inline CSS | ~225 lines duplicated |
| Document loading duplication | `add-document.js:31-46` and `generate-feed.js:47-61` | Inconsistent error handling possible |
| Date filtering duplication | `send-emails.js:20-24` and `send-digest.js:49-53` | Logic drift risk |
| Supabase client init repeated | 4 edge functions, ~4 lines each | Minor maintenance overhead |

### Low Priority

| Issue | Location | Impact |
|-------|----------|--------|
| Frontend formatAuthor duplicate | `script.js:226-232` vs `lib/utils.js:45-48` | Intentional, needs documentation |
| Magic numbers | `send-digest.js:34-36` | Minor readability issue |
| Hardcoded Supabase URL | `living-docs/index.html:29`, `preferences.html:289` | Could drift |

---

## Implementation Plan

### Phase 1: Bug Fix and Quick Wins

**Task 1.1: Fix preferences.html undefined variable bug**

Line 465 references `unsubscribedStateEl` but it's never defined. Add around line 300:
```javascript
const unsubscribedStateEl = document.getElementById('unsubscribed-state');
```

**Task 1.2: Add time constants to config**

Add to `lib/config.js`:
```javascript
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

module.exports = {
  // ... existing exports
  ONE_DAY_MS,
  ONE_WEEK_MS
};
```

Update `send-digest.js` to use these constants.

---

### Phase 2: Utility Extraction

**Task 2.1: Extract loadDocuments utility**

Add to `lib/utils.js`:
```javascript
function loadDocuments(exitOnError = true) {
  const { DOCUMENTS_PATH } = require('./config');
  const fs = require('fs');

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
```

Update `add-document.js` and `generate-feed.js` to use this utility.

**Task 2.2: Extract filterDocumentsByDate utility**

Add to `lib/utils.js`:
```javascript
function filterDocumentsByDate(documents, sinceDate) {
  return documents.filter(doc => {
    if (!doc.date_added) return false;
    const docDate = new Date(doc.date_added);
    return docDate >= sinceDate;
  });
}
```

Update `send-emails.js` and `send-digest.js` to use this utility.

**Task 2.3: Extract Supabase client factory**

Create `supabase/functions/_shared/supabase.ts`:
```typescript
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(supabaseUrl, supabaseServiceKey)
}

export function getSupabaseUrl(): string {
  return Deno.env.get('SUPABASE_URL')!
}
```

Update all four edge functions to use this factory.

---

### Phase 3: Template Consolidation

**Task 3.1: Create shared status page CSS**

Create `status-pages.css` with the shared styles from status pages. Update all five HTML files to link to this stylesheet:
- `verified.html`
- `verify-error.html`
- `unsubscribed.html`
- `already-verified.html`
- `unsubscribe-error.html`

Reduces ~225 lines of duplicated CSS to 5 `<link>` tags.

**Task 3.2: Extract shared email template builder**

Create `lib/email-templates.js`:
```javascript
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

function emailWrapper(title, content) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h1 style="color: ${BRAND_COLOR}; font-size: 24px; margin-bottom: 24px;">${title}</h1>
  ${content}
</body>
</html>`;
}

function footer(preferencesUrl, unsubscribeUrl, frequencyText = '') {
  const frequencyNote = frequencyText ? ` ${frequencyText}` : '';
  return `
  <p style="margin-top: 32px;">
    <a href="${SITE_URL}" style="display: inline-block; padding: 12px 24px; background-color: ${BRAND_COLOR}; color: white; text-decoration: none; border-radius: 4px;">View All Documents</a>
  </p>
  <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;">
  <p style="font-size: 12px; color: #999; margin-bottom: 16px;">
    You're receiving this${frequencyNote} because you subscribed to Living Verification Documents updates.
    <a href="${preferencesUrl}" style="color: #999;">Manage preferences</a>
  </p>
  <p style="text-align: center;">
    <a href="${unsubscribeUrl}" style="display: inline-block; padding: 10px 20px; background-color: #666; color: white; text-decoration: none; border-radius: 4px; font-size: 14px;">Unsubscribe</a>
  </p>`;
}

function generateImmediateNotificationHtml(documents) {
  const documentsList = documents.map(documentCard).join('');
  const content = `${documentsList}{{FOOTER}}`;
  return emailWrapper('New Living Verification Documents', content);
}

function generateDigestHtml(documents, frequency) {
  const periodLabel = frequency === 'daily' ? 'Daily' : 'Weekly';
  const periodDescription = frequency === 'daily' ? 'the past 24 hours' : 'the past week';
  const documentsList = documents.map(documentCard).join('');

  const content = `
  <p style="color: #666; font-size: 14px; margin-top: -16px; margin-bottom: 24px;">
    ${documents.length} new document${documents.length === 1 ? '' : 's'} added in ${periodDescription}
  </p>
  ${documentsList}{{FOOTER}}`;

  return emailWrapper(`${periodLabel} Digest`, content);
}

module.exports = {
  generateImmediateNotificationHtml,
  generateDigestHtml,
  footer
};
```

Update `send-emails.js` and `send-digest.js` to use this module.

---

### Phase 4: Function Decomposition

**Task 4.1: Refactor subscribe handler**

Extract the 131-line handler into smaller functions in `_shared/subscriber-operations.ts`:
- `handleExistingSubscriber()` - handle already-subscribed cases
- `createNewSubscriber()` - create new subscription
- `sendVerificationToSubscriber()` - send verification email

**Task 4.2: Simplify editDocument in add-document.js**

Extract repetitive field editing into a helper:
```javascript
async function editField(doc, fieldName, displayName, formatter = (v) => v) {
  const currentValue = formatter(doc[fieldName]);
  const newValue = await question(`${displayName} [${currentValue}]: `);
  if (newValue.trim()) {
    doc[fieldName] = newValue.trim();
  }
}
```

---

### Phase 5: Documentation

**Task 5.1: Document frontend/backend formatAuthor separation**

Add comment in `script.js`:
```javascript
// Note: This formatAuthor duplicates lib/utils.js intentionally.
// The frontend runs in browser without Node.js, so cannot import lib/.
// Keep implementations in sync if behavior changes.
```

---

## Testing Strategy

**Before any refactoring:**
1. Test current subscription flow end-to-end
2. Test email sending: `node send-emails.js` and `node send-digest.js --frequency daily`
3. Verify document management: `node add-document.js list`
4. Capture current email HTML output for comparison

**During refactoring:**
1. After each phase, repeat relevant tests
2. For email template changes: compare HTML output character-by-character
3. For Supabase changes: test in staging before production deployment
4. For CSS changes: visual comparison in browser

---

## Summary Table

| Task | Files Affected | Risk | Phase |
|------|---------------|------|-------|
| 1.1 Bug fix | preferences.html | None | 1 |
| 1.2 Time constants | lib/config.js, send-digest.js | Low | 1 |
| 2.1 loadDocuments | lib/utils.js, add-document.js, generate-feed.js | Low | 2 |
| 2.2 filterDocumentsByDate | lib/utils.js, send-emails.js, send-digest.js | Low | 2 |
| 2.3 Supabase client factory | _shared/supabase.ts (new), 4 edge functions | Low | 2 |
| 3.1 Status page CSS | status-pages.css (new), 5 HTML files | Low | 3 |
| 3.2 Email template builder | lib/email-templates.js (new), send-emails.js, send-digest.js | Medium | 3 |
| 4.1 Refactor subscribe | subscribe/index.ts, _shared/subscriber-operations.ts | Medium | 4 |
| 4.2 Simplify editDocument | add-document.js | Low | 4 |
| 5.1 Documentation | script.js | None | 5 |

---

## Safety Measures

1. **Create a feature branch** before making changes
2. **For Node.js changes:** Run existing scripts to verify output matches
3. **For Supabase changes:** Test in staging environment before production
4. **For HTML/CSS changes:** Visual inspection across browsers
5. **For email templates:** Send test emails to verify rendering

**Recommended implementation order:** Follow phases 1-5 sequentially. Each phase builds on the previous and can be committed independently.
