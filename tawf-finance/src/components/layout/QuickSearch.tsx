import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

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

  const all = useMemo(() => [...items, ...PUBLIC], [items]);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return all.slice(0, 8);
    return all.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(t)).slice(0, 8);
  }, [q, all]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === '/' && !typing) {
        e.preventDefault();
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
    input.current?.blur();
    if (/^https?:/.test(i.to)) window.location.href = i.to;
    else navigate(i.to);
  };

  return (
    <div className="relative hidden md:block">
      <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-tawf-green-10 focus-within:border-tawf-green">
        <Search className="w-4 h-4 text-tawf-muted" />
        <input
          ref={input}
          type="text"
          value={q}
          placeholder="Search…  /"
          aria-label="Search pages"
          onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
            else if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
          }}
          className="bg-transparent border-none outline-none text-sm w-40"
        />
      </div>
      {open && results.length > 0 && (
        <ul role="listbox" className="absolute right-0 mt-2 w-72 rounded-2xl bg-white shadow-lift ring-1 ring-line py-2 z-50">
          {results.map((r, i) => (
            <li key={`${r.to}-${r.label}`} role="option" aria-selected={i === active}>
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
