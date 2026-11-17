import { DEFAULT_MAIL_SETTINGS, SystemSettings } from '../src/types';
import { INITIAL_SETTINGS } from '../src/data';

export function normalizeSettings(raw: Partial<SystemSettings> | undefined): SystemSettings {
  return {
    gstRate: Number(raw?.gstRate ?? INITIAL_SETTINGS.gstRate),
    systemName: raw?.systemName ?? INITIAL_SETTINGS.systemName,
    supportEmail: raw?.supportEmail ?? INITIAL_SETTINGS.supportEmail,
    razorpayKeyId: raw?.razorpayKeyId ?? INITIAL_SETTINGS.razorpayKeyId,
    razorpayKeySecret: raw?.razorpayKeySecret ?? '',
    themeColor: raw?.themeColor ?? INITIAL_SETTINGS.themeColor,
    smtpEnabled: Boolean(raw?.smtpEnabled),
    smtpHost: raw?.smtpHost ?? DEFAULT_MAIL_SETTINGS.smtpHost,
    smtpPort: Number(raw?.smtpPort ?? DEFAULT_MAIL_SETTINGS.smtpPort),
    smtpSecure: Boolean(raw?.smtpSecure),
    smtpUser: raw?.smtpUser ?? DEFAULT_MAIL_SETTINGS.smtpUser,
    smtpPass: raw?.smtpPass ?? DEFAULT_MAIL_SETTINGS.smtpPass,
    mailFrom: raw?.mailFrom ?? DEFAULT_MAIL_SETTINGS.mailFrom,
    adminNotifyEmail: raw?.adminNotifyEmail ?? DEFAULT_MAIL_SETTINGS.adminNotifyEmail,
  };
}

export function maskSecret(value: string): string {
  return value ? '********' : '';
}

export function maskSmtpPass(pass: string): string {
  return maskSecret(pass);
}

export function mergeSettingsUpdate(
  current: SystemSettings,
  body: Partial<SystemSettings> & { smtpPass?: string }
): SystemSettings {
  const nextPass =
    body.smtpPass === undefined || body.smtpPass === '********' || body.smtpPass === ''
      ? body.smtpPass === ''
        ? ''
        : current.smtpPass
      : body.smtpPass;

  const nextRzpSecret =
    body.razorpayKeySecret === undefined ||
    body.razorpayKeySecret === '********' ||
    body.razorpayKeySecret === ''
      ? body.razorpayKeySecret === ''
        ? ''
        : current.razorpayKeySecret ?? ''
      : body.razorpayKeySecret;

  return normalizeSettings({
    ...current,
    ...body,
    gstRate: body.gstRate !== undefined ? Number(body.gstRate) : current.gstRate,
    smtpPort: body.smtpPort !== undefined ? Number(body.smtpPort) : current.smtpPort,
    smtpPass: nextPass,
    razorpayKeySecret: nextRzpSecret,
  });
}

export function settingsForAdminResponse(settings: SystemSettings): SystemSettings {
  return {
    ...settings,
    smtpPass: maskSmtpPass(settings.smtpPass),
    razorpayKeySecret: maskSecret(settings.razorpayKeySecret ?? ''),
  };
}

export function settingsForPublicResponse(settings: SystemSettings): SystemSettings {
  return {
    ...settings,
    smtpPass: '',
    smtpUser: '',
    smtpHost: '',
    razorpayKeySecret: '',
  };
}
