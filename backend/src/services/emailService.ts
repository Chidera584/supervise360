import nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@supervise360.com';
const FROM_NAME = process.env.FROM_NAME || 'Supervise360';

/** Path to logo file for email embedding */
function getLogoPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'assets', 'logo-email.png'),
    path.join(__dirname, '..', '..', 'assets', 'logo-email.png'),
    path.join(process.cwd(), '..', 'public', 'logo-email.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

if (getLogoPath()) {
  console.log('📧 Email logo ready: backend/assets/logo-email.png');
} else {
  console.warn('📧 Email logo NOT found - add backend/assets/logo-email.png for logo in emails');
}

/** Logo attachment for nodemailer (CID embedding - works in all email clients) */
function getLogoAttachment(): { filename: string; content: Buffer; cid: string } | null {
  const logoPath = getLogoPath();
  if (!logoPath) {
    console.warn('📧 Email logo not found at backend/assets/logo-email.png - logo will not appear in emails');
    return null;
  }
  try {
    const content = fs.readFileSync(logoPath);
    return { filename: 'logo.png', content, cid: 'supervise360-logo' };
  } catch (_) {
    return null;
  }
}

/** Shared email layout: branded header, content block, CTA, footer */
function emailLayout(options: {
  categoryLabel?: string;
  title: string;
  subtitle?: string;
  content: string;
  ctaLabel: string;
  ctaUrl: string;
  metadata?: string;
  accentColor?: string;
}) {
  const accent = options.accentColor || '#0d9488';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9; padding: 24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px; background:#ffffff; border-radius:12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); overflow:hidden;">
          <!-- Brand Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 24px 32px;">
              <img src="cid:supervise360-logo" alt="Supervise360" width="32" height="32" style="vertical-align:middle; margin-right:10px; filter:invert(1); border-radius:8px;" />
              <span style="font-size:22px; font-weight:700; color:#ffffff; letter-spacing:-0.5px;">Supervise360</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              ${options.categoryLabel ? `
              <div style="display:inline-block; background:${accent}15; color:${accent}; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; padding:6px 12px; border-radius:6px; margin-bottom:16px;">
                ${options.categoryLabel}
              </div>
              ` : ''}
              <h1 style="margin:0 0 8px; font-size:20px; font-weight:600; color:#1e293b; line-height:1.3;">${options.title}</h1>
              ${options.subtitle ? `<p style="margin:0 0 20px; font-size:14px; color:#64748b;">${options.subtitle}</p>` : ''}
              <div style="font-size:15px; color:#334155; line-height:1.6;">${options.content}</div>
              ${options.metadata ? `<p style="margin:20px 0 0; font-size:12px; color:#94a3b8;">${options.metadata}</p>` : ''}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px;">
                <tr>
                  <td>
                    <a href="${options.ctaUrl}" style="display:inline-block; background:${accent}; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; padding:12px 24px; border-radius:8px; box-shadow: 0 2px 4px rgba(13,148,136,0.3);">${options.ctaLabel}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background:#f8fafc; border-top:1px solid #e2e8f0;">
              <p style="margin:0; font-size:12px; color:#94a3b8;">
                Supervise360<br>
                For support, contact your department administrator.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.warn('⚠️ Email not configured: SMTP_HOST, SMTP_USER, SMTP_PASS required');
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port: port ? parseInt(port, 10) : 587,
    secure: false,
    requireTLS: true, // Gmail and most SMTP servers need this for port 587
    auth: { user, pass },
  });
  return transporter;
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  const result = await sendEmailWithError(to, subject, html, text);
  return result.ok;
}

/** Send a simple test email; returns ok/error for debugging */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  const html = `<p>This is a test email from Supervise360. If you received this, email is working.</p>`;
  return sendEmailWithError(to, 'Supervise360 – Test Email', html);
}

/** Same as sendEmail but returns error message for debugging (e.g. test-email endpoint) */
export async function sendEmailWithError(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ ok: boolean; error?: string }> {
  const trans = getTransporter();
  if (!trans) return { ok: false, error: 'SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS required)' };
  try {
    const fromAddr = process.env.FROM_EMAIL || process.env.SMTP_USER || FROM_EMAIL;
    const logoAtt = html.includes('cid:supervise360-logo') ? getLogoAttachment() : null;
    const attachments = logoAtt ? [logoAtt] : [];
    await trans.sendMail({
      from: `"${FROM_NAME}" <${fromAddr}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
      attachments,
    });
    return { ok: true };
  } catch (err: any) {
    const msg = err?.message || String(err);
    const smtp = err?.response ? ` | SMTP: ${err.response}` : '';
    console.error('📧 Email send error:', msg, smtp);
    return { ok: false, error: msg + smtp };
  }
}

// ─── STUDENT NOTIFICATIONS ───────────────────────────────────────────────────

export async function sendGroupingAndSupervisorEmail(
  to: string,
  studentName: string,
  groupNumber: string,
  supervisorName: string
): Promise<boolean> {
  const subject = `You've been grouped and assigned a supervisor`;
  const html = emailLayout({
    categoryLabel: 'Group assignment',
    title: `Assigned to ${groupNumber}`,
    subtitle: `Hello ${studentName}`,
    content: `
      <p style="margin:0 0 12px;">You've been grouped with <strong>${groupNumber}</strong> and assigned to <strong>${supervisorName}</strong> as your project supervisor.</p>
      <div style="background:#f8fafc; border-radius:8px; padding:16px; margin:16px 0 0; border-left:4px solid #0d9488;">
        <p style="margin:0; font-size:14px;"><strong>Group:</strong> ${groupNumber}</p>
        <p style="margin:8px 0 0; font-size:14px;"><strong>Supervisor:</strong> ${supervisorName}</p>
      </div>
    `,
    ctaLabel: 'View my group',
    ctaUrl: `${FRONTEND_URL}/student/my-group`,
    metadata: `Posted ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
  });
  return sendEmail(to, subject, html);
}

export async function sendSupervisorFeedbackEmail(
  to: string,
  studentName: string,
  supervisorName: string,
  reportTitle: string,
  feedbackSummary: string,
  approved: boolean,
  requiredChanges?: string
): Promise<boolean> {
  const subject = `${supervisorName} reviewed your ${reportTitle} submission`;
  const status = approved ? 'Approved' : 'Changes required';
  const accent = approved ? '#0d9488' : '#d97706';
  const html = emailLayout({
    categoryLabel: 'Supervisor feedback',
    title: `${supervisorName} reviewed your ${reportTitle}`,
    subtitle: `Hello ${studentName}`,
    content: `
      <p style="margin:0 0 12px;">Your submission has been reviewed.</p>
      <div style="background:#f8fafc; border-radius:8px; padding:16px; margin:16px 0 0; border-left:4px solid ${accent};">
        <p style="margin:0; font-size:14px;"><strong>Status:</strong> ${status}</p>
        <p style="margin:12px 0 0; font-size:14px;"><strong>Feedback:</strong></p>
        <p style="margin:4px 0 0; font-size:14px;">${feedbackSummary || 'No additional comments.'}</p>
        ${requiredChanges ? `<p style="margin:12px 0 0; font-size:14px;"><strong>Required changes:</strong></p><p style="margin:4px 0 0;">${requiredChanges}</p>` : ''}
      </div>
    `,
    ctaLabel: 'View reports',
    ctaUrl: `${FRONTEND_URL}/student/reports`,
    accentColor: accent,
    metadata: `Reviewed by ${supervisorName} · ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
  });
  return sendEmail(to, subject, html);
}

export async function sendSubmissionConfirmationEmail(
  to: string,
  studentName: string,
  reportTitle: string,
  fileName: string,
  timestamp: string
): Promise<boolean> {
  const subject = `Your ${reportTitle} has been submitted successfully`;
  const html = emailLayout({
    categoryLabel: 'Submission confirmed',
    title: `${reportTitle} submitted`,
    subtitle: `Hello ${studentName}`,
    content: `
      <p style="margin:0 0 12px;">Your submission has been received and is awaiting review.</p>
      <div style="background:#f0fdf4; border-radius:8px; padding:16px; margin:16px 0 0; border-left:4px solid #22c55e;">
        <p style="margin:0; font-size:14px;"><strong>File:</strong> ${fileName}</p>
        <p style="margin:8px 0 0; font-size:14px;"><strong>Status:</strong> Awaiting review</p>
      </div>
    `,
    ctaLabel: 'View my reports',
    ctaUrl: `${FRONTEND_URL}/student/reports`,
    accentColor: '#22c55e',
    metadata: `Submitted ${timestamp}`,
  });
  return sendEmail(to, subject, html);
}

export async function sendSupervisorMessageEmail(
  to: string,
  studentName: string,
  supervisorName: string,
  messagePreview: string,
  subject: string
): Promise<boolean> {
  const truncated = messagePreview.length > 150 ? messagePreview.substring(0, 150) + '...' : messagePreview;
  const emailSubject = `New message from your supervisor: ${subject}`;
  const html = emailLayout({
    categoryLabel: 'New message',
    title: subject,
    subtitle: `From ${supervisorName} · Hello ${studentName}`,
    content: `
      <p style="margin:0 0 12px;">Your supervisor sent you a message:</p>
      <div style="background:#f8fafc; border-radius:8px; padding:16px; margin:16px 0 0; border-left:4px solid #0d9488; font-style:italic; color:#475569;">
        "${truncated}"
      </div>
    `,
    ctaLabel: 'Reply',
    ctaUrl: `${FRONTEND_URL}/student/messages`,
    metadata: `From ${supervisorName}`,
  });
  return sendEmail(to, emailSubject, html);
}

// ─── SUPERVISOR NOTIFICATIONS ───────────────────────────────────────────────────

export async function sendNewStudentAssignmentEmail(
  to: string,
  supervisorName: string,
  studentCount: number,
  groupCount: number
): Promise<boolean> {
  const subject = `${studentCount} new student${studentCount > 1 ? 's' : ''} assigned to you for supervision`;
  const html = emailLayout({
    categoryLabel: 'New assignment',
    title: `${studentCount} student${studentCount > 1 ? 's' : ''} assigned to you`,
    subtitle: `Hello ${supervisorName}`,
    content: `
      <p style="margin:0 0 12px;">You have ${studentCount} student${studentCount > 1 ? 's' : ''} (${groupCount} group${groupCount > 1 ? 's' : ''}) under your supervision.</p>
      <p style="margin:12px 0 0; font-size:14px; color:#64748b;">View your groups and details on the website.</p>
    `,
    ctaLabel: 'View my groups',
    ctaUrl: `${FRONTEND_URL}/supervisor/my-groups`,
    metadata: `${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
  });
  return sendEmail(to, subject, html);
}

export async function sendStudentSubmissionEmail(
  to: string,
  supervisorName: string,
  studentName: string,
  submissionTitle: string,
  fileName: string
): Promise<boolean> {
  const subject = `${studentName} submitted ${submissionTitle} for review`;
  const html = emailLayout({
    categoryLabel: 'Submission for review',
    title: `${submissionTitle}`,
    subtitle: `From ${studentName} · Hello ${supervisorName}`,
    content: `
      <p style="margin:0 0 12px;">A student has submitted work for your review.</p>
      <div style="background:#fef3c7; border-radius:8px; padding:16px; margin:16px 0 0; border-left:4px solid #d97706;">
        <p style="margin:0; font-size:14px;"><strong>Student:</strong> ${studentName}</p>
        <p style="margin:8px 0 0; font-size:14px;"><strong>File:</strong> ${fileName}</p>
      </div>
    `,
    ctaLabel: 'Review submission',
    ctaUrl: `${FRONTEND_URL}/supervisor/report-reviews`,
    accentColor: '#d97706',
    metadata: `Submitted by ${studentName} · ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
  });
  return sendEmail(to, subject, html);
}

export async function sendStudentMessageEmail(
  to: string,
  supervisorName: string,
  studentName: string,
  messagePreview: string,
  subject: string
): Promise<boolean> {
  const truncated = messagePreview.length > 150 ? messagePreview.substring(0, 150) + '...' : messagePreview;
  const emailSubject = `${studentName} sent you a message about their project`;
  const html = emailLayout({
    categoryLabel: 'New message',
    title: subject,
    subtitle: `From ${studentName} · Hello ${supervisorName}`,
    content: `
      <p style="margin:0 0 12px;">A student sent you a message:</p>
      <div style="background:#f8fafc; border-radius:8px; padding:16px; margin:16px 0 0; border-left:4px solid #0d9488; font-style:italic; color:#475569;">
        "${truncated}"
      </div>
    `,
    ctaLabel: 'Reply',
    ctaUrl: `${FRONTEND_URL}/supervisor/messages`,
    metadata: `From ${studentName}`,
  });
  return sendEmail(to, emailSubject, html);
}

// ─── ADMIN NOTIFICATIONS ───────────────────────────────────────────────────

export async function sendUnassignedStudentsAlertEmail(
  to: string,
  department: string,
  studentList: string[],
  count: number
): Promise<boolean> {
  const subject = `${count} students in ${department} need supervisor assignment`;
  const list = studentList.slice(0, 10).map(s => `<li style="margin:4px 0; font-size:14px;">${s}</li>`).join('');
  const more = studentList.length > 10 ? `<p style="margin:8px 0 0; font-size:13px; color:#64748b;">...and ${studentList.length - 10} more</p>` : '';
  const html = emailLayout({
    categoryLabel: 'Action required',
    title: `${count} students need supervisor assignment`,
    subtitle: `Department: ${department}`,
    content: `
      <p style="margin:0 0 12px;">The following students in <strong>${department}</strong> are awaiting supervisor assignment.</p>
      <div style="background:#fef2f2; border-radius:8px; padding:16px; margin:16px 0 0; border-left:4px solid #dc2626;">
        <ul style="margin:0; padding-left:20px;">${list}</ul>${more}
      </div>
    `,
    ctaLabel: 'Assign supervisors',
    ctaUrl: `${FRONTEND_URL}/admin/supervisor-assignment`,
    accentColor: '#dc2626',
    metadata: `${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
  });
  return sendEmail(to, subject, html);
}

// ─── GENERAL NOTIFICATIONS (All Users) ────────────────────────────────────────

export async function sendWelcomeEmail(
  to: string,
  firstName: string,
  email: string,
  role: string,
  tempPassword?: string
): Promise<boolean> {
  const subject = 'Welcome to Supervise360 - Student Project Management System';
  const creds = tempPassword
    ? `<div style="background:#f0fdf4; border-radius:8px; padding:16px; margin:16px 0 0; border-left:4px solid #22c55e;"><p style="margin:0; font-size:14px;"><strong>Email:</strong> ${email}</p><p style="margin:8px 0 0; font-size:14px;"><strong>Password:</strong> ${tempPassword}</p><p style="margin:12px 0 0; font-size:13px; color:#64748b;">Please change your password after first login.</p></div>`
    : `<p style="margin:0 0 12px;">Use the email and password you registered with to log in.</p>`;
  const html = emailLayout({
    categoryLabel: 'Account created',
    title: 'Welcome to Supervise360',
    subtitle: `Hello ${firstName}`,
    content: `
      <p style="margin:0 0 12px;">Your account has been created successfully. You can now access the Student Project Management System.</p>
      ${creds}
      <p style="margin:16px 0 0; font-size:14px;"><strong>Getting started:</strong></p>
      <ul style="margin:8px 0 0; padding-left:20px; font-size:14px;">
        <li>Log in and complete your profile</li>
        <li>Check your dashboard for updates</li>
      </ul>
    `,
    ctaLabel: 'Log in',
    ctaUrl: FRONTEND_URL,
    metadata: `Role: ${role}`,
  });
  return sendEmail(to, subject, html);
}

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  resetLink: string,
  expiryMinutes: number
): Promise<boolean> {
  const subject = 'Password reset requested for your account';
  const html = emailLayout({
    categoryLabel: 'Security',
    title: 'Password reset requested',
    subtitle: `Hello ${firstName}`,
    content: `
      <p style="margin:0 0 12px;">A password reset was requested for your account. Click the button below to set a new password.</p>
      <p style="margin:16px 0 0; font-size:13px; color:#64748b;">This link expires in <strong>${expiryMinutes} minutes</strong>. If you didn't request this, please ignore this email.</p>
    `,
    ctaLabel: 'Reset password',
    ctaUrl: resetLink,
    metadata: `Expires in ${expiryMinutes} minutes`,
  });
  return sendEmail(to, subject, html);
}

export async function sendProfileUpdateConfirmationEmail(
  to: string,
  firstName: string,
  changes: string[],
  timestamp: string
): Promise<boolean> {
  const subject = 'Your profile has been updated successfully';
  const list = changes.map(c => `<li style="margin:4px 0; font-size:14px;">${c}</li>`).join('');
  const html = emailLayout({
    categoryLabel: 'Profile updated',
    title: 'Your profile has been updated',
    subtitle: `Hello ${firstName}`,
    content: `
      <p style="margin:0 0 12px;">The following fields were updated:</p>
      <ul style="margin:8px 0 0; padding-left:20px;">${list}</ul>
    `,
    ctaLabel: 'View profile',
    ctaUrl: FRONTEND_URL,
    accentColor: '#22c55e',
    metadata: `Updated ${timestamp}`,
  });
  return sendEmail(to, subject, html);
}

// ─── DEFENSE NOTIFICATIONS ───────────────────────────────────────────────────

export async function sendDefenseScheduledEmail(
  to: string,
  studentName: string,
  venue: string,
  assessors: string[],
  groupName?: string
): Promise<boolean> {
  const assessorsList = Array.isArray(assessors) && assessors.length > 0
    ? assessors.map(a => `<li style="margin:4px 0; font-size:14px;">${a}</li>`).join('')
    : '<li style="margin:4px 0; font-size:14px;">To be announced</li>';
  const groupInfo = groupName ? `<p style="margin:0 0 8px; font-size:14px;"><strong>Group:</strong> ${groupName}</p>` : '';
  const subject = 'Your defense schedule has been published';
  const html = emailLayout({
    categoryLabel: 'Defense schedule',
    title: 'Defense date, venue & assessors published',
    subtitle: `Hello ${studentName}`,
    content: `
      <p style="margin:0 0 12px;">Your defense schedule has been published. Please note the following details:</p>
      <div style="background:#f0fdf4; border-radius:8px; padding:16px; margin:16px 0 0; border-left:4px solid #22c55e;">
        ${groupInfo}
        <p style="margin:0 0 8px; font-size:14px;"><strong>Venue / Location:</strong> ${venue}</p>
        <p style="margin:0 0 4px; font-size:14px;"><strong>Assessors:</strong></p>
        <ul style="margin:4px 0 0; padding-left:20px;">${assessorsList}</ul>
      </div>
      <p style="margin:16px 0 0; font-size:14px;">Log in to view full details and any updates.</p>
    `,
    ctaLabel: 'View my defense schedule',
    ctaUrl: `${FRONTEND_URL}/dashboard`,
    accentColor: '#22c55e',
    metadata: `Published ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
  });
  return sendEmail(to, subject, html);
}

export async function sendSessionSecurityAlertEmail(
  to: string,
  firstName: string,
  deviceInfo: string,
  location: string,
  time: string,
  secureAccountLink: string
): Promise<boolean> {
  const subject = 'New login from unknown device detected';
  const html = emailLayout({
    categoryLabel: 'Security alert',
    title: 'New login from unknown device',
    subtitle: `Hello ${firstName}`,
    content: `
      <p style="margin:0 0 12px;">A new login to your account was detected.</p>
      <div style="background:#fef2f2; border-radius:8px; padding:16px; margin:16px 0 0; border-left:4px solid #dc2626;">
        <p style="margin:0; font-size:14px;"><strong>Device:</strong> ${deviceInfo}</p>
        <p style="margin:8px 0 0; font-size:14px;"><strong>Location:</strong> ${location}</p>
        <p style="margin:8px 0 0; font-size:14px;"><strong>Time:</strong> ${time}</p>
      </div>
      <p style="margin:16px 0 0; font-size:14px;">If this wasn't you, secure your account immediately.</p>
    `,
    ctaLabel: 'Secure account',
    ctaUrl: secureAccountLink,
    accentColor: '#dc2626',
    metadata: time,
  });
  return sendEmail(to, subject, html);
}
