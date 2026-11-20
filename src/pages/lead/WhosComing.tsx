import { useState } from 'react';
import { RSVP_LABEL } from '../../components/Rsvp';
import { Avatar } from '../../components/ui';
import { formatDate, slotLabel, todayISO } from '../../data/dates';
import { activeMembers, rsvpSummary, scheduleForClubs, userById } from '../../data/selectors';
import { useDB } from '../../data/store';
import type { Club, ID, RsvpStatus } from '../../data/types';

/** Leader view: RSVPs for the club's next few meetings. */
export function WhosComing({ club }: { club: Club }) {
  const db = useDB();
  const today = todayISO();
  const meetings = scheduleForClubs(db, [club.id], today, 14)
    .filter((s) => s.status !== 'cancelled')
    .slice(0, 4);
  const [open, setOpen] = useState(0);
  const members = activeMembers(db, club.id).map((m) => m.userId);

  return (
    <div className="card card-flush">
      <div className="card-section row-between">
        <h3 style={{ margin: 0 }}>Who's coming</h3>
        <span className="muted tiny">RSVPs from members and followers</span>
      </div>
      {meetings.length === 0 && <div className="card-section muted small">No meetings in the next two weeks.</div>}
      {meetings.map((m, i) => {
        const s = rsvpSummary(db, club.id, m.date, m.slot);
        const answered = new Set([...s.going, ...s.maybe, ...s.notGoing]);
        const noAnswer = members.filter((id) => !answered.has(id));
        const isOpen = open === i;
        return (
          <div key={i} className="whos-coming">
            <button type="button" className="whos-head" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen}>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span className="strong small">
                  {m.date === today ? 'Today' : formatDate(m.date)} · {slotLabel(m.slot)}
                </span>
                {m.status === 'extra' && m.title && <span className="tiny muted"> · {m.title}</span>}
              </span>
              <span className="rsvp-tally going">{s.going.length} going</span>
              <span className="rsvp-tally maybe">{s.maybe.length} maybe</span>
              <span className="rsvp-tally not_going">{s.notGoing.length} can't</span>
              <span className="muted" aria-hidden="true">
                {isOpen ? '▾' : '▸'}
              </span>
            </button>
            {isOpen && (
              <div className="whos-body">
                <NameGroup status="going" ids={s.going} />
                <NameGroup status="maybe" ids={s.maybe} />
                <NameGroup status="not_going" ids={s.notGoing} />
                {noAnswer.length > 0 && (
                  <div className="tiny muted">
                    No answer yet from {noAnswer.length} member{noAnswer.length === 1 ? '' : 's'}:{' '}
                    {noAnswer.map((id) => userById(db, id)?.name.split(' ')[0]).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NameGroup({ status, ids }: { status: RsvpStatus; ids: ID[] }) {
  const db = useDB();
  if (ids.length === 0) return null;
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className={`tiny strong rsvp-tally ${status}`}>{RSVP_LABEL[status]}</div>
      <div className="row" style={{ gap: 6 }}>
        {ids.map((id) => {
          const u = userById(db, id);
          return u ? (
            <span key={id} className="person-chip">
              <Avatar user={u} />
              {u.name}
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
}
