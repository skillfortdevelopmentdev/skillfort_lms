import React, { useEffect, useState } from 'react';
import { Mail, Send, ShieldCheck, Server } from 'lucide-react';
import { SystemSettings } from '../../types';
import { apiFetch } from '../../api/client';

interface MailSettingsProps {
  settings: SystemSettings;
  onRefreshData: () => Promise<void>;
  notify: (message: string) => void;
}

const SMTP_PRESETS = [
  { label: 'Custom / Manual', host: '', port: 587, secure: false },
  { label: 'Gmail SMTP', host: 'smtp.gmail.com', port: 587, secure: false },
  { label: 'Outlook / Office 365', host: 'smtp.office365.com', port: 587, secure: false },
  { label: 'Yahoo Mail', host: 'smtp.mail.yahoo.com', port: 465, secure: true },
];

export default function MailSettings({ settings, onRefreshData, notify }: MailSettingsProps) {
  const [form, setForm] = useState<SystemSettings>({ ...settings });
  const [testEmail, setTestEmail] = useState(settings.supportEmail || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const resp = await apiFetch('/api/admin/settings');
        if (resp.ok) {
          const data = await resp.json();
          setForm(data);
          if (!testEmail && (data.adminNotifyEmail || data.supportEmail)) {
            setTestEmail(data.adminNotifyEmail || data.supportEmail);
          }
        } else {
          setForm({ ...settings });
        }
      } catch {
        setForm({ ...settings });
      }
    })();
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const resp = await apiFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (resp.ok) {
        setForm(data);
        notify('SMTP and mail settings saved');
        await onRefreshData();
      } else {
        notify(data.error || 'Failed to save mail settings');
      }
    } catch {
      notify('Failed to save mail settings');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const saveResp = await apiFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!saveResp.ok) {
        notify('Save settings before verifying SMTP');
        return;
      }
      const resp = await apiFetch('/api/admin/mail/verify', { method: 'POST' });
      const data = await resp.json();
      if (resp.ok) {
        notify('SMTP connection verified successfully');
      } else {
        notify(data.error || 'SMTP verification failed');
      }
    } catch {
      notify('SMTP verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail.trim()) {
      notify('Enter a test recipient email');
      return;
    }
    setTesting(true);
    try {
      const saveResp = await apiFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!saveResp.ok) {
        notify('Save settings before sending test email');
        return;
      }
      const resp = await apiFetch('/api/admin/mail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail.trim() }),
      });
      const data = await resp.json();
      if (resp.ok) {
        notify(`Test email sent to ${testEmail}`);
      } else {
        notify(data.error || 'Test email failed');
      }
    } catch {
      notify('Test email failed');
    } finally {
      setTesting(false);
    }
  };

  const applyPreset = (index: number) => {
    const preset = SMTP_PRESETS[index];
    if (!preset || index === 0) return;
    setForm((prev) => ({
      ...prev,
      smtpHost: preset.host,
      smtpPort: preset.port,
      smtpSecure: preset.secure,
    }));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
      <div className="bg-[#111111] border border-[#222222] p-8 rounded-2xl space-y-6">
        <div className="space-y-2 border-b border-[#222222] pb-5">
          <span className="text-[10px] text-[#F89A15] font-mono tracking-widest font-black uppercase bg-[#F89A15]/10 border border-[#F89A15]/20 px-3 py-1 rounded-full inline-block">
            Real Email Delivery
          </span>
          <h3 className="text-xl font-display font-black text-white flex items-center gap-2">
            <Mail size={18} className="text-[#F89A15]" /> SMTP Configuration
          </h3>
          <p className="text-xs text-gray-400">
            Enter your mail server details here. All student and admin notifications use these settings.
            Admin alerts go to the admin notify email below.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <label className="flex items-center gap-3 text-sm text-white cursor-pointer">
            <input
              type="checkbox"
              checked={form.smtpEnabled}
              onChange={(e) => setForm({ ...form, smtpEnabled: e.target.checked })}
              className="accent-[#F89A15]"
            />
            Enable real email sending
          </label>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-gray-400 block">Quick preset</label>
            <select
              className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
              onChange={(e) => applyPreset(Number(e.target.value))}
              defaultValue="0"
            >
              {SMTP_PRESETS.map((preset, index) => (
                <option key={preset.label} value={index}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">SMTP host</label>
              <input
                type="text"
                value={form.smtpHost}
                onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                placeholder="smtp.gmail.com"
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">SMTP port</label>
              <input
                type="number"
                value={form.smtpPort}
                onChange={(e) => setForm({ ...form, smtpPort: Number(e.target.value) })}
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
              />
            </div>
            <div className="space-y-1.5 flex items-end">
              <label className="flex items-center gap-2 text-xs text-white cursor-pointer pb-3">
                <input
                  type="checkbox"
                  checked={form.smtpSecure}
                  onChange={(e) => setForm({ ...form, smtpSecure: e.target.checked })}
                  className="accent-[#F89A15]"
                />
                Use SSL/TLS (secure)
              </label>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">SMTP username</label>
              <input
                type="text"
                value={form.smtpUser}
                onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                placeholder="you@gmail.com"
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">SMTP password / app password</label>
              <input
                type="password"
                value={form.smtpPass}
                onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                placeholder={settings.smtpPass ? '********' : 'Enter SMTP password'}
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">From address (optional)</label>
              <input
                type="text"
                value={form.mailFrom}
                onChange={(e) => setForm({ ...form, mailFrom: e.target.value })}
                placeholder={`"SkillFort LMS" <noreply@yourdomain.com>`}
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">Admin notify email (all support alerts)</label>
              <input
                type="email"
                required
                value={form.adminNotifyEmail || form.supportEmail}
                onChange={(e) => setForm({ ...form, adminNotifyEmail: e.target.value })}
                placeholder="support@skillfort.com"
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-[#F89A15] hover:bg-white text-black transition-colors text-xs font-bold uppercase rounded-xl disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save SMTP settings'}
          </button>
        </form>
      </div>

      <div className="space-y-6">
        <div className="bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-4">
          <h4 className="font-display font-bold text-white flex items-center gap-2">
            <Server size={16} className="text-[#F89A15]" /> Test your SMTP
          </h4>
          <p className="text-xs text-gray-400">
            Save settings first, then verify the connection or send a test email.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying}
              className="flex-1 py-2.5 bg-black border border-[#222222] hover:border-[#F89A15] text-xs font-bold uppercase rounded-xl text-white disabled:opacity-50"
            >
              {verifying ? 'Verifying…' : 'Verify connection'}
            </button>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-gray-400 block">Send test email to</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="flex-1 bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
              />
              <button
                type="button"
                onClick={handleTestSend}
                disabled={testing}
                className="px-4 py-2 bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20 hover:bg-[#34d399] hover:text-black text-xs font-bold uppercase rounded-xl disabled:opacity-50 flex items-center gap-1"
              >
                <Send size={12} /> {testing ? 'Sending…' : 'Send test'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-4">
          <h4 className="font-display font-bold text-white flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#F89A15]" /> Automatic emails enabled
          </h4>
          <ul className="text-xs text-gray-300 space-y-2">
            <li><strong className="text-white">Student:</strong> welcome, payment success, payment failed, manual enrollment, certificate earned, password changed</li>
            <li><strong className="text-white">Admin:</strong> new registration, enrollment, payment success, payment failed, certificate issued</li>
          </ul>
          <p className="text-[11px] text-gray-500">
            Copies also appear in the student in-app inbox. If SMTP is disabled, inbox copies still save but no real email is sent.
          </p>
        </div>
      </div>
    </div>
  );
}
