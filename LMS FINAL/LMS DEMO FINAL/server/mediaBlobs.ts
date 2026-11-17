import pg from 'pg';
import { isCloudinaryConfigured } from './uploads/cloudinaryStorage';

let poolRef: pg.Pool | null = null;

export function bindMediaBlobPool(pool: pg.Pool): void {
  poolRef = pool;
}

function getPool(): pg.Pool | null {
  return poolRef;
}

export interface MediaBlobRecord {
  contentType: string;
  data: Buffer;
}

export async function saveMediaBlob(
  storagePath: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  const pool = getPool();
  if (!pool) {
    throw new Error('PostgreSQL is required to persist media in production');
  }
  await pool.query(
    `INSERT INTO media_blobs (storage_path, content_type, data, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (storage_path) DO UPDATE
     SET content_type = EXCLUDED.content_type,
         data = EXCLUDED.data,
         updated_at = NOW()`,
    [storagePath, contentType, data]
  );
}

export async function getMediaBlob(storagePath: string): Promise<MediaBlobRecord | null> {
  const pool = getPool();
  if (!pool) {
    return null;
  }
  const result = await pool.query<{ content_type: string; data: Buffer }>(
    `SELECT content_type, data FROM media_blobs WHERE storage_path = $1`,
    [storagePath]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    contentType: row.content_type,
    data: row.data,
  };
}

export async function deleteMediaBlob(storagePath: string): Promise<void> {
  const pool = getPool();
  if (!pool) {
    return;
  }
  await pool.query(`DELETE FROM media_blobs WHERE storage_path = $1`, [storagePath]);
}

export function uploadsPathToStorageKey(uploadsUrl: string): string | null {
  const prefix = '/uploads/';
  if (!uploadsUrl.startsWith(prefix)) {
    return null;
  }
  const key = uploadsUrl.slice(prefix.length);
  if (!key || key.includes('..')) {
    return null;
  }
  return key;
}

export function shouldPersistMediaInDatabase(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    Boolean(process.env.DATABASE_URL?.trim()) &&
    !isCloudinaryConfigured()
  );
}
