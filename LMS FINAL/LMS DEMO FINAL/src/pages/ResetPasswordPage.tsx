import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { SkillFortLogo } from '../components/SkillFortLogo';
import { apiUrl } from '../api/config';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token')?.trim() || '';

  const [email, setEmail] = useState('');
  const [validating, setValidating] = useState(true);
  const [validationError, setValidationError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidationError('No reset token provided. Request a new link from the login page.');
      setValidating(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const resp = await fetch(
          apiUrl(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
        );
        const data = await resp.json();
        if (cancelled) return;

        if (resp.ok) {
          setEmail(data.email || '');
          setValidationError('');
        } else {
          setValidationError(data.error || 'Invalid or expired reset link.');
        }
      } catch {
        if (!cancelled) {
          setValidationError('Unable to validate reset link. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setValidating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (newPassword.length < 8) {
      setSubmitError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch(apiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await resp.json();

      if (resp.ok) {
        setSuccess(true);
      } else {
        setSubmitError(data.error || 'Unable to reset password.');
      }
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased">
      <div className="absolute top-0 left-0 right-0 h-[450px] bg-gradient-to-b from-[#F89A15]/5 to-transparent pointer-events-none" />

      <div className="relative max-w-md mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <SkillFortLogo className="scale-90 origin-left" />
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#F89A15] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Back to login
          </Link>
        </div>

        <div className="bg-[#0A0A0A] border border-[#222222] rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-[#F89A15]" size={24} />
            <div>
              <h1 className="text-xl font-display font-black">Reset password</h1>
              <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mt-1">
                Secure account recovery
              </p>
            </div>
          </div>

          {validating && (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <div className="h-5 w-5 border-2 border-t-[#F89A15] border-gray-800 rounded-full animate-spin" />
              Validating reset link…
            </div>
          )}

          {!validating && validationError && (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
              <Link
                to="/forgot-password"
                className="block w-full py-3 text-center bg-[#F89A15] hover:bg-white text-black text-xs font-bold uppercase rounded-xl transition-all"
              >
                Request new reset link
              </Link>
            </div>
          )}

          {!validating && !validationError && success && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
              <p className="text-sm text-gray-300">
                Your password was updated. Sign in with your new password.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-3 bg-[#F89A15] hover:bg-white text-black text-xs font-bold uppercase rounded-xl transition-all cursor-pointer"
              >
                Go to login
              </button>
            </div>
          )}

          {!validating && !validationError && !success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {email && (
                <p className="text-xs text-gray-400">
                  Resetting password for <strong className="text-white">{email}</strong>
                </p>
              )}

              {submitError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle size={14} /> <span>{submitError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 uppercase font-mono block">
                  New password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-600" size={14} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 pl-10 pr-10 rounded-lg font-medium"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-3 text-gray-500 hover:text-white"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 uppercase font-mono block">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-600" size={14} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 pl-10 pr-10 rounded-lg font-medium"
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-3 text-gray-500 hover:text-white"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#F89A15] hover:bg-white disabled:opacity-60 text-black text-xs font-bold uppercase rounded-xl transition-all mt-2 cursor-pointer"
              >
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
