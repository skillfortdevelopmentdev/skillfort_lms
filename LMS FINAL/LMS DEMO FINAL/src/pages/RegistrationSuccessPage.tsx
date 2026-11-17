import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Mail, ArrowRight, BookOpen } from 'lucide-react';
import { SkillFortLogo } from '../components/SkillFortLogo';

interface RegistrationSuccessPageProps {
  userName: string;
  userEmail: string;
  systemName: string;
  onGoToDashboard: () => void;
}

export default function RegistrationSuccessPage({
  userName,
  userEmail,
  systemName,
  onGoToDashboard,
}: RegistrationSuccessPageProps) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="flex justify-center">
          <SkillFortLogo className="h-8" />
        </div>

        <div className="bg-[#0A0A0A] border border-[#222222] rounded-3xl p-8 sm:p-10 space-y-6 shadow-2xl shadow-[#F89A15]/5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
            <CheckCircle size={32} className="text-emerald-400" />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase font-bold text-[#F89A15] tracking-[0.2em]">
              Registration complete
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
              Welcome to {systemName}!
            </h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Hi <strong className="text-white">{userName}</strong>, your student account was
              created successfully. You are signed in and ready to explore courses.
            </p>
          </div>

          <div className="bg-[#111111] border border-[#222222] rounded-xl p-4 text-left space-y-2">
            <div className="flex items-start gap-3">
              <Mail size={16} className="text-[#F89A15] mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-white">Check your email</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  We sent a welcome message to{' '}
                  <strong className="text-gray-200">{userEmail}</strong> with a login link for
                  future visits. Save it so you can sign in anytime from another device.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onGoToDashboard}
              className="flex-1 py-3.5 bg-[#F89A15] hover:bg-white text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Go to dashboard <ArrowRight size={14} />
            </button>
            <Link
              to="/"
              className="flex-1 py-3.5 border border-[#222222] hover:border-[#F89A15]/40 text-gray-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <BookOpen size={14} /> Browse courses
            </Link>
          </div>

          <p className="text-[10px] text-gray-500 font-mono">
            Didn&apos;t receive the email? Check spam or contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
