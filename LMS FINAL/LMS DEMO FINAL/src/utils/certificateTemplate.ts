export const CERTIFICATE_CANVAS_WIDTH = 1000;
export const CERTIFICATE_CANVAS_HEIGHT = 645;

export type CertificateFieldKey = 'studentName' | 'courseTitle' | 'issueDate';

export interface CertificateFieldStyle {
  top: number;
  left: number;
  fontSize: number;
  color: string;
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold' | 'black';
  fontFamily: 'sans' | 'serif' | 'mono';
  align: 'left' | 'center' | 'right';
}

export interface CertificateTemplate {
  bgImage: string;
  elements: Record<CertificateFieldKey, CertificateFieldStyle>;
}

export interface CertificateRenderData {
  studentName: string;
  courseTitle: string;
  issueDate: string;
}

export const DEFAULT_CERTIFICATE_TEMPLATE: CertificateTemplate = {
  bgImage: '',
  elements: {
    studentName: {
      top: 42,
      left: 50,
      fontSize: 36,
      color: '#111111',
      fontWeight: 'bold',
      fontFamily: 'sans',
      align: 'center',
    },
    courseTitle: {
      top: 58,
      left: 50,
      fontSize: 22,
      color: '#F89A15',
      fontWeight: 'bold',
      fontFamily: 'sans',
      align: 'center',
    },
    issueDate: {
      top: 78,
      left: 50,
      fontSize: 14,
      color: '#333333',
      fontWeight: 'medium',
      fontFamily: 'sans',
      align: 'center',
    },
  },
};

const FIELD_KEYS: CertificateFieldKey[] = ['studentName', 'courseTitle', 'issueDate'];

function isFieldStyle(value: unknown): value is CertificateFieldStyle {
  if (!value || typeof value !== 'object') return false;
  const style = value as CertificateFieldStyle;
  return typeof style.top === 'number' && typeof style.left === 'number';
}

export function normalizeCertificateTemplate(saved: unknown): CertificateTemplate {
  if (!saved || typeof saved !== 'object') {
    return DEFAULT_CERTIFICATE_TEMPLATE;
  }

  const raw = saved as Record<string, unknown>;
  const next = structuredClone(DEFAULT_CERTIFICATE_TEMPLATE);

  if (typeof raw.bgImage === 'string') {
    next.bgImage = raw.bgImage;
  }

  const legacyElements =
    raw.elements && typeof raw.elements === 'object'
      ? (raw.elements as Record<string, unknown>)
      : null;

  if (legacyElements) {
    for (const key of FIELD_KEYS) {
      if (isFieldStyle(legacyElements[key])) {
        next.elements[key] = {
          ...next.elements[key],
          ...(legacyElements[key] as CertificateFieldStyle),
        };
      }
    }
  }

  return next;
}

const CERTIFICATE_MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

export function formatCertificateDatePart(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  const day = String(value.getDate()).padStart(2, '0');
  const month = CERTIFICATE_MONTHS[value.getMonth()];
  const year = value.getFullYear();
  return `${day}-${month}-${year}`;
}

/** e.g. 18-NOV-2026 to 20-DEC-2026 (enrollment → completion) */
export function formatCertificateDateRange(
  fromDate: Date | string,
  toDate: Date | string = new Date()
): string {
  return `${formatCertificateDatePart(fromDate)} to ${formatCertificateDatePart(toDate)}`;
}

export function formatCertificateIssueDate(date = new Date()): string {
  return formatCertificateDatePart(date);
}

function canvasFont(style: CertificateFieldStyle, scale = 1.3): string {
  const weight =
    style.fontWeight === 'black'
      ? '900'
      : style.fontWeight === 'bold'
        ? 'bold'
        : style.fontWeight === 'semibold'
          ? '600'
          : style.fontWeight === 'medium'
            ? '500'
            : 'normal';
  const family =
    style.fontFamily === 'serif' ? 'Georgia, serif' : "'Poppins', sans-serif";
  return `${weight} ${style.fontSize * scale}px ${family}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

function drawBuiltInCertificateBackground(ctx: CanvasRenderingContext2D): void {
  const w = CERTIFICATE_CANVAS_WIDTH;
  const h = CERTIFICATE_CANVAS_HEIGHT;

  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, '#fffaf3');
  gradient.addColorStop(1, '#ffffff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#F89A15';
  ctx.lineWidth = 10;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, w - 80, h - 80);

  ctx.fillStyle = '#F89A15';
  ctx.font = '900 42px "Poppins", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SKILLFORT', w / 2, h * 0.18);

  ctx.fillStyle = '#111111';
  ctx.font = '600 18px "Poppins", sans-serif';
  ctx.fillText('Certificate of Completion', w / 2, h * 0.26);

  ctx.strokeStyle = '#F89A15';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.31);
  ctx.lineTo(w * 0.8, h * 0.31);
  ctx.stroke();

  ctx.fillStyle = '#666666';
  ctx.font = '500 14px "Poppins", sans-serif';
  ctx.fillText('This is to certify that', w / 2, h * 0.36);
}

export async function renderCertificateToCanvas(
  canvas: HTMLCanvasElement,
  template: CertificateTemplate,
  data: CertificateRenderData
): Promise<void> {
  canvas.width = CERTIFICATE_CANVAS_WIDTH;
  canvas.height = CERTIFICATE_CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CERTIFICATE_CANVAS_WIDTH, CERTIFICATE_CANVAS_HEIGHT);

  let usedBackground = false;
  if (template.bgImage) {
    try {
      const bg = await loadImage(template.bgImage);
      ctx.drawImage(bg, 0, 0, CERTIFICATE_CANVAS_WIDTH, CERTIFICATE_CANVAS_HEIGHT);
      usedBackground = true;
    } catch {
      // fall through to built-in design
    }
  }

  if (!usedBackground) {
    drawBuiltInCertificateBackground(ctx);
  }

  const values: Record<CertificateFieldKey, string> = {
    studentName: data.studentName,
    courseTitle: data.courseTitle,
    issueDate: data.issueDate,
  };

  for (const key of FIELD_KEYS) {
    const style = template.elements[key];
    const text = values[key];
    if (!text) continue;

    ctx.save();
    ctx.font = canvasFont(style);
    ctx.fillStyle = style.color;
    ctx.textAlign = style.align;
    ctx.textBaseline = 'middle';

    const x = (style.left / 100) * CERTIFICATE_CANVAS_WIDTH;
    const y = (style.top / 100) * CERTIFICATE_CANVAS_HEIGHT;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}

export async function downloadCertificateImage(
  template: CertificateTemplate,
  data: CertificateRenderData,
  fileName: string
): Promise<void> {
  const canvas = document.createElement('canvas');
  await renderCertificateToCanvas(canvas, template, data);
  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export const CERTIFICATE_FIELD_LABELS: Record<CertificateFieldKey, string> = {
  studentName: 'Student name',
  courseTitle: 'Course name',
  issueDate: 'Date range (from – to)',
};

const CERTIFICATE_TEMPLATE_KEY = 'skillfort_certificate_template';

/** Resolve template from platform KV (cache first, then API). */
export async function resolveCertificateTemplate(
  readCache: (key: string, fallback: unknown) => unknown,
  fetchRemote: (key: string, fallback: unknown) => Promise<unknown>
): Promise<CertificateTemplate> {
  const fromValue = (value: unknown): CertificateTemplate | null => {
    if (!value) return null;
    const normalized = normalizeCertificateTemplate(value);
    return normalized.bgImage ? normalized : null;
  };

  const cached = fromValue(readCache(CERTIFICATE_TEMPLATE_KEY, null));
  if (cached) return cached;

  const remote = fromValue(await fetchRemote(CERTIFICATE_TEMPLATE_KEY, null));
  if (remote) return remote;

  return DEFAULT_CERTIFICATE_TEMPLATE;
}
