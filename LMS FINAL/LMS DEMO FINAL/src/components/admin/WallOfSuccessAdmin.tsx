import { memo, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import type { WallOfSuccessEntry } from '../../types';
import { apiFetch } from '../../api/client';
import { resolveMediaUrl } from '../../api/config';

interface WallOfSuccessAdminProps {
  notify: (message: string) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

type WallCardProps = {
  entry: WallOfSuccessEntry;
  confirmDeleteId: string | null;
  deletingId: string | null;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
};

const WallOfSuccessCard = memo(function WallOfSuccessCard({
  entry,
  confirmDeleteId,
  deletingId,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: WallCardProps) {
  const isConfirming = confirmDeleteId === entry.id;
  const isDeleting = deletingId === entry.id;

  return (
    <div className="group relative bg-[#111111] border border-[#222222] rounded-xl overflow-hidden">
      <img
        src={resolveMediaUrl(entry.imageUrl)}
        alt="Placement success"
        className="w-full aspect-[4/5] object-cover bg-black"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
        <p className="text-[9px] text-gray-400 font-mono">
          {new Date(entry.createdAt).toLocaleString()}
        </p>
      </div>

      {isConfirming ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-3">
          <p className="text-[11px] font-bold text-white text-center">Remove this image?</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onConfirmDelete(entry.id)}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-bold hover:bg-red-500 disabled:opacity-60"
            >
              {isDeleting ? 'Removing…' : 'Yes, remove'}
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onCancelDelete}
              className="px-3 py-1.5 rounded-lg border border-[#444] text-gray-300 text-[10px] font-bold hover:text-white disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={Boolean(deletingId)}
          onClick={() => onRequestDelete(entry.id)}
          className="absolute top-2 right-2 p-2 rounded-lg bg-black/70 text-red-400 hover:bg-red-600 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-50"
          title="Delete image"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
});

export default function WallOfSuccessAdmin({ notify }: WallOfSuccessAdminProps) {
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<WallOfSuccessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const resp = await apiFetch('/api/admin/wall-of-success');
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to load wall of success');
      }
      startTransition(() => {
        setEntries(Array.isArray(data) ? data : []);
      });
    } catch (err) {
      startTransition(() => {
        setEntries([]);
      });
      const message = err instanceof Error ? err.message : 'Failed to load images';
      setLoadError(message);
      notifyRef.current(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files?.length) return;

    setUploading(true);
    let uploaded = 0;

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          notifyRef.current(`Skipped ${file.name}: not an image`);
          continue;
        }
        const dataUrl = await readFileAsDataUrl(file);
        const resp = await apiFetch('/api/admin/wall-of-success', {
          method: 'POST',
          body: JSON.stringify({ dataUrl }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }
        uploaded += 1;
      }

      if (uploaded > 0) {
        notifyRef.current(`Uploaded ${uploaded} placement image${uploaded === 1 ? '' : 's'}`);
        setLoadError('');
        await loadEntries();
      }
    } catch (err) {
      notifyRef.current(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRequestDelete = useCallback((id: string) => {
    setConfirmDeleteId(id);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  const handleConfirmDelete = useCallback(async (id: string) => {
    const snapshot = entries;
    setDeletingId(id);
    startTransition(() => {
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      setConfirmDeleteId(null);
    });

    try {
      const resp = await apiFetch(`/api/admin/wall-of-success/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Delete failed');
      }
      notifyRef.current('Image removed');
    } catch (err) {
      startTransition(() => {
        setEntries(snapshot);
      });
      notifyRef.current(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }, [entries]);

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="space-y-2">
        <h2 className="font-display font-bold text-xl text-white">Wall of Success</h2>
        <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
          Upload placement success images (student photo, name, and company are usually included in
          the graphic). Newest uploads appear first on the landing page carousel. Upload only with
          student consent.
        </p>
        {loadError && !loading && (
          <p className="text-xs text-amber-400/90">
            Could not load saved images. You can still upload new ones below.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => void handleFilesSelected(e.target.files)}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F89A15] text-black text-xs font-bold rounded-lg hover:bg-white transition-colors disabled:opacity-60"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'Uploading…' : 'Upload images'}
        </button>
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">
          JPG, PNG, WebP, GIF · max 8 MB each · multiple files OK
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-12 justify-center">
          <Loader2 size={16} className="animate-spin" /> Loading gallery…
        </div>
      ) : entries.length === 0 ? (
        <div className="border border-dashed border-[#333333] rounded-2xl p-12 text-center space-y-3">
          <ImagePlus size={32} className="mx-auto text-gray-600" />
          <p className="text-sm text-gray-400">No placement images yet. Upload your first success story.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">
            {entries.length} image{entries.length === 1 ? '' : 's'} · newest first
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {entries.map((entry) => (
              <WallOfSuccessCard
                key={entry.id}
                entry={entry}
                confirmDeleteId={confirmDeleteId}
                deletingId={deletingId}
                onRequestDelete={handleRequestDelete}
                onCancelDelete={handleCancelDelete}
                onConfirmDelete={handleConfirmDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
