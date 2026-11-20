import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as P from '../data/permissions';
import { clubById } from '../data/selectors';
import { useDB } from '../data/store';
import type { ID } from '../data/types';
import { ClubIcon, Icon, type IconName, matchesQuery } from './ui';

export interface PageLink {
  to: string;
  label: string;
  icon: IconName;
  keywords?: string;
}

interface Result {
  key: string;
  group: 'Pages' | 'Clubs' | 'Posts';
  label: string;
  sub?: string;
  to: string;
  icon?: IconName;
  clubId?: ID;
}

/** Ctrl+K / "/" search across pages, clubs and posts you can see. */
export function QuickSearch({ pages, userId, onClose }: { pages: PageLink[]; userId: ID; onClose: () => void }) {
  const db = useDB();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo<Result[]>(() => {
    const out: Result[] = [];
    for (const p of pages) {
      if (matchesQuery(q, p.label, p.keywords)) out.push({ key: 'p' + p.to, group: 'Pages', label: p.label, to: p.to, icon: p.icon });
    }
    const clubs = db.clubs
      .filter((c) => !c.archived || P.isAdmin(db, userId))
      .filter((c) => q && matchesQuery(q, c.name, c.category, c.advisor, c.description))
      .slice(0, 6);
    for (const c of clubs) {
      out.push({ key: 'c' + c.id, group: 'Clubs', label: c.name, sub: `${c.category} · ${c.advisor}`, to: `/clubs/${c.id}`, clubId: c.id });
      if (P.canManageClub(db, userId, c.id)) {
        out.push({ key: 'm' + c.id, group: 'Clubs', label: `Manage ${c.name}`, to: `/lead/${c.id}`, icon: 'star' });
      }
    }
    if (q.trim().length >= 2) {
      const posts = db.posts
        .filter((p) => P.canSeePost(db, userId, p) && !p.removed)
        .filter((p) => matchesQuery(q, p.title, p.body, clubById(db, p.clubId)?.name))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5);
      for (const p of posts) {
        out.push({ key: 'post' + p.id, group: 'Posts', label: p.title, sub: clubById(db, p.clubId)?.name, to: `/clubs/${p.clubId}`, clubId: p.clubId });
      }
    }
    return out;
  }, [q, db, pages, userId]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    nav(r.to);
  };

  let lastGroup = '';
  return (
    <div className="modal-backdrop qs-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="qs" role="dialog" aria-modal="true" aria-label="Search">
        <div className="qs-input">
          <Icon name="search" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages, clubs and posts"
            aria-label="Search"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                go(results[active]);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="qs-list" ref={listRef} role="listbox">
          {results.length === 0 && <div className="qs-empty">Nothing found for “{q}”.</div>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            const club = r.clubId ? clubById(db, r.clubId) : undefined;
            return (
              <div key={r.key}>
                {header && <div className="qs-group">{header}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={`qs-item${i === active ? ' on' : ''}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(r)}
                >
                  {club && r.group === 'Clubs' ? (
                    <ClubIcon club={club} />
                  ) : (
                    <span className="qs-icon">
                      <Icon name={r.icon ?? (r.group === 'Posts' ? 'megaphone' : 'grid')} size={16} />
                    </span>
                  )}
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="qs-label">{r.label}</span>
                    {r.sub && <span className="qs-sub">{r.sub}</span>}
                  </span>
                  {i === active && <span className="qs-enter">↵</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
