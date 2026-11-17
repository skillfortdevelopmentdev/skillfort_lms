import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle, Mail } from 'lucide-react';
import { apiUrl } from '../api/config';
import { SkillFortLogo } from '../components/SkillFortLogo';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resetPath, setResetPath] = useState('');
  const [accountFound, setAccountFound] = useState<boolean | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setResetPath('');
    setAccountFound(null);
    setLoading(true);

    try {
      const resp = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || 'Unable to process request.');
        return;
      }

      setAccountFound(Boolean(data.accountFound));

      if (data.blocked) {
        setError(data.message || 'This account has been blocked. Please contact support.');
        return;
      }

      if (!data.accountFound) {
        setError(
          data.message ||
            'No student account is registered with this email address. Check the spelling or register first.'
        );
        return;
      }

      const path =
        data.resetPath ||
        (data.devResetUrl ? String(data.devResetUrl).replace(/^https?:\/\/[^/]+/, '') : '');

      if (!path) {
        setError('Account was found but the reset link could not be created. Please try again.');
        return;
      }

      setResetPath(path);
      setMessage(
        data.message ||
          `Account found for ${data.maskedEmail || email.trim()}. Use the button below to reset your password.`
      );
    } catch {
      setError('Network error. Please check that the server is running and try again.');
    } finally {
      setLoading(false);
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
          <div>
            <h1 className="text-xl font-display font-black">Forgot password</h1>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mt-1">
              Account recovery
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle size={14} /> <span>{error}</span>
            </div>
          )}

          {message && accountFound && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-xs flex items-start gap-2">
              <CheckCircle size={14} className="shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {resetPath && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate(resetPath)}
                className="w-full py-3.5 bg-[#F89A15] hover:bg-white text-black text-xs font-bold uppercase rounded-xl transition-all cursor-pointer"
              >
                Continue to reset password
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fullUrl = `${window.location.origin}${resetPath}`;
                  try {
                    await navigator.clipboard.writeText(fullUrl);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  } catch {
                    setError('Could not copy link. Use the button above instead.');
                  }
                }}
                className="w-full py-2 border border-[#222222] hover:border-[#F89A15]/40 text-gray-300 hover:text-white text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer"
              >
                {linkCopied ? 'Link copied!' : 'Copy reset link'}
              </button>
            </div>
          )}

          {!resetPath && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                Enter the exact email from your registration (e.g.{' '}
                <strong className="text-gray-300">mahalakshmi197.jayakumar@gmail.com</strong>).
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 uppercase font-mono block">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-gray-600" size={14} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-3 pl-10 rounded-lg font-medium"
                    placeholder="Enter your registered email"
                    autoComplete="email"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#F89A15] hover:bg-white disabled:opacity-60 text-black text-xs font-bold uppercase rounded-xl transition-all cursor-pointer"
              >
                {loading ? 'Checking account…' : 'Send reset link'}
              </button>
            </form>
          )}

          {resetPath && (
            <button
              type="button"
              onClick={() => {
                setMessage('');
                setResetPath('');
                setAccountFound(null);
                setError('');
                setEmail('');
              }}
              className="w-full text-[10px] text-gray-500 hover:text-[#F89A15] font-semibold cursor-pointer bg-transparent border-0"
            >
              Try a different email
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
