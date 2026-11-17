import React, { useEffect, useRef, useState } from 'react';
import { getPlatformValue, setPlatformValue } from '../../api/platformKv';
import { Award, Move, Save, Trash2, Upload } from 'lucide-react';
import {
  CERTIFICATE_FIELD_LABELS,
  DEFAULT_CERTIFICATE_TEMPLATE,
  formatCertificateDateRange,
  normalizeCertificateTemplate,
  type CertificateFieldKey,
  type CertificateFieldStyle,
  type CertificateTemplate,
} from '../../utils/certificateTemplate';

interface CertificateBuilderProps {
  notify: (msg: string) => void;
}

export default function CertificateBuilder({ notify }: CertificateBuilderProps) {
  const [template, setTemplate] = useState<CertificateTemplate>(DEFAULT_CERTIFICATE_TEMPLATE);
  const [activeField, setActiveField] = useState<CertificateFieldKey>('studentName');
  const containerRef = useRef<HTMLDivElement>(null);

  const previewData = {
    studentName: 'John Doe',
    courseTitle: 'Python Full Stack Training Program',
    issueDate: formatCertificateDateRange(
      new Date('2026-11-18T00:00:00'),
      new Date('2026-12-20T00:00:00')
    ),
  };

  useEffect(() => {
    getPlatformValue<unknown>('skillfort_certificate_template', null).then((saved) => {
      if (saved) {
        setTemplate(normalizeCertificateTemplate(saved));
      }
    });
  }, []);

  const saveToSystem = async () => {
    if (!template.bgImage) {
      notify('Please upload your certificate image before saving.');
      return;
    }
    await setPlatformValue('skillfort_certificate_template', template);
    notify('Certificate template saved. Student names, course names, and dates will render dynamically.');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setTemplate((prev) => ({ ...prev, bgImage: result }));
      notify('Certificate image uploaded.');
    };
    reader.readAsDataURL(file);
  };

  const updateFieldStyle = <K extends keyof CertificateFieldStyle>(
    key: K,
    value: CertificateFieldStyle[K]
  ) => {
    setTemplate((prev) => ({
      ...prev,
      elements: {
        ...prev.elements,
        [activeField]: {
          ...prev.elements[activeField],
          [key]: value,
        },
      },
    }));
  };

  const handleStartDrag = (e: React.MouseEvent, field: CertificateFieldKey) => {
    e.preventDefault();
    setActiveField(field);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const leftPct = Math.max(0, Math.min(100, ((moveEvent.clientX - rect.left) / rect.width) * 100));
      const topPct = Math.max(0, Math.min(100, ((moveEvent.clientY - rect.top) / rect.height) * 100));
      setTemplate((prev) => ({
        ...prev,
        elements: {
          ...prev.elements,
          [field]: {
            ...prev.elements[field],
            left: Math.round(leftPct),
            top: Math.round(topPct),
          },
        },
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const activeStyle = template.elements[activeField];

  const fieldText = (field: CertificateFieldKey) => {
    if (field === 'studentName') return previewData.studentName;
    if (field === 'courseTitle') return previewData.courseTitle;
    return previewData.issueDate;
  };

  return (
    <div className="w-full space-y-6 text-gray-100">
      <div className="flex flex-col gap-2 border-b border-neutral-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Certificate Builder</h2>
          <p className="text-xs text-gray-500">
            Upload your certificate design. Student name, course name, and a date range
            (enrollment to completion) are added dynamically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void saveToSystem()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F89A15] px-5 py-2.5 text-sm font-bold text-black hover:bg-orange-400"
        >
          <Save size={15} /> Save template
        </button>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-4">
          <div className="space-y-3 rounded-3xl border border-neutral-800 bg-[#111111] p-6">
            <label className="text-xs font-semibold text-gray-300">
              Certificate image <span className="text-red-400">*</span>
            </label>
            <div className="relative rounded-2xl border-2 border-dashed border-neutral-800 bg-black/20 p-6 text-center transition-colors hover:border-[#F89A15]">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              />
              <Upload size={22} className="mx-auto text-[#F89A15]" />
              <p className="mt-2 text-xs font-bold text-gray-200">Upload your certificate</p>
              <p className="text-[10px] text-gray-500">Recommended: 930 × 600 px</p>
            </div>

            {template.bgImage && (
              <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-black/30 p-3">
                <img
                  src={template.bgImage}
                  alt="Certificate template"
                  className="h-12 w-16 rounded-lg border border-neutral-800 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#F89A15]">
                    Template ready
                  </p>
                  <p className="truncate text-[10px] text-gray-500">certificate-template.png</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTemplate((prev) => ({ ...prev, bgImage: '' }))}
                  className="rounded-xl p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-3xl border border-neutral-800 bg-[#111111] p-6">
            <p className="text-sm font-bold text-white">Dynamic fields</p>
            <p className="text-xs leading-relaxed text-gray-500">
              Drag each label on the preview to match blank spaces on your certificate. The date
              shows as <span className="font-mono text-gray-300">18-NOV-2026 to 20-DEC-2026</span>{' '}
              (from enrollment to completion).
            </p>

            <div className="space-y-2">
              {(Object.keys(CERTIFICATE_FIELD_LABELS) as CertificateFieldKey[]).map((field) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => setActiveField(field)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-all ${
                    activeField === field
                      ? 'border-[#F89A15]/50 bg-[#F89A15]/10 text-[#F89A15]'
                      : 'border-neutral-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {CERTIFICATE_FIELD_LABELS[field]}
                </button>
              ))}
            </div>

            <div className="space-y-3 border-t border-neutral-800 pt-4">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500">
                  <span>Font size</span>
                  <span>{activeStyle.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={72}
                  value={activeStyle.fontSize}
                  onChange={(e) => updateFieldStyle('fontSize', parseInt(e.target.value, 10))}
                  className="w-full accent-[#F89A15]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Text color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activeStyle.color}
                    onChange={(e) => updateFieldStyle('color', e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded bg-transparent"
                  />
                  <input
                    type="text"
                    value={activeStyle.color}
                    onChange={(e) => updateFieldStyle('color', e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-black px-2 py-1 font-mono text-[10px] text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Alignment</label>
                <select
                  value={activeStyle.align}
                  onChange={(e) =>
                    updateFieldStyle('align', e.target.value as CertificateFieldStyle['align'])
                  }
                  className="w-full rounded-lg border border-neutral-800 bg-black p-2 text-xs font-medium text-white"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 lg:col-span-8">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Award size={14} className="text-[#F89A15]" />
            Live preview — drag the three dynamic fields into place
          </div>

          <div className="rounded-3xl border border-neutral-800 bg-[#111111]/40 p-4">
            <div
              ref={containerRef}
              className="relative aspect-[1.55] w-full overflow-hidden rounded-xl bg-white shadow-2xl"
              style={{
                backgroundImage: template.bgImage ? `url(${template.bgImage})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {!template.bgImage && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                  Upload a certificate image to begin positioning fields
                </div>
              )}

              {(Object.keys(CERTIFICATE_FIELD_LABELS) as CertificateFieldKey[]).map((field) => {
                const style = template.elements[field];
                return (
                  <div
                    key={field}
                    onMouseDown={(e) => handleStartDrag(e, field)}
                    className={`absolute cursor-move rounded border px-3 py-1 transition-colors group ${
                      activeField === field
                        ? 'border-[#F89A15] bg-[#F89A15]/10'
                        : 'border-transparent hover:border-dashed hover:border-[#F89A15]/60'
                    }`}
                    style={{
                      top: `${style.top}%`,
                      left: `${style.left}%`,
                      transform:
                        style.align === 'center'
                          ? 'translate(-50%, -50%)'
                          : style.align === 'right'
                            ? 'translate(-100%, -50%)'
                            : 'translate(0, -50%)',
                      fontSize: `${style.fontSize}px`,
                      color: style.color,
                      fontWeight:
                        style.fontWeight === 'bold' || style.fontWeight === 'black'
                          ? 'bold'
                          : style.fontWeight === 'semibold'
                            ? 600
                            : style.fontWeight === 'medium'
                              ? 500
                              : 'normal',
                      fontFamily:
                        style.fontFamily === 'serif' ? 'Georgia, serif' : "'Poppins', sans-serif",
                      textAlign: style.align,
                      maxWidth: '85%',
                    }}
                  >
                    <span className="mr-1 inline-flex opacity-0 group-hover:opacity-100">
                      <Move size={10} className="text-gray-400" />
                    </span>
                    {fieldText(field)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
