import type { CSSProperties, ReactNode } from 'react';
import type { Club } from '../data/types';
import { ClubIcon, clubColor } from './ui';

/** Coloured header used on every club-specific page (club page, manage, stats). */
export function ClubBanner({
  club,
  eyebrow,
  badges,
  meta,
  actions,
  children,
}: {
  club: Club;
  eyebrow?: string;
  badges?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Optional white area under the coloured band (e.g. the description). */
  children?: ReactNode;
}) {
  return (
    <section className="club-banner" style={{ '--club': clubColor(club) } as CSSProperties}>
      <div className="club-banner-top">
        <ClubIcon club={club} size="lg" />
        <div className="cb-text">
          {eyebrow && <div className="cb-eyebrow">{eyebrow}</div>}
          <div className="cb-title">
            <h1>{club.name}</h1>
            {badges}
          </div>
          {meta && <div className="cb-meta">{meta}</div>}
        </div>
        {actions && <div className="cb-actions">{actions}</div>}
      </div>
      {children && <div className="club-banner-body">{children}</div>}
    </section>
  );
}
