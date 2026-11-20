import { useMe } from './Layout';
import { Icon, type IconName, useToast } from './ui';
import * as A from '../data/actions';
import { todayISO } from '../data/dates';
import * as P from '../data/permissions';
import { clubById, rsvpOf, rsvpSummary, userById } from '../data/selectors';
import { useDB } from '../data/store';
import type { ID, RsvpStatus, Slot } from '../data/types';

const OPTIONS: { id: RsvpStatus; label: string; short: string; icon: IconName; toast: string }[] = [
  { id: 'going', label: "I'm going", short: 'Going', icon: 'check', toast: 'See you there!' },
  { id: 'maybe', label: 'Maybe', short: 'Maybe', icon: 'help', toast: 'Marked as maybe' },
  { id: 'not_going', label: "Can't make it", short: "Can't go", icon: 'x', toast: "Got it, the leaders will know you can't make it" },
];

export const RSVP_LABEL: Record<RsvpStatus, string> = {
  going: 'Going',
  maybe: 'Maybe',
  not_going: "Can't make it",
};

interface MeetingRef {
  clubId: ID;
  date: string;
  slot: Slot;
  /** Hide the buttons for cancelled meetings. */
  cancelled?: boolean;
}

/**
 * "I'm going / Maybe / Can't make it" for one meeting.
 * Click your current answer again to clear it. Renders nothing if you can't RSVP.
 */
export function RsvpButtons({ clubId, date, slot, cancelled, compact }: MeetingRef & { compact?: boolean }) {
  const db = useDB();
  const me = useMe();
  const { run } = useToast();
  if (cancelled || date < todayISO() || !P.canRsvp(db, me.id, clubId)) return null;
  const mine = rsvpOf(db, me.id, clubId, date, slot);

  return (
    <div
      className={`rsvp${compact ? ' compact' : ''}`}
      role="group"
      aria-label="Are you coming?"
      onClick={(e) => {
        // Rows are often links; don't navigate when answering.
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {OPTIONS.map((o) => {
        const on = mine === o.id;
        return (
          <button
            key={o.id}
            type="button"
            className={`rsvp-btn ${o.id}${on ? ' on' : ''}`}
            aria-pressed={on}
            title={on ? 'Click again to clear your answer' : o.label}
            onClick={() => run(() => A.setRsvp(clubId, date, slot, on ? null : o.id), on ? 'RSVP cleared' : o.toast)}
          >
            <Icon name={o.icon} size={compact ? 13 : 15} />
            {compact ? o.short : o.label}
          </button>
        );
      })}
    </div>
  );
}

/** "5 going · 2 maybe". Names are shown on hover to people allowed to see members. */
export function RsvpCount({ clubId, date, slot }: MeetingRef) {
  const db = useDB();
  const me = useMe();
  const club = clubById(db, clubId);
  if (!club) return null;
  const s = rsvpSummary(db, clubId, date, slot);
  if (s.going.length + s.maybe.length === 0) return null;
  const names = P.canSeeMembers(db, me.id, club)
    ? s.going.map((id) => userById(db, id)?.name.split(' ')[0]).join(', ')
    : undefined;
  return (
    <span className="rsvp-count" title={names ? `Going: ${names}` : undefined}>
      <Icon name="users" size={13} />
      {s.going.length} going
      {s.maybe.length > 0 && ` · ${s.maybe.length} maybe`}
    </span>
  );
}
