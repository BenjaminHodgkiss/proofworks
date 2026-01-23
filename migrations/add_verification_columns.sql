-- Migration: Add email verification and preferences columns
-- Run this manually in Supabase dashboard SQL editor

-- Add new columns for email verification flow
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_token UUID,
ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS preferences_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Grandfather existing active subscribers as verified
UPDATE subscribers
SET email_verified = TRUE, verified_at = NOW()
WHERE is_active = TRUE;

-- Generate preferences tokens for existing subscribers
UPDATE subscribers
SET preferences_token = gen_random_uuid()
WHERE preferences_token IS NULL;

-- Create index on verification_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscribers_verification_token
ON subscribers(verification_token)
WHERE verification_token IS NOT NULL;

-- Create index on preferences_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscribers_preferences_token
ON subscribers(preferences_token);
