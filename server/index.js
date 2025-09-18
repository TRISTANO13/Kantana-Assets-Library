// =============================================
// Load environment variables from .env
// (ASSETS_ROOT, PORT, etc.)
// =============================================
import 'dotenv/config';

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import mime from 'mime-types';
import url from 'url';

const app = express();

// =============================================
// HTTP Port configuration
// Default = 5174 if not defined in .env
// =============================================
const PORT = process.env.PORT || 5174;

// =============================================
// Root directory for assets (MANDATORY)
// All served files must be inside this directory
// =============================================
const ASSETS_ROOT = process.env.ASSETS_ROOT;
if (!ASSETS_ROOT) {
  console.error('❌ Missing ASSETS_ROOT in .env');
  process.exit(1); // Exit if variable not defined
}

// Helper: get __dirname with ES modules
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * =============================================
 * Security helper: safeJoin(root, rel)
 * ---------------------------------------------
 * Ensures that file paths always stay inside
 * the allowed root directory.
 *
 * - Blocks traversal attempts (../../ etc.)
 * - Returns an absolute path safely resolved
 *
 * @param {string} root - The allowed root directory
 * @param {string} rel  - The requested relative path
 * @returns {string} absolute path inside the root
 * @throws {Error} if the path tries to escape root
 * =============================================
 */
function safeJoin(root, rel = '') {
  const abs = path.resolve(root, rel); // Absolute version of root + rel
  const relToRoot = path.relative(path.resolve(root), abs);

  // If it starts with ".." → outside of root → reject
  if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
    throw new Error('Path traversal blocked');
  }
  return abs;
}

/**
 * =============================================
 * classify(mimetype)
 * ---------------------------------------------
 * Simplifies MIME types into broad categories
 * for frontend display (icons, filters, etc.)
 *
 * Examples:
 *  - "image/png"  → "image"
 *  - "video/mp4"  → "video"
 *  - "text/plain" → "text"
 *  - "application/pdf" → "pdf"
 * =============================================
 */
function classify(mimetype) {
  if (!mimetype) return 'other';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.startsWith('text/')) return 'text';
  return 'other';
}

/* ======================================================
   Helpers for filename normalization and metadata parsing
   ====================================================== */

// Regex for detecting "preview" words in filenames
const PREVIEW_WORD_RE = /(preview|thumb|thumbnail)/ig;
const PREVIEW_TEST_RE = /(preview|thumb|thumbnail)/i;

// Regex for useless words (ignored in normalization)
const USELESS_WORD = /(raw_acescg.exr|raw_acescg.hdr|_mdl)/ig;

// Regex for resolution tokens (1k..32k, WxH, 720p, 1080p, etc.)
const RES_TOKENS_RE = new RegExp(
  [
    '(?:^|[\\s._()-])(?:[1-9]|1[0-9]|2[0-9]|3[0-2])k(?:$|[\\s._()-])',
    '(?:^|[\\s._()-])\\d{3,5}x\\d{3,5}(?:$|[\\s._()-])',
    '(?:^|[\\s._()-])(720|1080|1440|2160|4320)p(?:$|[\\s._()-])',
    '(?:^|[\\s._()-])(512|1?024|2?048|4?096|8?192|16?384|32?768)(?:$|[\\s._()-])'
  ].join('|'),
  'ig'
);

// Regex for versions in filenames (v1, v01, v202, …)
const VERSION_RE = /(?:^|[\s._()-])v\d{1,4}(?=$|[\s._()-])/ig;

// Ignore common system files
const IGNORE_FILES = /^(Thumbs\.db|desktop\.ini|\.DS_Store)$/i;

// Filename utilities
const extOf = (n) => path.extname(n).toLowerCase();       // ".png"
const baseOf = (n) => path.basename(n, path.extname(n));  // "wood_4k_preview"

/**
 * normalizeBase(stem)
 * ---------------------------------------------
 * Creates a compact normalized key for grouping files
 * belonging to the same asset.
 *
 * - Removes "preview", resolution tokens, versions
 * - Lowercases everything
 * - Removes spaces and special characters
 *
 * Example:
 *   "wood_4k_preview_v2" → "wood"
 */
function normalizeBase(stem) {
  return stem
    .toLowerCase()
    .replace(PREVIEW_WORD_RE, ' ')
    .replace(USELESS_WORD, ' ')
    .replace(RES_TOKENS_RE, ' ')
    .replace(VERSION_RE, ' ')
    .replace(/[\s._()-]+/g, ' ')
    .trim()
    .replace(/\s+/g, '');
}

/* ======================================================
   Tagging system (automatic tag extraction from names)
   ====================================================== */

// Stopwords (ignored as tags)
const TAG_STOPWORDS = new Set([
  'preview','thumb','thumbnail','raw','aces','acescg','hdr','hdri',
  'map','free','copy','final','render','tx','exr','hdr','jpg','jpeg','png','webp','mdl',
]);

// Split filenames into tokens (separators: space, underscore, dash, etc.)
const TAG_SPLIT_RE = /[\s._()\-[\],]+/g;

// Regex for versions (ignored)
const TAG_VERSION_RE = /^v\d{1,4}$/i;

// Regex for resolution tags (kept, e.g. "4k", "2048x2048", "1080p")
const TAG_RES_RE = /^(?:[1-9]|1[0-9]|2[0-9]|3[0-2])k$|^\d{3,5}x\d{3,5}$|^(720|1080|1440|2160|4320)p$/i;

// Normalize token (remove accents, lowercase)
function normalizeToken(t) {
  return t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * extractTagsFromName(name)
 * ---------------------------------------------
 * Extracts relevant tags from a filename.
 * - Removes extension
 * - Splits into tokens
 * - Filters versions, stopwords, short/number-only tokens
 * - Keeps resolutions and meaningful words
 */
function extractTagsFromName(name) {
  const stem = path.basename(name, path.extname(name));
  const raw = stem.split(TAG_SPLIT_RE).filter(Boolean);

  const tags = [];
  for (let tok of raw) {
    tok = normalizeToken(tok);
    if (!tok) continue;
    if (TAG_VERSION_RE.test(tok)) continue;
    if (TAG_STOPWORDS.has(tok)) continue;

    if (TAG_RES_RE.test(tok)) { tags.push(tok); continue; }
    if (/^\d+$/.test(tok)) continue;
    if (tok.length >= 3) tags.push(tok);
  }
  return Array.from(new Set(tags));
}

/* ======================================================
   Image/thumbnail handling
   ====================================================== */

// Web-compatible image formats
const WEB_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.jfif', '.pjpeg', '.pjp', '.apng', '.bmp', '.ico', '.cur']);

// Formats we treat as "images" even if not web-native (but NOT EXR)
const IMAGE_EXT_FALLBACK = new Set(['.tif', '.tiff', '.bmp', '.dds']);

/* ======================================================
   API Routes
   ====================================================== */

/**
 * GET /api/assets?dir=subdir
 * ---------------------------------------------
 * Returns a JSON list of assets in the requested directory.
 *
 * Response:
 *  - Directories
 *  - Groups of files (grouped by normalizeBase)
 *    * "primary" file (prefer EXR/HDR if available)
 *    * "thumbnail" (web-safe image, ideally preview)
 *    * "tags" extracted from filenames
 */
app.get('/api/assets', async (req, res) => {
  try {
    const rel = req.query.dir ? String(req.query.dir) : '';
    const dirAbs = safeJoin(ASSETS_ROOT, rel);

    const entries = await fs.readdir(dirAbs, { withFileTypes: true });

    const groups = new Map();
    const dirs = [];

    for (const e of entries) {
      if (e.isDirectory()) { 
        dirs.push(e); 
        continue; 
      }
      if (IGNORE_FILES.test(e.name)) continue;

      const abs = path.join(dirAbs, e.name);
      const stat = await fs.stat(abs);
      const ext = extOf(e.name);
      const stem = baseOf(e.name);
      const key = normalizeBase(stem);

      const mimeType = mime.lookup(e.name) || 'application/octet-stream';

      let isImg = mimeType.startsWith('image/');
      if (IMAGE_EXT_FALLBACK.has(ext)) isImg = true;

      const isPreviewLike = PREVIEW_TEST_RE.test(stem);

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({
        name: e.name,
        url: `/files/${encodeURI(path.join(rel, e.name).replaceAll('\\','/'))}`,
        ext,
        size: stat.size,
        mtime: stat.mtime,
        mimetype: mimeType,
        isImage: isImg,
        isPreviewLike,
        tags: extractTagsFromName(e.name),
      });
    }

    const outItems = [];

    // Add directories as items
    for (const d of dirs) {
      const abs = path.join(dirAbs, d.name);
      const stat = await fs.stat(abs);
      outItems.push({
        name: d.name,
        path: path.join(rel, d.name).replaceAll('\\','/'),
        isDir: true,
        size: null,
        mtime: stat.mtime,
        url: null,
        thumbnail: null,
        files: [],
        tags: [],
      });
    }

    // Convert each group of files into an asset item
    for (const [key, files] of groups) {
      const primary =
        files.find(f => f.ext === '.exr') ||
        files.find(f => f.ext === '.hdr') ||
        files[0];

      const thumb =
        files.find(f => f.isImage && f.isPreviewLike && WEB_IMAGE_EXT.has(f.ext)) ||
        files.find(f => f.isImage && WEB_IMAGE_EXT.has(f.ext)) ||
        null;

      const unionTags = Array.from(new Set(files.flatMap(f => f.tags || [])));

      let kind = primary ? classify(primary.mimetype) : 'other';
      if (primary?.ext === '.exr') kind = 'other';

      outItems.push({
        name: primary ? primary.name : key,
        path: primary ? path.join(rel, primary.name).replaceAll('\\','/') : key,
        isDir: false,
        size: primary?.size ?? null,
        mtime: primary?.mtime ?? null,
        url: primary?.url ?? null,
        thumbnail: thumb?.url ?? null,
        mimetype: primary?.mimetype ?? null,
        kind,
        files,
        normalizeBase: key,
        tags: unionTags,
      });
    }

    // Sort: directories first, then alphanumeric
    outItems.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Aggregate tags for the current folder
    const tagCount = new Map();
    for (const it of outItems) {
      if (it.isDir) continue;
      const seen = new Set();
      for (const tg of it.tags || []) {
        const k = tg.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        tagCount.set(k, (tagCount.get(k) || 0) + 1);
      }
    }
    const tags = Array.from(tagCount.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    res.json({ cwd: rel, items: outItems, tags });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

/**
 * GET /files/*
 * ---------------------------------------------
 * Serves raw files directly from ASSETS_ROOT.
 *
 * Example: /files/textures/wood/albedo.jpg
 *
 * Note:
 * - Directory listing is NOT allowed here.
 * - To list folders/files, use /api/assets.
 */
app.get('/files/*', async (req, res) => {
  try {
    const relPath = decodeURI(req.params[0] || '');
    const abs = safeJoin(ASSETS_ROOT, relPath);
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) {
      return res.status(400).send('Directory listing via /api/assets only');
    }
    const mt = mime.lookup(abs) || 'application/octet-stream';
    res.setHeader('Content-Type', mt);
    createReadStream(abs).pipe(res);
  } catch (err) {
    res.status(404).send('Not found');
  }
});

// =============================================
// Start the server
// =============================================
app.listen(PORT, () => {
  console.log(`✅ Asset API running at http://localhost:${PORT}`);
  console.log(`📂 Serving files from: ${ASSETS_ROOT}`);
});
