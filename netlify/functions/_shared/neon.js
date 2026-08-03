import { randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    ''
  ).trim();
}

export function isDatabaseConfigured() {
  return getDatabaseUrl().length > 0;
}

/**
 * @returns {import('@neondatabase/serverless').NeonQueryFunction}
 */
export function getSql() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error('DATABASE_URL is not configured');
  }
  return neon(url);
}

export function generateAccessKey() {
  return 'ws_' + randomBytes(24).toString('hex');
}
