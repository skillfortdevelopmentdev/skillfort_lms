import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Save, Upload } from 'lucide-react';
import type { LandingBannerConfig, LandingBannerLinkTarget } from '../../types';
import { apiFetch } from '../../api/client';
import { resolveMediaUrl } from '../../api/config';

interface LandingBannerAdminProps {
  notify: (message: string) => void;
}

const LINK_OPTIONS: Array<{ value: LandingBannerLinkTarget; label: string }> = [
  { value: 'courses', label: 'Purchase / browse courses' },
  { value: 'register', label: 'Student registration' },
  { value: 'contact', label: 'Contact / enquiry' },
];

function emptyLandingBannerConfig(): LandingBannerConfig {
  return {
    heroImageUrl: '',
    linkTarget: 'courses',
    updatedAt: '',
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function LandingBannerAdmin({ notify }: LandingBannerAdminProps) {
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<LandingBannerConfig>(emptyLandingBannerConfig);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const resp = await apiFetch('/api/admin/landing-banner');
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to load landing banner');
      }
      setConfig(data as LandingBannerConfig);
    } catch (err) {
      setConfig(emptyLandingBannerConfig());
      const message = err instanceof Error ? err.message : 'Failed to load banner';
      setLoadError(message);
      notifyRef.current(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const resp = await apiFetch('/api/admin/landing-banner', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to save banner');
      }
      setConfig(data as LandingBannerConfig);
      setLoadError('');
      notifyRef.current('Landing banner updated.');
    } catch (err) {
      notifyRef.current(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleImageSelected = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notifyRef.current('Please choose an image file.');
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const resp = await apiFetch('/api/admin/landing-banner/image', {
        method: 'POST',
        body: JSON.stringify({ dataUrl }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Image upload failed');
      }
      setConfig(data as LandingBannerConfig);
      setLoadError('');
      notifyRef.current('Banner image uploaded. Save to confirm link settings.');
    } catch (err) {
      notifyRef.current(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-12">
        <Loader2 size={16} className="animate-spin" /> Loading landing banner…
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="space-y-2">
        <h2 className="font-display font-bold text-xl text-white">Landing Page Banner</h2>
        <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
          Upload a full-width promotional image (season offers, festival sales, new batch
          posters). The entire banner is clickable — no text is shown on the home page. Choose
          where visitors go when they click (e.g. purchase courses).
        </p>
        {loadError && (
          <p className="text-xs text-amber-400/90">
            Could not load saved banner settings. You can still upload a new image below.
          </p>
        )}
      </div>

      <div className="space-y-6 bg-[#111111] border border-[#222222] rounded-2xl p-6">
        <label className="space-y-2 block max-w-md">
          <span className="text-[10px] font-bold uppercase text-gray-500">
            Click destination
          </span>
          <select
            value={config.linkTarget}
            onChange={(e) =>
              setConfig({ ...config, linkTarget: e.target.value as LandingBannerLinkTarget })
            }
            className="w-full bg-black border border-[#222222] rounded-lg px-3 py-2.5 text-sm text-white"
          >
            {LINK_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void handleImageSelected(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F89A15] text-black text-xs font-bold rounded-lg hover:bg-white transition-colors disabled:opacity-60"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading…' : 'Upload banner image'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#222222] text-gray-300 text-xs font-bold rounded-lg hover:border-[#F89A15]/40 hover:text-[#F89A15] transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save link'}
          </button>
          <span className="text-[10px] text-gray-500">JPG, PNG, WebP, GIF · max 8 MB · wide images work best</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Preview</p>
        <div className="rounded-xl overflow-hidden border border-[#222222] bg-black">
          {config.heroImageUrl ? (
            <img
              src={resolveMediaUrl(config.heroImageUrl)}
              alt="Banner preview"
              className="w-full h-auto min-h-[120px] max-h-[480px] object-cover object-center"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center border border-dashed border-[#333333] m-4 rounded-xl">
              <ImagePlus size={32} className="text-gray-600" />
              <p className="text-sm text-gray-400">No banner image yet. Upload one to preview it here.</p>
            </div>
          )}
        </div>
        <p className="text-[10px] text-gray-500">
          On the live site this image spans the full home page width and links to:{' '}
          <span className="text-[#F89A15]">
            {LINK_OPTIONS.find((o) => o.value === config.linkTarget)?.label}
          </span>
        </p>
      </div>
    </div>
  );
}
