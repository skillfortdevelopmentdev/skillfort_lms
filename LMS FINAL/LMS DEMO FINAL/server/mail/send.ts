import nodemailer from 'nodemailer';
import type { Certificate, Course, PaymentReport, SystemSettings, User } from '../../src/types';
import { appendInboxMessage } from './inbox';
import {
  adminNewRegistrationEmail,
  certificateEarnedAdminEmail,
  certificateEarnedStudentEmail,
  manualEnrollmentAdminEmail,
  manualEnrollmentStudentEmail,
  passwordChangedStudentEmail,
  passwordResetRequestEmail,
  paymentFailedAdminEmail,
  paymentFailedStudentEmail,
  paymentSuccessAdminEmail,
  paymentSuccessStudentEmail,
  testEmailHtml,
  welcomeStudentEmail,
  contactFormAdminEmail,
  abandonedCartStudentEmail,
  abandonedWishlistStudentEmail,
  welcomeAdminEmail,
  adminNewAdminCreatedEmail,
} from './templates';

export function getAdminNotifyEmail(settings: SystemSettings): string {
  return (settings.adminNotifyEmail || settings.supportEmail || '').trim();
}

export function isSmtpConfigured(settings: SystemSettings): boolean {
  return Boolean(
    settings.smtpEnabled &&
      settings.smtpHost.trim() &&
      settings.smtpUser.trim() &&
      settings.smtpPass.trim()
  );
}

function getFromAddress(settings: SystemSettings): string {
  if (settings.mailFrom.trim()) {
    return settings.mailFrom.trim();
  }
  return `"${settings.systemName}" <${settings.smtpUser.trim()}>`;
}

export async function sendRawEmail(
  settings: SystemSettings,
  to: string,
  subject: string,
  html: string
): Promise<{ sent: boolean; error?: string }> {
  if (!to.trim()) {
    return { sent: false, error: 'Recipient email is empty' };
  }

  if (!isSmtpConfigured(settings)) {
    console.log(`[MAIL SKIPPED] SMTP not configured — "${subject}" → ${to}`);
    return { sent: false, error: 'SMTP is not configured or disabled' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost.trim(),
      port: Number(settings.smtpPort) || 587,
      secure: Boolean(settings.smtpSecure),
      auth: {
        user: settings.smtpUser.trim(),
        pass: settings.smtpPass,
      },
    });

    await transporter.sendMail({
      from: getFromAddress(settings),
      to: to.trim(),
      subject,
      html,
    });

    return { sent: true };
  } catch (error: any) {
    console.error('[MAIL ERROR]', error?.message || error);
    return { sent: false, error: error?.message || 'Failed to send email' };
  }
}

async function sendStudentMail(
  settings: SystemSettings,
  user: User,
  subject: string,
  html: string,
  category: string
): Promise<void> {
  await appendInboxMessage(user.id, {
    subject,
    sender: settings.mailFrom || `noreply@${settings.smtpHost || 'skillfort.com'}`,
    recipient: user.email,
    category,
    body: html,
  });
  await sendRawEmail(settings, user.email, subject, html);
}

async function sendAdminMail(
  settings: SystemSettings,
  subject: string,
  html: string,
  category: string
): Promise<void> {
  const adminEmail = getAdminNotifyEmail(settings);
  if (!adminEmail) {
    console.warn('[MAIL] Admin notify email is not configured');
    return;
  }
  await sendRawEmail(settings, adminEmail, subject, html);
}

export async function notifyStudentRegistration(
  settings: SystemSettings,
  user: User
): Promise<void> {
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const loginUrl = `${appUrl}/login`;
  const studentMail = welcomeStudentEmail(user, settings.systemName, loginUrl);
  const adminMail = adminNewRegistrationEmail(user);

  await sendStudentMail(settings, user, studentMail.subject, studentMail.html, 'welcome');
  await sendAdminMail(settings, adminMail.subject, adminMail.html, 'admin_alert');
}

export async function notifyPaymentSuccess(
  settings: SystemSettings,
  user: User,
  course: Course,
  payment: PaymentReport
): Promise<void> {
  const studentMail = paymentSuccessStudentEmail(user, course, payment);
  const adminMail = paymentSuccessAdminEmail(user, course, payment);

  await sendStudentMail(settings, user, studentMail.subject, studentMail.html, 'receipt');
  await sendAdminMail(settings, adminMail.subject, adminMail.html, 'admin_alert');
}

export async function notifyPaymentFailed(
  settings: SystemSettings,
  user: User,
  course: Course,
  reason?: string
): Promise<void> {
  const studentMail = paymentFailedStudentEmail(user, course, reason);
  const adminMail = paymentFailedAdminEmail(user, course, reason);

  await sendStudentMail(settings, user, studentMail.subject, studentMail.html, 'payment_status');
  await sendAdminMail(settings, adminMail.subject, adminMail.html, 'admin_alert');
}

export async function notifyManualEnrollment(
  settings: SystemSettings,
  user: User,
  course: Course
): Promise<void> {
  const studentMail = manualEnrollmentStudentEmail(user, course);
  const adminMail = manualEnrollmentAdminEmail(user, course);

  await sendStudentMail(settings, user, studentMail.subject, studentMail.html, 'enrollment');
  await sendAdminMail(settings, adminMail.subject, adminMail.html, 'admin_alert');
}

export async function notifyCertificateEarned(
  settings: SystemSettings,
  user: User,
  cert: Certificate,
  verifyUrl: string
): Promise<void> {
  const studentMail = certificateEarnedStudentEmail(user, cert, verifyUrl);
  const adminMail = certificateEarnedAdminEmail(user, cert);

  await sendStudentMail(settings, user, studentMail.subject, studentMail.html, 'certificate');
  await sendAdminMail(settings, adminMail.subject, adminMail.html, 'admin_alert');
}

export async function notifyPasswordChanged(
  settings: SystemSettings,
  user: User
): Promise<void> {
  const studentMail = passwordChangedStudentEmail(user);
  await sendStudentMail(settings, user, studentMail.subject, studentMail.html, 'security');
}

export async function notifyPasswordResetRequest(
  settings: SystemSettings,
  user: User,
  resetUrl: string
): Promise<{ sent: boolean; error?: string }> {
  const mail = passwordResetRequestEmail(user, resetUrl, settings.systemName || 'SkillFort LMS');
  await appendInboxMessage(user.id, {
    subject: mail.subject,
    sender: settings.mailFrom || `noreply@${settings.smtpHost || 'skillfort.com'}`,
    recipient: user.email,
    category: 'password_reset',
    body: mail.html,
  });
  return sendRawEmail(settings, user.email, mail.subject, mail.html);
}

export async function notifyContactForm(
  settings: SystemSettings,
  payload: { name: string; email: string; message: string }
): Promise<{ sent: boolean; error?: string }> {
  const adminEmail = getAdminNotifyEmail(settings);
  if (!adminEmail) {
    return { sent: false, error: 'Admin notify email is not configured' };
  }
  const mail = contactFormAdminEmail(payload.name, payload.email, payload.message);
  return sendRawEmail(settings, adminEmail, mail.subject, mail.html);
}

export async function notifyAbandonedCart(
  settings: SystemSettings,
  user: User,
  courses: Course[]
): Promise<void> {
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const mail = abandonedCartStudentEmail(user, courses, appUrl);
  await sendStudentMail(settings, user, mail.subject, mail.html, 'cart_reminder');
}

export async function notifyAbandonedWishlist(
  settings: SystemSettings,
  user: User,
  courses: Course[]
): Promise<void> {
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const mail = abandonedWishlistStudentEmail(user, courses, appUrl);
  await sendStudentMail(settings, user, mail.subject, mail.html, 'wishlist_reminder');
}

export async function notifyAdminAccountCreated(
  settings: SystemSettings,
  newAdmin: User,
  createdBy: User,
  temporaryPassword: string
): Promise<{ welcomeSent: boolean; notifySent: boolean; errors: string[] }> {
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const loginUrl = `${appUrl}/login`;
  const welcome = welcomeAdminEmail(
    newAdmin,
    settings.systemName || 'SkillFort LMS',
    loginUrl,
    createdBy.name,
    temporaryPassword
  );
  const adminAlert = adminNewAdminCreatedEmail(newAdmin, createdBy);

  const errors: string[] = [];
  const welcomeResult = await sendRawEmail(settings, newAdmin.email, welcome.subject, welcome.html);
  if (!welcomeResult.sent) {
    errors.push(welcomeResult.error || 'Could not email the new administrator');
  }

  const adminEmail = getAdminNotifyEmail(settings);
  let notifySent = false;
  if (adminEmail) {
    const notifyResult = await sendRawEmail(settings, adminEmail, adminAlert.subject, adminAlert.html);
    notifySent = notifyResult.sent;
    if (!notifyResult.sent) {
      errors.push(notifyResult.error || 'Could not notify the admin alert inbox');
    }
  } else {
    errors.push('Admin notify email is not configured');
  }

  return {
    welcomeSent: welcomeResult.sent,
    notifySent,
    errors,
  };
}

export async function sendSmtpTestEmail(
  settings: SystemSettings,
  to: string
): Promise<{ sent: boolean; error?: string }> {
  const mail = testEmailHtml();
  return sendRawEmail(settings, to, mail.subject, mail.html);
}

export async function verifySmtpConnection(
  settings: SystemSettings
): Promise<{ ok: boolean; error?: string }> {
  if (!isSmtpConfigured(settings)) {
    return { ok: false, error: 'SMTP is not configured or disabled' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost.trim(),
      port: Number(settings.smtpPort) || 587,
      secure: Boolean(settings.smtpSecure),
      auth: {
        user: settings.smtpUser.trim(),
        pass: settings.smtpPass,
      },
    });
    await transporter.verify();
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'SMTP verification failed' };
  }
}
