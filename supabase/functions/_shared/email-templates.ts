// Email templates for the subscription system

const SITE_URL = 'https://proofworks.cc'
const BRAND_COLOR = '#5b8a8a'

function baseTemplate(title: string, content: string, footer: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #faf9f7;">
  <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: ${BRAND_COLOR}; font-size: 24px; margin-bottom: 24px; margin-top: 0;">${title}</h1>
    ${content}
  </div>
  <div style="margin-top: 24px; padding: 0 16px;">
    ${footer}
  </div>
</body>
</html>
  `.trim()
}

function button(text: string, url: string): string {
  return `
    <p style="margin-top: 24px;">
      <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: ${BRAND_COLOR}; color: white; text-decoration: none; border-radius: 4px;">${text}</a>
    </p>
  `
}

export function verificationEmail(verifyUrl: string): string {
  const content = `
    <p style="color: #333; line-height: 1.6; margin: 0 0 16px 0;">
      Thanks for subscribing to AI Verification Document updates.
    </p>
    <p style="color: #333; line-height: 1.6; margin: 0 0 16px 0;">
      Please verify your email address by clicking the button below:
    </p>
    ${button('Verify Email Address', verifyUrl)}
    <p style="color: #666; font-size: 14px; margin-top: 24px;">
      This link will expire in 24 hours. If you didn't subscribe, you can ignore this email.
    </p>
    <p style="color: #999; font-size: 12px; margin-top: 16px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${verifyUrl}" style="color: ${BRAND_COLOR}; word-break: break-all;">${verifyUrl}</a>
    </p>
  `
  const footer = `
    <p style="font-size: 12px; color: #999; margin: 0;">
      You received this email because someone subscribed with this address at <a href="${SITE_URL}" style="color: #999;">AI Verification Documents</a>.
    </p>
  `
  return baseTemplate('Verify Your Subscription', content, footer)
}

export function welcomeEmail(frequency: string, preferencesUrl: string): string {
  const frequencyText = frequency === 'immediate'
    ? 'immediately when new documents are added'
    : frequency === 'daily'
    ? 'in a daily digest'
    : 'in a weekly digest (Mondays)'

  const content = `
    <p style="color: #333; line-height: 1.6; margin: 0 0 16px 0;">
      Your subscription to AI Verification Documents is now active.
    </p>
    <p style="color: #333; line-height: 1.6; margin: 0 0 16px 0;">
      You'll receive updates <strong>${frequencyText}</strong>.
    </p>
    ${button('Browse Documents', SITE_URL)}
    <p style="color: #666; font-size: 14px; margin-top: 24px;">
      You can <a href="${preferencesUrl}" style="color: ${BRAND_COLOR};">manage your preferences</a> at any time.
    </p>
  `
  const footer = `
    <p style="font-size: 12px; color: #999; margin: 0;">
      <a href="${preferencesUrl}" style="color: #999;">Manage preferences</a>
    </p>
  `
  return baseTemplate('Welcome to AI Verification Documents', content, footer)
}

export function frequencyChangeEmail(newFrequency: string, preferencesUrl: string): string {
  const frequencyText = newFrequency === 'immediate'
    ? 'immediately when new documents are added'
    : newFrequency === 'daily'
    ? 'in a daily digest'
    : 'in a weekly digest (Mondays)'

  const content = `
    <p style="color: #333; line-height: 1.6; margin: 0 0 16px 0;">
      Your subscription preferences have been updated.
    </p>
    <p style="color: #333; line-height: 1.6; margin: 0 0 16px 0;">
      You'll now receive updates <strong>${frequencyText}</strong>.
    </p>
    <p style="color: #666; font-size: 14px; margin-top: 24px;">
      You can <a href="${preferencesUrl}" style="color: ${BRAND_COLOR};">manage your preferences</a> at any time.
    </p>
  `
  const footer = `
    <p style="font-size: 12px; color: #999; margin: 0;">
      <a href="${preferencesUrl}" style="color: #999;">Manage preferences</a>
    </p>
  `
  return baseTemplate('Your Preferences Have Been Updated', content, footer)
}

export function unsubscribeConfirmationEmail(): string {
  const content = `
    <p style="color: #333; line-height: 1.6; margin: 0 0 16px 0;">
      You have been unsubscribed from AI Verification Document updates.
    </p>
    <p style="color: #333; line-height: 1.6; margin: 0 0 16px 0;">
      You will no longer receive emails from us.
    </p>
    <p style="color: #666; font-size: 14px; margin-top: 24px;">
      Changed your mind? You can <a href="${SITE_URL}" style="color: ${BRAND_COLOR};">resubscribe</a> at any time.
    </p>
  `
  const footer = `
    <p style="font-size: 12px; color: #999; margin: 0;">
      This is a confirmation of your unsubscribe request.
    </p>
  `
  return baseTemplate("You've Been Unsubscribed", content, footer)
}

export function welcomeBackEmail(frequency: string, preferencesUrl: string): string {
  const frequencyText = frequency === 'immediate'
    ? 'immediately when new documents are added'
    : frequency === 'daily'
    ? 'in a daily digest'
    : 'in a weekly digest (Mondays)'

  const content = `
    <p style="color: #333; line-height: 1.6; margin: 0 0 16px 0;">
      Welcome back! Your subscription to AI Verification Documents has been reactivated.
    </p>
    <p style="color: #333; line-height: 1.6; margin: 0 0 16px 0;">
      You'll receive updates <strong>${frequencyText}</strong>.
    </p>
    ${button('Browse Documents', SITE_URL)}
    <p style="color: #666; font-size: 14px; margin-top: 24px;">
      You can <a href="${preferencesUrl}" style="color: ${BRAND_COLOR};">manage your preferences</a> at any time.
    </p>
  `
  const footer = `
    <p style="font-size: 12px; color: #999; margin: 0;">
      <a href="${preferencesUrl}" style="color: #999;">Manage preferences</a>
    </p>
  `
  return baseTemplate('Welcome Back!', content, footer)
}
