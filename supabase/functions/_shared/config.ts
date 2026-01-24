// Centralized configuration for Supabase edge functions

export const SITE_URL = 'https://proofworks.cc'
export const BRAND_COLOR = '#5b8a8a'
export const VERIFICATION_EXPIRY_HOURS = 24
export const VALID_FREQUENCIES = ['immediate', 'daily', 'weekly'] as const

export type EmailFrequency = typeof VALID_FREQUENCIES[number]
