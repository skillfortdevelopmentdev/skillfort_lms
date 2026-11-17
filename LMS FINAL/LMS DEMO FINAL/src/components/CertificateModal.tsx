import React, { useEffect, useRef, useState } from 'react';
import { Certificate } from '../types';
import { getPlatformValue, parsePlatformValue, readPlatformCache } from '../api/platformKv';
import { X, Award, Printer, Download } from 'lucide-react';
import {
  CERTIFICATE_CANVAS_HEIGHT,
  CERTIFICATE_CANVAS_WIDTH,
  DEFAULT_CERTIFICATE_TEMPLATE,
  downloadCertificateImage,
  normalizeCertificateTemplate,
  resolveCertificateTemplate,
  type CertificateTemplate,
} from '../utils/certificateTemplate';

interface CertificateModalProps {
  certificate: Certificate;
  onClose: () => void;
}

function loadTemplate(): CertificateTemplate {
  try {
    const saved = readPlatformCache('skillfort_certificate_template', null);
    if (saved) {
      return normalizeCertificateTemplate(parsePlatformValue(saved, null));
    }
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_CERTIFICATE_TEMPLATE;
}

export default function CertificateModal({ certificate, onClose }: CertificateModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [template, setTemplate] = useState<CertificateTemplate>(() => loadTemplate());

  useEffect(() => {
    void resolveCertificateTemplate(readPlatformCache, getPlatformValue).then(setTemplate);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadImage = async () => {
    const resolved = await resolveCertificateTemplate(readPlatformCache, getPlatformValue);
    await downloadCertificateImage(
      resolved,
      {
        studentName: certificate.userName,
        courseTitle: certificate.courseTitle,
        issueDate: certificate.issueDate,
      },
      `SkillFort-Certificate-${certificate.certificateNumber}.png`
    );
  };

  const renderField = (field: 'studentName' | 'courseTitle' | 'issueDate', text: string) => {
    const style = template.elements[field];
    return (
      <div
        className="absolute whitespace-pre-wrap"
        style={{
          top: `${style.top}%`,
          left: `${style.left}%`,
          transform:
            style.align === 'center'
              ? 'translate(-50%, -50%)'
              : style.align === 'right'
                ? 'translate(-100%, -50%)'
                : 'translate(0, -50%)',
          fontSize: `clamp(10px, ${style.fontSize / 32}cqw, ${style.fontSize}px)`,
          color: style.color,
          fontWeight:
            style.fontWeight === 'bold' || style.fontWeight === 'black'
              ? 'bold'
              : style.fontWeight === 'semibold'
                ? 600
                : style.fontWeight === 'medium'
                  ? 500
                  : 'normal',
          fontFamily: style.fontFamily === 'serif' ? 'Georgia, serif' : "'Poppins', sans-serif",
          textAlign: style.align,
          maxWidth: '85%',
        }}
      >
        {text}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/90 p-4 backdrop-blur-md">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[#222222] bg-[#0A0A0A] print:border-none print:bg-white">
        <div className="flex items-center justify-between border-b border-[#222222] p-5 print:hidden">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#F89A15]/10 p-2 text-[#F89A15]">
              <Award size={22} />
            </div>
            <h3 className="font-display text-lg font-semibold text-white">Certificate</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-[#111111] hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 md:p-12" ref={printRef}>
          <div
            className="relative mx-auto w-full overflow-hidden rounded-xl bg-white"
            style={{
              aspectRatio: `${CERTIFICATE_CANVAS_WIDTH} / ${CERTIFICATE_CANVAS_HEIGHT}`,
              backgroundImage: template.bgImage ? `url(${template.bgImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {!template.bgImage && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                Certificate template not configured
              </div>
            )}
            {renderField('studentName', certificate.userName)}
            {renderField('courseTitle', certificate.courseTitle)}
            {renderField('issueDate', certificate.issueDate)}
          </div>
        </div>

        <div className="flex flex-col justify-end gap-3 border-t border-[#222222] bg-[#0A0A0A] p-6 print:hidden sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#222222] px-4 py-2 text-xs font-medium text-gray-400 transition-all hover:bg-[#111111] hover:text-white"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadImage()}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-black shadow-lg transition-all hover:bg-emerald-400"
          >
            <Download size={14} /> Download
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#F89A15] px-5 py-2.5 text-xs font-bold text-black shadow-lg transition-all hover:bg-white"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>
    </div>
  );
}
