import React, { useEffect, useState } from 'react';
import { Mail, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { createAdminAccount, deleteAdminAccount } from '../../api/adminUsers';
import PasswordInput from '../ui/PasswordInput';
import { type AdminTab } from '../../routes/adminRoutes';
import type { User } from '../../types';

interface AdminsAdminProps {
  activeTab: AdminTab;
  onNavigate: (tab: AdminTab) => void;
  admins: User[];
  currentUserId: string;
  onRefreshData: () => Promise<void>;
  onAdminCreated?: (admin: User) => void;
  onAdminDeleted?: (adminId: string) => void;
  notify: (msg: string) => void;
}

export default function AdminsAdmin({
  activeTab,
  onNavigate,
  admins,
  currentUserId,
  onRefreshData,
  onAdminCreated,
  onAdminDeleted,
  notify,
}: AdminsAdminProps) {
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adminPendingDelete, setAdminPendingDelete] = useState<User | null>(null);

  useEffect(() => {
    if (!adminPendingDelete) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deletingId) {
        setAdminPendingDelete(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adminPendingDelete, deletingId]);

  const requestDeleteAdmin = (admin: User) => {
    if (admin.id === currentUserId) {
      notify('You cannot delete your own administrator account.');
      return;
    }
    setAdminPendingDelete(admin);
  };

  const confirmDeleteAdmin = async () => {
    if (!adminPendingDelete) return;

    const admin = adminPendingDelete;
    setDeletingId(admin.id);
    try {
      const result = await deleteAdminAccount(admin.id);
      if (!result.ok) {
        notify(result.message || 'Could not delete administrator.');
        return;
      }
      onAdminDeleted?.(admin.id);
      setAdminPendingDelete(null);
      notify(`Administrator ${admin.name} removed.`);
    } catch {
      notify('Network error while deleting administrator.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.name.trim() || !adminForm.email.trim() || !adminForm.password) return;

    if (adminForm.password.length < 8) {
      notify('Password must be at least 8 characters.');
      return;
    }
    if (adminForm.password !== adminForm.confirmPassword) {
      notify('Password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createAdminAccount({
        name: adminForm.name,
        email: adminForm.email,
        password: adminForm.password,
      });

      if (!result.ok || !result.user) {
        notify(result.message || 'Could not create administrator account.');
        return;
      }

      setAdminForm({ name: '', email: '', password: '', confirmPassword: '' });
      onAdminCreated?.(result.user);
      onNavigate('admins-all');

      if (result.emailSent) {
        notify(`Administrator created. Welcome email sent to ${result.user.email}.`);
      } else if (result.emailErrors?.length) {
        notify(`Administrator created, but email was not sent: ${result.emailErrors[0]}`);
      } else {
        notify('Administrator created. Configure SMTP under Email / SMTP to send login emails.');
      }
    } catch {
      notify('Network error while creating administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {activeTab === 'admins-all' && (
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-xs uppercase tracking-wide text-[#F89A15]">
                Platform administrators
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                Users with full access to the admin portal, courses, students, and system settings.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('admins-add')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F89A15] text-black text-[10px] font-extrabold uppercase tracking-wider hover:bg-white transition-colors"
            >
              <UserPlus size={14} /> Add administrator
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#222222]">
            <table className="w-full text-left text-xs border-collapse text-gray-300">
              <thead>
                <tr className="bg-black/40 border-b border-[#222222] text-gray-400 uppercase">
                  <th className="p-4">Administrator</th>
                  <th className="p-4 font-mono">Email</th>
                  <th className="p-4">Added on</th>
                  <th className="p-4 text-center">Role</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      No administrators found. Add one to share admin access.
                    </td>
                  </tr>
                ) : (
                  admins.map((admin) => (
                    <tr key={admin.id} className="border-b border-[#222222]/50 hover:bg-black/20">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F89A15]/10 text-[#F89A15] border border-[#F89A15]/20">
                            <ShieldCheck size={16} />
                          </div>
                          <div>
                            <p className="font-semibold text-white">{admin.name}</p>
                            {admin.id === currentUserId && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-gray-400">{admin.email}</td>
                      <td className="p-4 text-gray-400">
                        {new Date(admin.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#F89A15]/10 text-[#F89A15] border border-[#F89A15]/20 text-[9px] font-bold uppercase">
                          Admin
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={admin.id === currentUserId || deletingId === admin.id}
                            onClick={() => requestDeleteAdmin(admin)}
                            className="inline-flex items-center justify-center rounded-lg border border-red-500/30 p-2 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                            title={
                              admin.id === currentUserId
                                ? 'You cannot delete your own account'
                                : `Delete ${admin.name}`
                            }
                            aria-label={`Delete ${admin.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminPendingDelete && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/40"
          role="presentation"
          onClick={() => {
            if (!deletingId) setAdminPendingDelete(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-admin-title"
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="delete-admin-title" className="text-center text-base font-medium text-slate-800">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{adminPendingDelete.name}</span>?
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setAdminPendingDelete(null)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void confirmDeleteAdmin()}
                className="flex-1 rounded-lg bg-[#F89A15] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#e08a10] disabled:opacity-60"
              >
                {deletingId ? 'Deleting…' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'admins-add' && (
        <div className="max-w-lg bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-5">
          <div className="space-y-1">
            <h3 className="font-display font-medium text-xs text-[#F89A15] uppercase tracking-wide">
              Add new administrator
            </h3>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              The new admin will receive a welcome email with login credentials. An alert is also sent to the admin notify
              email configured under Email / SMTP.
            </p>
          </div>

          <form onSubmit={handleCreateAdmin} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">Full name</label>
              <input
                type="text"
                required
                value={adminForm.name}
                onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                placeholder="Priya Sharma"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">Work email</label>
              <input
                type="email"
                required
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                placeholder="priya@skillfort.com"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Password</label>
                <PasswordInput
                  required
                  minLength={8}
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Confirm password</label>
                <PasswordInput
                  required
                  minLength={8}
                  value={adminForm.confirmPassword}
                  onChange={(e) => setAdminForm({ ...adminForm, confirmPassword: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-[#222222] bg-black/40 p-3 text-[10px] text-gray-400">
              <Mail size={14} className="shrink-0 text-[#F89A15] mt-0.5" />
              <p>
                Login details are emailed to the new administrator. Ensure SMTP is enabled under{' '}
                <strong className="text-gray-300">Email / SMTP</strong> and admin notify email is set.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 min-w-[140px] py-3 bg-[#F89A15] hover:bg-white disabled:opacity-60 text-black transition-colors text-xs font-bold uppercase rounded-xl"
              >
                {submitting ? 'Creating…' : 'Create & send invite email'}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('admins-all')}
                className="px-5 py-3 border border-[#222222] text-gray-400 hover:text-white rounded-xl text-xs font-bold uppercase"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
