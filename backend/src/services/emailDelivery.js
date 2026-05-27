const axios = require('axios');

const APP_NAME = 'Build Profit Solutions';

function providerName() {
  return String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
}

function fromAddress() {
  const email = process.env.WORKSPACE_INVITE_FROM_EMAIL || process.env.EMAIL_FROM;
  if (!email) return null;
  const name = process.env.WORKSPACE_INVITE_FROM_NAME || APP_NAME;
  return `${name} <${email}>`;
}

function inviteUrl() {
  return process.env.WORKSPACE_INVITE_URL || 'https://buildprofitsolutions.com';
}

function buildWorkspaceInviteEmail({ workspace, member, invitedByEmail }) {
  const recipientName = member.displayName || member.email || 'there';
  const workspaceName = workspace?.name || 'Build Profit Workspace';
  const url = inviteUrl();
  const subject = `You're invited to ${workspaceName}`;
  const text = [
    `Hi ${recipientName},`,
    '',
    `You've been invited to join ${workspaceName} in ${APP_NAME}.`,
    invitedByEmail ? `Invited by: ${invitedByEmail}` : null,
    '',
    `Open ${APP_NAME} and sign up or sign in with ${member.email}.`,
    `Workspace access activates automatically after you sign in with this email.`,
    '',
    `Open app: ${url}`,
  ].filter(Boolean).join('\n');
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">You're invited to ${workspaceName}</h2>
      <p>Hi ${recipientName},</p>
      <p>You've been invited to join <strong>${workspaceName}</strong> in ${APP_NAME}.</p>
      ${invitedByEmail ? `<p style="color: #4b5563;">Invited by: ${invitedByEmail}</p>` : ''}
      <p>Sign up or sign in with <strong>${member.email}</strong>. Workspace access activates automatically after you sign in with this email.</p>
      <p>
        <a href="${url}" style="display: inline-block; background: #22c55e; color: #001b14; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 700;">
          Open Build Profit Solutions
        </a>
      </p>
    </div>
  `;

  return { subject, text, html };
}

async function sendWithResend({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = fromAddress();
  if (!apiKey || !from) {
    return { sent: false, skipped: true, reason: 'Missing RESEND_API_KEY or WORKSPACE_INVITE_FROM_EMAIL' };
  }

  const response = await axios.post(
    'https://api.resend.com/emails',
    { from, to, subject, text, html },
    { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
  );
  return { sent: true, provider: 'resend', id: response.data?.id || null };
}

async function sendWithSendGrid({ to, subject, text, html }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.WORKSPACE_INVITE_FROM_EMAIL || process.env.EMAIL_FROM;
  const fromName = process.env.WORKSPACE_INVITE_FROM_NAME || APP_NAME;
  if (!apiKey || !fromEmail) {
    return { sent: false, skipped: true, reason: 'Missing SENDGRID_API_KEY or WORKSPACE_INVITE_FROM_EMAIL' };
  }

  await axios.post(
    'https://api.sendgrid.com/v3/mail/send',
    {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    },
    { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
  );
  return { sent: true, provider: 'sendgrid', id: null };
}

async function sendWorkspaceInviteEmail({ workspace, member, invitedByEmail }) {
  if (!member?.email) {
    return { sent: false, skipped: true, reason: 'Missing recipient email' };
  }

  const message = buildWorkspaceInviteEmail({ workspace, member, invitedByEmail });
  const provider = providerName();

  if (provider === 'resend') {
    return sendWithResend({ to: member.email, ...message });
  }
  if (provider === 'sendgrid') {
    return sendWithSendGrid({ to: member.email, ...message });
  }

  console.info('Workspace invite email not sent; configure EMAIL_PROVIDER=resend or sendgrid.', {
    to: member.email,
    subject: message.subject,
  });
  return { sent: false, skipped: true, reason: 'Email provider not configured' };
}

module.exports = {
  sendWorkspaceInviteEmail,
};
