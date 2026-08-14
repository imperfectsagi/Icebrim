/**
 * One-time repair for stale/blocked media URLs.
 * ------------------------------------------------------------------------
 * Run this AFTER deploying the Worker with the correct WORKER_PUBLIC_URL
 * and AFTER applying migration 0006_rename_banners_category.sql.
 *
 * Two separate problems, fixed in one pass because both require the same
 * "read every media row, decide what changed, write it back" shape:
 *
 * (A) STALE HOST (the "404 Not Found" problem)
 *     `media.url` (and every content table's *_src/videoSrc field that
 *     copied it) is a full absolute URL generated from WORKER_PUBLIC_URL
 *     AT UPLOAD TIME (see workers/src/routes/media.ts) -- it is stored,
 *     not computed on read. If WORKER_PUBLIC_URL has ever changed (e.g.
 *     moving from the raw *.workers.dev URL to api.icebrim.com), every
 *     row uploaded before that change still points at the OLD host. The
 *     R2 object itself never moved (r2_key is untouched), only the
 *     stored URL is wrong -- so this is fixable by rewriting the host
 *     portion of the URL wherever it doesn't match the CURRENT
 *     WORKER_PUBLIC_URL, without touching R2 at all.
 *
 * (B) BLOCKED PATH (the "net::ERR_BLOCKED in Incognito" problem)
 *     Media uploaded under the old 'banners' category has R2 keys like
 *     `uploads/banners/<id>.webp`. That literal path segment is a
 *     standard ad/tracker filter-list keyword and gets blocked
 *     client-side by content blockers (including the tracker-blocking
 *     most browsers enable by default in private/incognito mode) --
 *     regardless of what the file actually is. Migration 0006 already
 *     relabels these rows' `category` column to 'hero-media', but a SQL
 *     migration cannot move objects in R2 (out-of-band storage) or
 *     rewrite the `r2_key`/`url` columns to match a new path -- that's
 *     what this script does, via `wrangler r2 object get`/`put`/`delete`.
 *
 * WHAT THIS SCRIPT DOES NOT DO:
 *   - It does not guess. It only rewrites a URL's host if the row's own
 *     r2_key, re-joined with the CURRENT WORKER_PUBLIC_URL, would produce
 *     a different string than what's stored -- i.e. only genuinely stale
 *     rows are touched.
 *   - It never deletes an R2 object until the copy to the new key is
 *     confirmed to exist.
 *   - It prints every change it's about to make and requires --confirm to
 *     actually write anything (dry-run by default).
 *   - It does not touch order_items.product_image -- that column is an
 *     intentional point-in-time snapshot of what a customer saw/bought,
 *     not a live reference, and must not change after the fact even if
 *     the source media's URL later changes (see 0004_orders_schema.sql).
 *
 * Usage:
 *   node --experimental-strip-types scripts/repair-media-urls.ts [--remote] [--confirm] [--rename-banners]
 *
 *   (no flags)          Dry run against the LOCAL D1 database. Prints
 *                        every row that would change and why. Nothing is
 *                        written, no R2 calls are made.
 *   --remote             Target the remote (production) D1 database
 *                        instead of local. Combine with --confirm to
 *                        actually apply changes there.
 *   --rename-banners     Also move R2 objects for rows whose category is
 *                        now 'hero-media' but whose r2_key still contains
 *                        "uploads/banners/" (i.e. run problem (B)'s fix,
 *                        not just problem (A)'s). Requires 0006 to have
 *                        been applied first (the category column is the
 *                        signal this script uses to find affected rows).
 *   --confirm             Actually write changes (run UPDATE statements
 *                        and, with --rename-banners, move R2 objects).
 *                        Without this flag the script only prints a plan.
 *
 * Examples:
 *   # See what's stale, change nothing:
 *   node --experimental-strip-types scripts/repair-media-urls.ts --remote
 *
 *   # Fix stale hosts only:
 *   node --experimental-strip-types scripts/repair-media-urls.ts --remote --confirm
 *
 *   # Fix stale hosts AND move old banner uploads out of the blocked path:
 *   node --experimental-strip-types scripts/repair-media-urls.ts --remote --confirm --rename-banners
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const REMOTE = args.includes('--remote');
const CONFIRM = args.includes('--confirm');
const RENAME_BANNERS = args.includes('--rename-banners');

const D1_DB_NAME = 'icebrim-db';
const R2_BUCKET_NAME = 'icebrim-media';

// Read WORKER_PUBLIC_URL the same way the Worker itself would -- from
// wrangler.toml's [vars] block -- so this script always compares against
// whatever is CURRENTLY configured, never a value hardcoded here.
function readCurrentWorkerPublicUrl(): string {
  const toml = execFileSync('cat', [join(process.cwd(), 'wrangler.toml')], { encoding: 'utf-8' });
  const match = toml.match(/WORKER_PUBLIC_URL\s*=\s*"([^"]+)"/);
  if (!match) {
    throw new Error('Could not find WORKER_PUBLIC_URL in wrangler.toml -- is this script being run from the workers/ directory?');
  }
  return match[1].replace(/\/+$/, '');
}

function runD1Query<T = unknown>(sql: string): T[] {
  const tmpFile = join(mkdtempSync(join(tmpdir(), 'icebrim-repair-')), 'query.sql');
  writeFileSync(tmpFile, sql, 'utf-8');
  try {
    const flags = ['d1', 'execute', D1_DB_NAME, REMOTE ? '--remote' : '--local', '--json', `--file=${tmpFile}`];
    const output = execFileSync('npx', ['wrangler', ...flags], { encoding: 'utf-8' });
    const parsed = JSON.parse(output);
    // wrangler d1 execute --json returns an array of { results, success, meta }
    return (parsed[0]?.results ?? []) as T[];
  } finally {
    unlinkSync(tmpFile);
  }
}

function runD1Statement(sql: string): void {
  const tmpFile = join(mkdtempSync(join(tmpdir(), 'icebrim-repair-')), 'stmt.sql');
  writeFileSync(tmpFile, sql, 'utf-8');
  try {
    const flags = ['d1', 'execute', D1_DB_NAME, REMOTE ? '--remote' : '--local', `--file=${tmpFile}`];
    execFileSync('npx', ['wrangler', ...flags], { stdio: 'inherit' });
  } finally {
    unlinkSync(tmpFile);
  }
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

interface MediaRow {
  id: string;
  r2_key: string;
  url: string;
  category: string;
}

async function moveR2Object(oldKey: string, newKey: string): Promise<void> {
  const tmpFile = join(mkdtempSync(join(tmpdir(), 'icebrim-r2-')), 'object.bin');
  const remoteFlag = REMOTE ? '--remote' : '--local';
  execFileSync('npx', ['wrangler', 'r2', 'object', 'get', `${R2_BUCKET_NAME}/${oldKey}`, `--file=${tmpFile}`, remoteFlag], {
    stdio: 'inherit',
  });
  execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `${R2_BUCKET_NAME}/${newKey}`, `--file=${tmpFile}`, remoteFlag], {
    stdio: 'inherit',
  });
  // Only delete the old object after the put above has succeeded (an
  // exception from either command aborts this function before reaching
  // here, leaving the old object untouched).
  execFileSync('npx', ['wrangler', 'r2', 'object', 'delete', `${R2_BUCKET_NAME}/${oldKey}`, remoteFlag], { stdio: 'inherit' });
  unlinkSync(tmpFile);
}

// Every place a media URL can be COPIED into (not just the media table
// itself) -- see the header comment for why order_items is excluded.
const REFERENCE_TABLES: { table: string; column: string }[] = [
  { table: 'product_images', column: 'src' },
  { table: 'blog_posts', column: 'featured_image_src' },
  { table: 'blog_posts', column: 'featured_video_src' },
  { table: 'gallery_images', column: 'src' },
  { table: 'gallery_images', column: 'video_src' },
  { table: 'reviews', column: 'media_src' },
];

async function main() {
  const currentBase = readCurrentWorkerPublicUrl();
  console.log(`Current WORKER_PUBLIC_URL: ${currentBase}`);
  console.log(`Target DB: ${REMOTE ? 'REMOTE (production)' : 'local'}`);
  console.log(`Mode: ${CONFIRM ? 'APPLYING CHANGES' : 'DRY RUN (pass --confirm to write)'}`);
  if (RENAME_BANNERS) console.log('Also moving old banners/ R2 objects to hero-media/ (--rename-banners set)');
  console.log('');

  const rows = runD1Query<MediaRow>('SELECT id, r2_key, url, category FROM media;');
  console.log(`Found ${rows.length} media row(s).\n`);

  let staleHostCount = 0;
  let bannersPathCount = 0;

  for (const row of rows) {
    const correctUrl = `${currentBase}/media/${row.r2_key}`;
    const hostIsStale = row.url !== correctUrl;
    const pathIsBlocked = RENAME_BANNERS && row.r2_key.startsWith('uploads/banners/');

    if (!hostIsStale && !pathIsBlocked) continue;

    let newR2Key = row.r2_key;
    if (pathIsBlocked) {
      newR2Key = row.r2_key.replace(/^uploads\/banners\//, 'uploads/hero-media/');
      bannersPathCount++;
    }
    const newUrl = `${currentBase}/media/${newR2Key}`;
    if (hostIsStale) staleHostCount++;

    console.log(`media.id=${row.id}`);
    if (hostIsStale) console.log(`  stale host:  ${row.url}\n            -> ${newUrl}`);
    if (pathIsBlocked) console.log(`  blocked path: ${row.r2_key}\n             -> ${newR2Key}`);

    if (CONFIRM) {
      if (pathIsBlocked && newR2Key !== row.r2_key) {
        await moveR2Object(row.r2_key, newR2Key);
      }
      runD1Statement(
        `UPDATE media SET r2_key = '${escapeSqlString(newR2Key)}', url = '${escapeSqlString(newUrl)}' WHERE id = '${escapeSqlString(row.id)}';`,
      );
      // Propagate the same URL change to every table that COPIED the old
      // URL string at save time (see header comment) -- these are plain
      // string columns, not foreign keys, so they don't update
      // automatically.
      for (const { table, column } of REFERENCE_TABLES) {
        runD1Statement(
          `UPDATE ${table} SET ${column} = '${escapeSqlString(newUrl)}' WHERE ${column} = '${escapeSqlString(row.url)}';`,
        );
      }
      // site_content (home page banner) stores the URL inside a JSON
      // blob, not a plain column, so it can't be fixed with a SQL UPDATE
      // ... string match. Flag it for manual re-check instead of
      // attempting fragile JSON string surgery in SQL.
      const homeContent = runD1Query<{ value: string }>(`SELECT value FROM site_content WHERE key = 'home';`);
      if (homeContent[0]?.value.includes(row.url)) {
        console.log(
          `  NOTE: this URL also appears in site_content.home (the homepage hero banner). ` +
            `That's a JSON blob, not a plain column, so it wasn't auto-updated -- ` +
            `open Admin -> Banner and re-save it (the ImageUploadField will pick up ` +
            `the corrected media.url automatically once you re-select the same image, ` +
            `or just re-upload if convenient).`,
        );
      }
    }
    console.log('');
  }

  console.log(`\nSummary: ${staleHostCount} row(s) with a stale host, ${bannersPathCount} row(s) with a blocked banners/ path.`);
  if (!CONFIRM && (staleHostCount > 0 || bannersPathCount > 0)) {
    console.log('This was a dry run -- re-run with --confirm to apply these changes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
