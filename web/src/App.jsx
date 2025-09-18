import React, { useEffect, useMemo, useState } from 'react'

/**
 * Simple icon mapping by "kind" returned from the API.
 * Not all are currently used in the UI (we mainly show thumbnails),
 * but this is handy if you want to render a fallback icon per kind.
 */
const KIND_ICON = {
  dir: '📁',
  image: '🖼️',
  video: '🎬',
  audio: '🎧',
  pdf: '📄',
  text: '📄',
  other: '📦'
}

/* ==========================================================
   Preview helpers (prefer PNG > WEBP > JPG > JPEG > GIF > SVG)
   ========================================================== */

const IMG_EXTS = new Set(['png', 'webp', 'jpg', 'jpeg', 'gif', 'svg'])
const PREFERRED_ORDER = ['png', 'webp', 'jpg', 'jpeg', 'gif', 'svg']

/* ==========================================================
   "Main folders" configuration
   ----------------------------------------------------------
   You can highlight specific folders at the library root.
   Matching is done by *name* OR by *relative path*.
   Add entries as lowercase names (or paths).
   ========================================================== */

const MAIN_FOLDERS = new Set([
  // Match by folder name (case-insensitive):
  'assets',
  'texture',
  'hdri',
  'stock_fx',
  // Or match by full relative path (if multiple folders share a name):
  // 'photos/2025',
])

/**
 * Return true if an item is considered a "main folder".
 * Main folders are emphasized at the root level.
 */
function isMainFolder(item) {
  if (!item?.isDir) return false;
  const name = String(item.name || '').toLowerCase().trim();
  const path = String(item.path || '').toLowerCase().trim();
  // Match by name OR by (relative) path.
  return MAIN_FOLDERS.has(name) || MAIN_FOLDERS.has(path);
}

/* ==========================================================
   useDarkMode()
   ----------------------------------------------------------
   Dark-mode toggle with:
   - Persistence in localStorage under "theme"
   - Respect system preference on first load if no saved theme
   - Applies/removes a "dark" class on <html> (Tailwind-compatible)
   ========================================================== */
function useDarkMode() {
  const getInitial = () => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    // No saved preference → follow system setting
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  };

  const [enabled, setEnabled] = React.useState(getInitial);

  React.useEffect(() => {
    const root = document.documentElement;
    if (enabled) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [enabled]);

  return [enabled, setEnabled];
}

/**
 * getExt(entry)
 * ----------------------------------------------------------
 * Extract file extension (lowercased, without the leading dot)
 * from a string or from a file-like object { url/name/ext }.
 */
function getExt(entry) {
  if (!entry) return ''
  if (typeof entry === 'object') {
    if (entry.ext) return String(entry.ext).replace('.', '').toLowerCase()
    if (entry.url) return getExt(entry.url)
    if (entry.name) return getExt(entry.name)
    return ''
  }
  const clean = String(entry).split('?')[0]
  const dot = clean.lastIndexOf('.')
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : ''
}

/**
 * stripExt(name)
 * ----------------------------------------------------------
 * Remove the last extension from a filename string.
 * Example: "image.final.v2.jpg" → "image.final.v2"
 */
function stripExt(name) {
  if (typeof name !== 'string') return name;
  return name.replace(/\.[^./\\]+$/, '');
}

/**
 * pickPreviewUrl(item)
 * ----------------------------------------------------------
 * Decide which URL to use for the preview thumbnail of an item:
 * 1) If the item has multiple "image" files, pick the one with
 *    the preferred extension order (png > webp > jpg > ...).
 * 2) Otherwise, use `item.thumbnail` (if present).
 * 3) Otherwise, if the main `item.url` is an image, use that.
 * 4) Fallback: return null (we’ll show a box icon).
 */
function pickPreviewUrl(item) {
  const files = Array.isArray(item.files) ? item.files : []

  // 1) Prefer among multiple image files
  const imageFiles = files.filter(f => f?.url && IMG_EXTS.has(getExt(f)))
  if (imageFiles.length > 0) {
    for (const ext of PREFERRED_ORDER) {
      const hit = imageFiles.find(f => getExt(f) === ext)
      if (hit) return hit.url
    }
    // Safety net
    return imageFiles[0].url
  }

  // 2) Fallback to the server-provided thumbnail (web-safe)
  if (item.thumbnail) return item.thumbnail

  // 3) If the primary URL is an image, use it
  if (item.url && IMG_EXTS.has(getExt(item.url))) return item.url

  // 4) No preview available
  return null
}

/* ==========================================================
   Clipboard fallback (works on HTTP / file:// as well)
   ----------------------------------------------------------
   Uses a hidden <textarea> + document.execCommand('copy').
   This avoids requiring HTTPS + Permissions for navigator.clipboard.
   ========================================================== */
function copyToClipboard(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const success = document.execCommand("copy");
  document.body.removeChild(textarea);
  return success;
}

/* ==========================================================
   Minimal Toast component (auto-hides after ~2.6s)
   type: 'info' | 'error'
   ========================================================== */
function Toast({ message, onClose, type = 'info' }) {
  React.useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  const base =
    'fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-lg shadow-lg text-sm border';
  const tone =
    type === 'error'
      ? 'bg-red-600 text-white border-red-500'
      : 'bg-neutral-900 text-white border-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-200';

  return <div className={`${base} ${tone}`}>{message}</div>;
}

/* ==========================================================
   Breadcrumbs
   ----------------------------------------------------------
   Shows the current path and allows navigation to any segment.
   The root is named "LIB".
   Props:
     - cwd: string (current working directory, '' for root)
     - onNav: (path) => void  (callback to load a path)
   ========================================================== */
function Breadcrumbs({ cwd, onNav }) {
  const parts = React.useMemo(() => (cwd ? cwd.split('/').filter(Boolean) : []), [cwd])
  const crumbs = [{ name: 'LIB', path: '' }]
  parts.forEach((p, i) => {
    const path = parts.slice(0, i + 1).join('/')
    crumbs.push({ name: p, path })
  })

  return (
    <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300 flex-wrap">
      <button
        onClick={() => onNav('')}
        className="mr-2 px-2 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700"
        title="Back to root"
      >
        🏠
      </button>
      <span className="font-bold text-neutral-900 dark:text-neutral-100 mr-1">PATH:</span>
      {crumbs.map((c, idx) => (
        <span key={c.path} className="flex items-center gap-2">
          {idx > 0 && <span className="text-neutral-400 dark:text-neutral-500">/</span>}
          <button className="hover:underline" onClick={() => onNav(c.path)}>
            {c.name || 'LIB'}
          </button>
        </span>
      ))}
    </div>
  )
}

/* ==========================================================
   Card
   ----------------------------------------------------------
   Represents either:
     - a folder (click → open folder), or
     - a grouped file asset (click → preview if possible)
   Shows:
     - Thumbnail or fallback icon
     - File/folder name (variants strip the last extension)
     - Buttons to copy the folder path (UNC-style example)
     - Variants list (each button copies its exact path)
   Props:
     - item: the asset/folder object from /api/assets
     - onOpenDir: (path) => void
     - onPreviewImage: (src, alt) => void
     - onToast: (message, type?) => void
   ========================================================== */
function Card({ item, onOpenDir, onPreviewImage, onToast }) {
  const previewSrc = pickPreviewUrl(item)
  const canPreview = Boolean(previewSrc)
  const hasVariants = Array.isArray(item.files) && item.files.length > 1;
  const rawName = item?.name || '';
  const displayName = hasVariants ? stripExt(rawName) : rawName;

  return (
    <div className="rounded-2xl border border-neutral-400 bg-white dark:bg-neutral-800 dark:border-neutral-700 shadow-sm hover:shadow-md dark:hover:shadow-sm transition p-3 flex flex-col">
      {/* Clickable visual area (folder → open; file with preview → open lightbox) */}
      <button
        type="button"
        onClick={() => {
          if (item.isDir) {
            onOpenDir(item.path)
          } else if (canPreview) {
            onPreviewImage(previewSrc, item.name)
          }
        }}
        className={`aspect-[4/3] w/full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center
          ${item.isDir || canPreview ? 'cursor-pointer hover:opacity-95' : 'cursor-default'}`}
        title={item.isDir ? 'Open folder' : (canPreview ? 'Preview image' : '')}
      >
        {item.isDir ? (
          <div className="text-5xl">📁</div>
        ) : canPreview ? (
          <img
            src={previewSrc}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="text-5xl">📦</div>
        )}
      </button>

      <div className="mt-3 flex-1 flex flex-col">
        {/* File/asset name (strip last extension if multiple variants exist) */}
        <div className="font-medium line-clamp-2 break-all">{displayName}</div>

        {/* Primary action button area (always directly under the title) */}
        <div className="mt-3 flex gap-2">
          {item.isDir ? (
            <button
              className="px-3 py-2 text-sm rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
              onClick={() => onOpenDir(item.path)}
            >
              Open Folder
            </button>
          ) : !item.files || item.files.length === 1 ? (
            <>
              <div className="mt-0 flex flex-col gap-2">
                {/* Button: copy *folder* path (derived from public /files URL) */}
                <button
                  className="px-3 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-green-500"
                  onClick={() => {
                    const folderPath = (
                      item.url
                        .replace(/^\/files/, "//mango/data/LIB")
                        .replaceAll("/", "\\")
                        .replaceAll("%20", " ")
                    ).replace(/\\[^\\]+$/, "");
                    const ok = copyToClipboard(folderPath);
                    if (ok) {
                      onToast?.("📋 Folder path copied to clipboard");
                    } else {
                      onToast?.("⚠️ Unable to copy automatically");
                    }
                  }}
                >
                  📁 Copy folder path
                </button>
              </div>
            </>
          ) : (
            <button
              className="px-3 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-400"
              onClick={() => {
                const folderPath = (
                  item.url
                    .replace(/^\/files/, "//mango/data/LIB")
                    .replaceAll("/", "\\")
                    .replaceAll("%20", " ")
                ).replace(/\\[^\\]+$/, "");
                const ok = copyToClipboard(folderPath);
                if (ok) {
                  onToast?.("📋 Folder path copied to clipboard");
                } else {
                  onToast?.("⚠️ Unable to copy automatically");
                }
              }}
            >
              📁 Copy folder path
            </button>
          )}
        </div>

        {/* Variants section (each button copies the exact variant path) */}
        {!item.isDir && item.files && (
          <div className="text-xs text-neutral-500 mt-2">
            Variants path:
            <div className="mt-1 flex flex-wrap gap-2">
              {item.files.map(f => (
                <button
                  key={f.url}
                  onClick={() => {
                    const transformedPath = f.url
                      .replace(/^\/files/, "//mango/data/LIB")
                      .replaceAll("/", "\\")
                      .replaceAll("%20", " ");
                    const copied = copyToClipboard(transformedPath);
                    if (copied) {
                      onToast?.("📋 Variant path copied");
                    } else {
                      onToast?.("⚠️ Failed to copy");
                    }
                  }}
                  className="px-2 py-1 rounded-lg border dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 truncate text-left"
                  title={f.name}
                >
                  {f.resolution ? f.resolution.toUpperCase() : f.ext.replace('.', '').toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ==========================================================
   Skeletons (loading placeholders; no animations)
   ========================================================== */
function SkeletonCard() {
  return (
    <div className="rounded-2xl border bg-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 p-3 flex flex-col">
      <div className="aspect-[4/3] w-full rounded-xl bg-neutral-100 dark:bg-neutral-700" />
      <div className="mt-3 space-y-2">
        <div className="h-4 bg-neutral-100 dark:bg-neutral-700 rounded w-3/4" />
        <div className="h-3 bg-neutral-100 dark:bg-neutral-700 rounded w-1/2" />
        <div className="h-3 bg-neutral-100 dark:bg-neutral-700 rounded w-24" />
      </div>
      <div className="mt-3 h-9 bg-neutral-100 dark:bg-neutral-700 rounded w-36" />
    </div>
  );
}

function SkeletonGrid({ count = 15 }) {
  return (
    <div className="mt-2 grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/* ==========================================================
   Left Sidebar (Tags)
   ----------------------------------------------------------
   Displays tags with counts and allows toggling filters.
   Props:
     - tags: [{ name, count }]
     - active: string[] (active tag names)
     - onToggle(name)
     - onClear()
     - tagSort: 'pop' | 'alpha'
     - onChangeSort(mode)
   ========================================================== */
function TagSidebar({ tags, active, onToggle, onClear, tagSort = 'pop', onChangeSort }) {
  const hasTags = Array.isArray(tags) && tags.length > 0
  return (
    <aside className="hidden md:block top-6 self-start">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-xs uppercase font-semibold tracking-wide text-neutral-500 dark:text-neutral-400">Tags</div>
          {/* Tag sort toggle (by popularity or alphabetically) */}
          <div className="flex items-center gap-1" role="group" aria-label="Sort tags">
            <button
              onClick={() => onChangeSort?.('pop')}
              className={`px-2 py-0.5 text-xs rounded border ${
                tagSort === 'pop'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
              title="Sort by occurrences"
              aria-pressed={tagSort === 'pop'}
            >
              #
            </button>
            <button
              onClick={() => onChangeSort?.('alpha')}
              className={`px-2 py-0.5 text-xs rounded border ${
                tagSort === 'alpha'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
              title="Sort alphabetically (A–Z)"
              aria-pressed={tagSort === 'alpha'}
            >
              A–Z
            </button>
          </div>
        </div>

        {active.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-blue-600 hover:underline"
            title="Clear all tags"
          >
            Clear
          </button>
        )}
      </div>

      {hasTags ? (
        <ul className="space-y-1 pr-3 max-h-[calc(100vh-180px)] overflow-auto">
          {tags.map(t => {
            const isActive = active.includes(t.name)
            return (
              <li key={t.name}>
                <button
                  onClick={() => onToggle(t.name)}
                  className={`w-full flex items-center justify-between text-sm px-2 py-1 rounded
                    ${isActive
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}
                  title={`${t.name} (${t.count})`}
                >
                  <span className="truncate">{t.name}</span>
                  <span className={`ml-2 text-xs ${isActive ? 'opacity-80' : 'text-neutral-500 dark:text-neutral-400'}`}>
                    ({t.count})
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="pr-3">
          <div className="p-3 rounded-lg border border-dashed text-sm text-neutral-500 dark:text-neutral-400 dark:border-neutral-700">
            No tags available for this folder.
          </div>
        </div>
      )}
    </aside>
  )
}

/* ==========================================================
   App (Main component)
   ----------------------------------------------------------
   Responsibilities:
     - Load directory content via /api/assets?dir=...
     - Manage filters (search + active tags)
     - Separate "Main folders" at the root
     - Display grid of cards (folders + assets)
     - Handle lightbox preview and toasts
   ========================================================== */
export default function App() {
  // Current working directory ('' = root)
  const [cwd, setCwd] = useState('')
  // Items in the current directory (folders + grouped file assets)
  const [items, setItems] = useState([])
  // All tags aggregated for the current directory (from API)
  const [tags, setTags] = useState([])           
  // Currently active tag filters
  const [activeTags, setActiveTags] = useState([]) 
  // Tag sorting mode: 'pop' (by count) or 'alpha' (A–Z)
  const [tagSort, setTagSort] = useState('pop')
  // Loading / error states for fetch
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Free-text search term
  const [q, setQ] = useState('')
  // Lightbox state: { src, alt } | null
  const [lightbox, setLightbox] = useState(null)
  // Dark mode (with persistence and system-pref default)
  const [dark, setDark] = useDarkMode();

  // Global toast state
  const [toast, setToast] = useState({ msg: '', type: 'info' });
  const showToast = (msg, type = 'info') => setToast({ msg, type });

  /**
   * Load the directory listing from the server.
   * - dir = '' means the library root.
   * - If the request succeeds, it resets active tags.
   * - Smoothly scroll back to top after loading.
   */
  const load = async (dir = '') => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/assets${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setCwd(data.cwd || '')
      setItems(Array.isArray(data.items) ? data.items : [])
      setTags(Array.isArray(data.tags) ? data.tags : [])
      setActiveTags([])
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(String(e.message || e))
      showToast('⚠️ ' + (e.message || 'Load failed'), 'error');
    } finally {
      setLoading(false)
    }
  }

  // Initial load at mount
  useEffect(() => { load('') }, [])

  /**
   * Derive the filtered list of items based on:
   * - Name contains the search term (case-insensitive)
   * - Contains all active tags
   */
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return items.filter(i => {
      const nameOK = !term || i.name?.toLowerCase().includes(term)
      const itemTags = Array.isArray(i.tags) ? i.tags.map(t => t.toLowerCase()) : []
      const tagsOK =
        activeTags.length === 0 ||
        activeTags.every(a => itemTags.includes(a.toLowerCase()))
      return nameOK && tagsOK
    })
  }, [items, q, activeTags])

  /**
   * Recompute tag counts over the *filtered* items
   * so counts reflect the current search context.
   * Keeps selected tags visible (count = 0) even if filtered out.
   */
  const displayTags = useMemo(() => {
    const counts = new Map()
    for (const it of filtered) {
      const seen = new Set()
      for (const tg of it.tags || []) {
        const k = String(tg).toLowerCase()
        if (seen.has(k)) continue
        seen.add(k)
        counts.set(k, (counts.get(k) || 0) + 1)
      }
    }
    for (const a of activeTags) {
      const k = a.toLowerCase()
      if (!counts.has(k)) counts.set(k, 0)
    }
    const list = Array.from(counts, ([name, count]) => ({ name, count }))
    if (tagSort === 'alpha') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    }
    return list
  }, [filtered, activeTags, tagSort])

  // Tag selection helpers
  const toggleTag = (name) =>
    setActiveTags(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name])
  const clearTags = () => setActiveTags([])

  /**
   * Split the filtered list into:
   * - mainFolders: emphasized at the root only
   * - otherItems: everything else
   * Also ensures stable sorting by name.
   */
  const { mainFolders, otherItems } = useMemo(() => {
    const mains = [];
    const others = [];
    const seen = new Set(); // avoid duplicates by unique key

    for (const it of filtered) {
      const key = (it.isDir ? 'd:' : 'f:') + it.path;
      if (seen.has(key)) continue;
      seen.add(key);

      if (it.isDir && isMainFolder(it) && (cwd === '' || cwd === undefined)) {
        // Option: display "Main folders" only at library root
        mains.push(it);
      } else {
        others.push(it);
      }
    }

    const byName = (a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });

    mains.sort(byName);
    others.sort(byName);

    return { mainFolders: mains, otherItems: others };
  }, [filtered, cwd]);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
      <div className="max-w-full mx-auto p-10">
        {/* Header: breadcrumbs, search, theme toggle */}
        <header className="sticky top-0 z-50 bg-neutral/90 dark:bg-neutral-900/90 backdrop-blur border-b border-neutral-200 dark:border-neutral-800 mb-4">
          <div className="flex items-center justify-between gap-4 py-3">
            <Breadcrumbs cwd={cwd} onNav={load} />
            <div className="flex items-center gap-2">
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="🔍 Search…"
                className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 w-72 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              />
              <button
                onClick={() => setDark(!dark)}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {dark ? '🌙' : '☀️'}
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Left column: tag sidebar (desktop) */}
          <div className="sticky top-20 hidden md:block md:col-span-3 lg:col-span-2">
            <TagSidebar
              tags={displayTags}
              active={activeTags}
              onToggle={toggleTag}
              onClear={clearTags}
              tagSort={tagSort}
              onChangeSort={setTagSort}
            />
          </div>

          {/* Right column: main content */}
          <main className="col-span-12 md:col-span-9 lg:col-span-10">
            {/* Mobile tags (simple inline list) */}
            <div className="md:hidden mb-2 flex items-center gap-2 flex-wrap">
              {displayTags.length > 0 ? (
                <>
                  {displayTags.map(t => {
                    const isActive = activeTags.includes(t.name)
                    return (
                      <button
                        key={t.name}
                        onClick={() => toggleTag(t.name)}
                        className={`px-2 py-1 rounded-full border text-sm
                          ${isActive
                            ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100'
                            : 'bg-black dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}
                      >
                        {t.name} <span className="opacity-60 ml-1">({t.count})</span>
                      </button>
                    )
                  })}
                  {activeTags.length > 0 && (
                    <button
                      onClick={clearTags}
                      className="px-2 py-1 rounded-full border text-sm bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700"
                    >
                      Clear
                    </button>
                  )}
                </>
              ) : (
                <div className="text-sm text-neutral-500 dark:text-neutral-400">No tags available for this folder.</div>
              )}
            </div>

            {error && <div className="mt-4 text-red-600 dark:text-red-400">{error}</div>}

            {/* Main content area: skeleton or grids */}
            {loading ? (
              <SkeletonGrid count={15} />
            ) : (
              <>
                {/* Highlighted "Main folders" at root */}
                {mainFolders.length > 0 && (
                  <section className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Main folders</h2>
                    </div>
                    <div className="mt-2 grid gap-4 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
                      {mainFolders.map((it) => (
                        <Card
                          key={(it.isDir ? 'd:' : 'f:') + it.path}
                          item={it}
                          onOpenDir={load}
                          onPreviewImage={(src, alt) => setLightbox({ src, alt })}
                          onToast={showToast}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* All other items */}
                <section>
                  {mainFolders.length > 0 && (
                    <div className="flex items-center justify-between mt-4 mb-2">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">All items</h2>
                    </div>
                  )}

                  <div className="mt-2 grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
                    {otherItems.map((it) => (
                      <Card
                        key={(it.isDir ? 'd:' : 'f:') + it.path}
                        item={it}
                        onOpenDir={load}
                        onPreviewImage={(src, alt) => setLightbox({ src, alt })}
                        onToast={showToast}
                      />
                    ))}
                  </div>

                  {otherItems.length === 0 && filtered.length === 0 && (
                    <div className="mt-10 text-center text-neutral-500 dark:text-neutral-400">
                      No items found {q && `for "${q}"`}{activeTags.length > 0 && ` with tags: ${activeTags.join(', ')}`}.
                    </div>
                  )}
                </section>

                {/* Extra empty-state safety (if filtered result is empty) */}
                {filtered.length === 0 && (
                  <div className="mt-10 text-center text-neutral-500 dark:text-neutral-400">
                    No items found {q && `for "${q}"`}{activeTags.length > 0 && ` with tags: ${activeTags.join(', ')}`}.
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        {/* Image Lightbox (click outside or press Esc to close) */}
        {lightbox && (
          <div
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
            onKeyDown={(e) => { if (e.key === 'Escape') setLightbox(null) }}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
          >
            <img
              src={lightbox.src}
              alt={lightbox.alt || ''}
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 px-3 py-2 rounded-lg bg-white text-black hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700"
              onClick={() => setLightbox(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}

        {/* Global toast (bottom-center) */}
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast({ msg: '', type: 'info' })}
        />
      </div>
    </div>
  )
}
