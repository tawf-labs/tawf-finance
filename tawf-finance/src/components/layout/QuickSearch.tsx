import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';

export interface SearchItem {
  label: string;
  hint: string;
  to: string;
}

const PUBLIC: SearchItem[] = [
  { label: 'Proof of Reserve', hint: 'Public page', to: '/proof-of-reserve' },
  { label: 'How it works', hint: 'Public page', to: '/how-it-works' },
  { label: 'Instruments', hint: 'Public page', to: '/instruments' },
  { label: 'Glossary', hint: 'Public page', to: '/glossary' },
];

/** Header quick jump over the role's pages, the products and the public pages. "/" focuses it. */
export function QuickSearch({ items }: { items: SearchItem[] }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const [mobileOpen, setMobileOpen] = useState(false);

  // One entry per destination, the role's own items first.
  const all = useMemo(() => {
    const seen = new Set<string>();
    return [...items, ...PUBLIC].filter((i) => (seen.has(i.to) ? false : (seen.add(i.to), true)));
  }, [items]);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return all.slice(0, 8);
    // Label matches rank before hint matches, a label that starts with the text ranks first.
    const rank = (i: SearchItem) => {
      const l = i.label.toLowerCase();
      if (l.startsWith(t)) return 0;
      if (l.includes(t)) return 1;
      if (i.hint.toLowerCase().includes(t)) return 2;
      return -1;
    };
    return all
      .map((i) => ({ i, r: rank(i) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r)
      .map((x) => x.i)
      .slice(0, 8);
  }, [q, all]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        setMobileOpen(true);
        setOpen(true);
        input.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (i: SearchItem | undefined) => {
    if (!i) return;
    setQ('');
    setOpen(false);
    setMobileOpen(false);
    input.current?.blur();
    if (/^https?:/.test(i.to)) window.location.href = i.to;
    else navigate(i.to);
  };

  const showList = open && (results.length > 0 || q.trim().length > 0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setMobileOpen(true); setOpen(true); setTimeout(() => input.current?.focus(), 0); }}
        className="md:hidden p-2 rounded-full hover:bg-tawf-green-10 text-tawf-green"
        aria-label="Search"
      >
        <Search className="w-5 h-5" />
      </button>
      <div
        className={`items-center gap-2 px-4 py-2 bg-white rounded-full border border-tawf-green-10 focus-within:border-tawf-green md:flex ${
          mobileOpen ? 'fixed left-4 right-4 top-3 z-50 flex shadow-lift' : 'hidden'
        }`}
      >
        <Search className="w-4 h-4 text-tawf-muted" />
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls="quicksearch-list"
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `qs-opt-${active}` : undefined}
          value={q}
          placeholder="Search…  /"
          aria-label="Search pages"
          onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => { setOpen(false); setMobileOpen(false); }, 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
            else if (e.key === 'Escape') { setOpen(false); setMobileOpen(false); input.current?.blur(); }
          }}
          className="bg-transparent border-none outline-none text-sm w-full md:w-40"
        />
        <button type="button" className="md:hidden text-tawf-muted" aria-label="Close search" onMouseDown={(e) => { e.preventDefault(); setMobileOpen(false); setOpen(false); }}>
          <X className="w-4 h-4" />
        </button>
      </div>
      {showList && (
        <ul
          id="quicksearch-list"
          role="listbox"
          className={`rounded-2xl bg-white shadow-lift ring-1 ring-line py-2 z-50 ${
            mobileOpen ? 'fixed left-4 right-4 top-16' : 'absolute right-0 mt-2 w-72 hidden md:block'
          } md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-72`}
        >
          {results.length === 0 && <li className="px-4 py-2 text-sm text-tawf-muted">No matches</li>}
          {results.map((r, i) => (
            <li key={r.to} id={`qs-opt-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); go(r); }}
                onMouseEnter={() => setActive(i)}
                className={`w-full text-left px-4 py-2 ${i === active ? 'bg-tawf-green-5' : ''}`}
              >
                <span className="block text-sm text-tawf-ink">{r.label}</span>
                <span className="block text-xs text-tawf-muted">{r.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
