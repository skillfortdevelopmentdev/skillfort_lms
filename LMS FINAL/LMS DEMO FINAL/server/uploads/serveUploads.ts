import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import path from 'path';
import { getMediaBlob } from '../mediaBlobs';

const localStatic = express.static(path.join(process.cwd(), 'public', 'uploads'), {
  setHeaders(res) {
    setUploadCorsHeaders(res);
  },
});

function setUploadCorsHeaders(res: Response): void {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
}

export async function serveUploadsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const relativePath = req.path.replace(/^\//, '');
  if (!relativePath || relativePath.includes('..')) {
    res.status(400).end();
    return;
  }

  try {
    const blob = await getMediaBlob(relativePath);
    if (blob) {
      setUploadCorsHeaders(res);
      res.type(blob.contentType).send(blob.data);
      return;
    }
  } catch (err) {
    console.error('[UPLOADS] postgres read failed:', err);
  }

  localStatic(req, res, (err) => {
    if (err) {
      next(err);
      return;
    }
    if (!res.headersSent) {
      res.status(404).type('text/plain').send('Not found');
    }
  });
}
