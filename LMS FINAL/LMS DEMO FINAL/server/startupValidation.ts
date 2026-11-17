/**
 * Validates required environment variables before the server accepts traffic in production.
 */
export function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const missing: string[] = [];

  if (!process.env.JWT_SECRET?.trim()) {
    missing.push('JWT_SECRET');
  }
  if (!process.env.DATABASE_URL?.trim()) {
    missing.push('DATABASE_URL');
  }
  if (!process.env.APP_URL?.trim()) {
    missing.push('APP_URL');
  }

  if (missing.length > 0) {
    throw new Error(
      `Production startup blocked — set required environment variables: ${missing.join(', ')}`
    );
  }
}
