import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Award, ArrowLeft, CheckCircle, ShieldCheck, XCircle } from 'lucide-react';
import { apiUrl } from '../api/config';
import { Certificate } from '../types';
import { SkillFortLogo } from '../components/SkillFortLogo';

export default function VerifyCertificatePage() {
  const { certNo } = useParams<{ certNo: string }>();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!certNo) {
      setError('No certificate number provided.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const resp = await fetch(apiUrl(`/api/certificates/verify/${encodeURIComponent(certNo)}`));
        const data = await resp.json();
        if (cancelled) return;

        if (resp.ok) {
          setCertificate(data);
          setError(null);
        } else {
          setCertificate(null);
          setError(data.error || 'Certificate not found.');
        }
      } catch {
        if (!cancelled) {
          setError('Unable to verify certificate. Please try again later.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [certNo]);

  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased">
      <div className="absolute top-0 left-0 right-0 h-[450px] bg-gradient-to-b from-[#F89A15]/5 to-transparent pointer-events-none" />

      <div className="relative max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <SkillFortLogo className="scale-90 origin-left" />
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#F89A15] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Back to SkillFort
          </Link>
        </div>

        <div className="bg-[#0A0A0A] border border-[#222222] rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-[#F89A15]" size={28} />
            <div>
              <h1 className="text-2xl font-display font-black">Certificate Verification</h1>
              <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mt-1">
                Official SkillFort registry lookup
              </p>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <div className="h-5 w-5 border-2 border-t-[#F89A15] border-gray-800 rounded-full animate-spin" />
              Verifying certificate number…
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 flex items-start gap-3">
              <XCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-bold text-red-400">Verification failed</p>
                <p className="text-sm text-gray-400 mt-1">{error}</p>
                {certNo && (
                  <p className="text-xs text-gray-500 font-mono mt-3">
                    Certificate #: {certNo}
                  </p>
                )}
              </div>
            </div>
          )}

          {!loading && certificate && (
            <div className="space-y-6">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 flex items-start gap-3">
                <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={22} />
                <div>
                  <p className="font-bold text-emerald-400">Certificate verified</p>
                  <p className="text-sm text-gray-400 mt-1">
                    This certificate is registered in the SkillFort LMS directory.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#111111] border border-[#222222] rounded-xl p-4 space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase font-mono">Student</span>
                  <p className="font-bold text-white">{certificate.userName}</p>
                </div>
                <div className="bg-[#111111] border border-[#222222] rounded-xl p-4 space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase font-mono">Course</span>
                  <p className="font-bold text-white">{certificate.courseTitle}</p>
                </div>
                <div className="bg-[#111111] border border-[#222222] rounded-xl p-4 space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase font-mono">
                    Certificate number
                  </span>
                  <p className="font-mono text-[#F89A15] font-bold">
                    {certificate.certificateNumber}
                  </p>
                </div>
                <div className="bg-[#111111] border border-[#222222] rounded-xl p-4 space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase font-mono">Course period</span>
                  <p className="font-bold text-white">{certificate.issueDate}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Award size={14} className="text-[#F89A15]" />
                <span>SkillFort LMS — verified academic completion record</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
