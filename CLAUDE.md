# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Living Verification Documents (Proofworks) - A static website with email subscription system for distributing curated AI verification documents. Uses Supabase for subscriber management, Resend for transactional emails, and GitHub Actions for automated notifications.

## Model Selection Guidance

When the user requests a complex task, check the current model being used. If not using Opus 4.5 (claude-opus-4-5-20251101), remind the user that complex tasks may benefit from the more capable Opus 4.5 model.

Complex tasks include:
- Multi-file architectural changes or refactoring
- New feature implementations affecting multiple systems
- Complex debugging requiring deep analysis
- Database schema changes or migrations
- Significant changes to email templates, workflows, or edge functions
- Performance optimization or security improvements
- Major UI/UX redesigns

Simple tasks that don't require a reminder:
- Single-file edits or bug fixes
- Adding/editing/deleting documents via existing scripts
- Regenerating RSS feeds
- Deployment of existing code
- Reading or explaining code

## Commands

### Local Development
```bash
npm run dev                   # Start local server at http://localhost:3000
```

### Document Management
```bash
node add-document.js add      # Add new document (interactive)
node add-document.js edit     # Edit existing document
node add-document.js delete   # Delete document
node add-document.js list     # List all documents
```

### RSS Feed
```bash
node generate-feed.js         # Regenerate feed.xml from documents.json
```

### Email Notifications
```bash
node send-emails.js                      # Send immediate notifications (new docs within 10 min)
node send-digest.js --frequency daily    # Send daily digest
node send-digest.js --frequency weekly   # Send weekly digest
```

### Supabase Functions
```bash
supabase link --project-ref jsbmozalhtxnekufeals
supabase functions deploy                # Deploy all edge functions
supabase functions deploy <function>     # Deploy single function
```

## Architecture

### Data Flow
1. Documents stored in `documents.json` (source of truth)
2. RSS feed generated from documents via `generate-feed.js`
3. GitHub Actions triggers email notifications on document changes
4. Subscribers managed in Supabase with email verification workflow

### Supabase Edge Functions (Deno/TypeScript)
- `subscribe/` - New subscriptions with email verification (24hr token expiry)
- `verify-email/` - Token validation, redirects to static result pages
- `preferences/` - GET/POST for subscription settings
- `unsubscribe/` - One-click unsubscribe from email links
- `_shared/send-email.ts` - Resend API wrapper
- `_shared/email-templates.ts` - HTML email templates

### Static Pages
- `index.html` - Main document listing with search/filter
- `preferences.html` - Subscription preference management (uses token from URL)
- `verified.html`, `already-verified.html`, `verify-error.html` - Verification result pages

### Automated Workflows (GitHub Actions)
- `update-feed.yml` - On documents.json push: regenerate feed, send immediate emails
- `daily-digest.yml` - 6pm UTC daily
- `weekly-digest.yml` - 6pm UTC Mondays

## Database Schema

Supabase `subscribers` table:
- `email`, `is_active`, `email_verified`, `email_frequency` (immediate/daily/weekly)
- `verification_token`, `verification_token_expires_at` - For email verification
- `preferences_token`, `unsubscribe_token` - For managing subscriptions

## Environment Variables

Required in GitHub Actions and Supabase:
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
```

## Key Implementation Details

- Email sending uses Resend API; sender is `updates@proofworks.cc`
- Verification tokens expire in 24 hours
- Site URL is `https://proofworks.cc`
- Frontend is vanilla HTML/CSS/JS with no build step
- Edge functions use Deno runtime with esm.sh imports
