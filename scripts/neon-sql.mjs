/**
 * Run SQL against Neon using DATABASE_URL from environment or .env
 *
 * Usage:
 *   npm run neon:sql -- services/neon-data/schema.sql
 *   npm run neon:sql -- --query "SELECT COUNT(*) FROM workspaces"
 *   npm run neon:ping
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { loadEnvFile } from './load-env.mjs';

loadEnvFile('.env');
loadEnvFile('.env.local');

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    ''
  ).trim();
}

/** Split SQL file into statements (naive; good enough for our migration files). */
function splitStatements(sql) {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      // drop pure-comment blocks
      const withoutComments = s
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim();
      return withoutComments.length > 0;
    });
}

async function main() {
  const url = getDatabaseUrl();
  if (!url) {
    console.error(`
No DATABASE_URL found.

Create a file (gitignored):
  ${resolve(process.cwd(), '.env')}

With one line:
  DATABASE_URL=postgresql://...your Neon pooled string...

Copy from Neon Connect (pooling ON), same value as Netlify env.
Do not commit .env or paste the password into git/chat if you can avoid it.
`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const queryIdx = args.indexOf('--query');
  let sqlText = '';

  if (queryIdx >= 0) {
    sqlText = args[queryIdx + 1] || '';
    if (!sqlText) {
      console.error('Usage: npm run neon:sql -- --query "SELECT 1"');
      process.exit(1);
    }
  } else if (args[0] === '--ping' || args.includes('--ping')) {
    sqlText = 'SELECT 1 AS ok, current_database() AS database, now() AS server_time';
  } else if (args[0]) {
    const filePath = resolve(process.cwd(), args[0]);
    if (!existsSync(filePath)) {
      console.error('SQL file not found:', filePath);
      process.exit(1);
    }
    sqlText = readFileSync(filePath, 'utf8');
  } else {
    console.error(`
Usage:
  npm run neon:ping
  npm run neon:sql -- services/neon-data/schema.sql
  npm run neon:sql -- --query "SELECT * FROM workspaces LIMIT 5"
`);
    process.exit(1);
  }

  const sql = neon(url);

  // Single query mode (neon tagged template needs special handling for dynamic SQL)
  // Use neon's sql.query if available, else execute via unsafe
  const statements = splitStatements(sqlText);
  console.log(`Connecting to Neon… (${statements.length} statement(s))`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.replace(/\s+/g, ' ').slice(0, 80);
    try {
      // neon() returns a function usable as sql`...` or sql('...', params)
      const result = await sql(statement);
      const rows = Array.isArray(result) ? result : result?.rows || result;
      console.log(`OK [${i + 1}/${statements.length}] ${preview}${statement.length > 80 ? '…' : ''}`);
      if (rows && rows.length && (args.includes('--query') || args.includes('--ping') || args[0] === '--ping')) {
        console.log(JSON.stringify(rows, null, 2));
      }
    } catch (err) {
      console.error(`FAIL [${i + 1}/${statements.length}] ${preview}…`);
      console.error(err.message || err);
      process.exit(1);
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
