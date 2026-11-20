import { useState } from 'react';
import {
  Avatar,
  ConfirmButton,
  Empty,
  Icon,
  matchesQuery,
  Meter,
  NoMatches,
  pct,
  personFields,
  rateTone,
  SearchBox,
  useToast,
} from '../../components/ui';
import * as A from '../../data/actions';
import { addDays, formatDate, slotLabel, slotTitle, todayISO, weekdayOf } from '../../data/dates';
import { sameSession } from '../../data/actions';
import * as P from '../../data/permissions';
import {
  activeMembers,
  attendanceFor,
  attendanceStats,
  memberAttendance,
  scheduleForClubs,
  userById,
} from '../../data/selectors';
import { RSVP_LABEL } from '../../components/Rsvp';
import type { RsvpStatus } from '../../data/types';
import { useDB } from '../../data/store';
import { slotsOn, type Club, type ID, type Slot } from '../../data/types';
import { useMe } from '../../components/Layout';

interface Picked {
  date: string;
  slot?: Slot;
  /** True for meetings that aren't on the schedule (extra / makeup). */
  extra?: boolean;
}

export function AttendanceTab({ club }: { club: Club }) {
  const db = useDB();
  const me = useMe();
  const [picked, setPicked] = useState<Picked | null>(null);

  if (!P.canSeeAttendance(db, me.id, club.id)) return null;
  const stats = attendanceStats(db, club.id);

  return (
    <div className="stack-lg">
      {picked ? (
        <TakeRoll club={club} picked={picked} onDone={() => setPicked(null)} />
      ) : (
        <PickSession club={club} onPick={setPicked} />
      )}

      <div className="stats">
        <div className="stat">
          <div className="label">Avg. attendance</div>
          <div className="value">{stats.sessions ? pct(stats.avgRate) : '–'}</div>
          <div className="sub">of active members</div>
        </div>
        <div className="stat">
          <div className="label">Avg. people per meeting</div>
          <div className="value">{stats.sessions ? stats.avgPresent.toFixed(1) : '–'}</div>
          <div className="sub">incl. guests</div>
        </div>
        <div className="stat">
          <div className="label">Meetings recorded</div>
          <div className="value">{stats.sessions}</div>
          <div className="sub">{stats.sessionsLast30} in the last 30 days</div>
        </div>
        <div className="stat">
          <div className="label">Active members</div>
          <div className="value">{stats.activeMembers}</div>
        </div>
      </div>

      <div className="two-col">
        <AttendanceHistory club={club} onPick={(date, slot) => setPicked({ date, slot })} />
        <MemberRates club={club} />
      </div>
      <p className="muted tiny">
        Attendance is visible only to this club's leaders and school administrators. Each member is told whether they
        were marked present or absent.
      </p>
    </div>
  );
}

/** Recent meetings (past two weeks + today) that attendance can be taken for. */
export function recentSessions(db: ReturnType<typeof useDB>, clubId: ID) {
  const today = todayISO();
  return scheduleForClubs(db, [clubId], addDays(today, -14), 15)
    .filter((s) => s.status !== 'cancelled' && s.date <= today)
    .reverse()
    .map((s) => ({ ...s, record: db.attendance.find((a) => sameSession(a, clubId, s.date, s.slot)) }));
}

/** Step 1: choose which meeting you're taking attendance for. */
function PickSession({ club, onPick }: { club: Club; onPick: (p: Picked) => void }) {
  const db = useDB();
  const today = todayISO();
  const sessions = recentSessions(db, club.id);
  const [other, setOther] = useState(false);
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<Slot>(club.meetings[0]?.slot ?? 'after school');
  const todo = sessions.filter((s) => !s.record).length;

  return (
    <div className="card stack">
      <div className="row-between">
        <div>
          <div className="step-label">Step 1 of 2</div>
          <h3 style={{ margin: 0 }}>Which meeting are you taking attendance for?</h3>
        </div>
        {todo > 0 && (
          <span className="type-tag schedule">
            {todo} meeting{todo === 1 ? '' : 's'} still need{todo === 1 ? 's' : ''} attendance
          </span>
        )}
      </div>

      {sessions.length === 0 && (
        <p className="muted small">No scheduled meetings in the last two weeks. Use “Another date” for an extra meeting.</p>
      )}

      <div className="session-grid">
        {sessions.map((s) => {
          const r = s.record;
          return (
            <button
              key={s.date + s.slot}
              type="button"
              className={`session-btn${r ? ' done' : ' todo'}${s.date === today ? ' today' : ''}`}
              onClick={() => onPick({ date: s.date, slot: s.slot, extra: s.status === 'extra' })}
            >
              <span className="session-day">{s.date === today ? 'Today' : formatDate(s.date)}</span>
              <span className="session-slot">
                {slotTitle(s.slot)}
                {s.status === 'extra' && ' · extra'}
              </span>
              <span className="session-status">
                {r ? (
                  <>
                    <Icon name="check" size={13} /> Taken · {r.presentUserIds.length}/{r.rosterUserIds.length} here
                  </>
                ) : (
                  <>
                    <Icon name="clock" size={13} /> Not taken yet
                  </>
                )}
              </span>
              <span className="session-cta">{r ? 'Edit' : 'Take attendance'} →</span>
            </button>
          );
        })}
        <button type="button" className="session-btn other" onClick={() => setOther(!other)} aria-expanded={other}>
          <span className="session-day">Another date</span>
          <span className="session-slot">Extra or makeup meeting</span>
          <span className="session-cta">{other ? 'Close' : 'Choose'} →</span>
        </button>
      </div>

      {other && (
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Time</span>
            <select className="input" value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
              {slotsOn(weekdayOf(date)).map((x) => (
                <option key={x} value={x}>
                  {slotTitle(x)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!date || date > today}
            onClick={() => onPick({ date, slot, extra: true })}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

/** Step 2: mark who's there, then save and notify. */
function TakeRoll({ club, picked, onDone }: { club: Club; picked: Picked; onDone: () => void }) {
  const db = useDB();
  const { run } = useToast();
  const { date, slot } = picked;
  const existing = db.attendance.find((a) => sameSession(a, club.id, date, slot));
  const roster = activeMembers(db, club.id)
    .map((m) => userById(db, m.userId)!)
    .sort((a, b) => a.name.localeCompare(b.name));
  const [present, setPresent] = useState<ID[]>(existing?.presentUserIds ?? []);
  const [guests, setGuests] = useState(existing?.guestCount ?? 0);
  const [q, setQ] = useState('');
  const shownRoster = roster.filter((u) => matchesQuery(q, ...personFields(u)));

  // What each member said ahead of time for this meeting.
  const said = new Map<ID, RsvpStatus>();
  for (const r of db.rsvps) {
    if (r.clubId === club.id && r.date === date && (!slot || r.slot === slot)) said.set(r.userId, r.status);
  }
  const saidGoing = roster.filter((u) => said.get(u.id) === 'going').map((u) => u.id);
  const toggle = (id: ID) => setPresent(present.includes(id) ? present.filter((x) => x !== id) : [...present, id]);
  const when = `${date === todayISO() ? 'Today' : formatDate(date, { weekday: 'long' })}${slot ? `, ${slotLabel(slot)}` : ''}`;
  const absent = roster.length - present.length;

  return (
    <div className="card stack roll-card">
      <div className="row-between">
        <div>
          <div className="step-label">Step 2 of 2</div>
          <h3 style={{ margin: 0 }}>Who's here? {when}</h3>
          {existing && (
            <div className="tiny muted">
              Saved before by {userById(db, existing.takenBy)?.name ?? 'a leader'}. Saving again updates it.
            </div>
          )}
        </div>
        <button type="button" className="btn btn-sm" onClick={onDone}>
          ← Pick a different meeting
        </button>
      </div>

      {roster.length === 0 ? (
        <Empty title="No members yet" />
      ) : (
        <>
          <div className="roll-summary">
            <span className="roll-count present">
              <strong>{present.length}</strong> present
            </span>
            <span className="roll-count absent">
              <strong>{absent}</strong> absent
            </span>
            <span className="spacer" />
            {saidGoing.length > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setPresent([...new Set([...present, ...saidGoing])])}
                title="Everyone who RSVP'd going"
              >
                Mark the {saidGoing.length} who said “going”
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={() => setPresent(roster.map((u) => u.id))}>
              Everyone's here
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPresent([])}>
              Clear
            </button>
          </div>

          <SearchBox value={q} onChange={setQ} placeholder="Find a student" count={shownRoster.length} />
          {shownRoster.length === 0 && <NoMatches query={q} onClear={() => setQ('')} />}
          <p className="tiny muted" style={{ margin: 0 }}>
            Tap a name to switch between present and absent. Everyone starts as absent.
          </p>
          <div className="roll">
            {shownRoster.map((u) => {
              const on = present.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  className={`roll-item${on ? ' on' : ''}`}
                  onClick={() => toggle(u.id)}
                  aria-pressed={on}
                >
                  <Avatar user={u} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="small strong" style={{ display: 'block' }}>
                      {u.name}
                    </span>
                    {said.has(u.id) && (
                      <span className="tiny muted">RSVP'd: {RSVP_LABEL[said.get(u.id)!]}</span>
                    )}
                  </span>
                  <span className={`roll-state ${on ? 'present' : 'absent'}`}>{on ? '✓ Present' : 'Absent'}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="row-between roll-footer">
        <label className="row small">
          Guests / non-members
          <input
            className="input"
            type="number"
            min={0}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value) || 0)}
            style={{ width: 80 }}
          />
        </label>
        <div className="row">
          <span className="tiny muted">
            <Icon name="inbox" size={13} /> Each member gets a notification
          </span>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (
                run(
                  () => A.saveAttendance(club.id, date, present, guests, slot),
                  `Saved. ${roster.length} member${roster.length === 1 ? '' : 's'} notified.`,
                )
              )
                onDone();
            }}
          >
            {existing ? 'Update & notify' : 'Save & notify'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AttendanceHistory({ club, onPick }: { club: Club; onPick?: (date: string, slot?: Slot) => void }) {
  const db = useDB();
  const { run } = useToast();
  const sessions = attendanceFor(db, club.id);
  return (
    <div className="card card-flush">
      <div className="card-section">
        <h3 style={{ margin: 0 }}>History</h3>
      </div>
      {sessions.length === 0 ? (
        <div className="card-section muted small">No attendance recorded yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Present</th>
                <th className="num">Guests</th>
                <th>Rate</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const rate = s.rosterUserIds.length ? s.presentUserIds.length / s.rosterUserIds.length : 0;
                return (
                  <tr key={s.id}>
                    <td className="nowrap">
                      {formatDate(s.date)}
                      {s.slot && <span className="tiny muted"> · {slotLabel(s.slot)}</span>}
                    </td>
                    <td className="num">
                      {s.presentUserIds.length}/{s.rosterUserIds.length}
                    </td>
                    <td className="num">{s.guestCount}</td>
                    <td style={{ minWidth: 100 }}>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <Meter value={rate} tone={rateTone(rate)} />
                        <span className="tiny muted">{pct(rate)}</span>
                      </div>
                    </td>
                    <td className="nowrap" style={{ textAlign: 'right' }}>
                      {onPick && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => onPick(s.date, s.slot)}>
                            Edit
                          </button>
                          <ConfirmButton
                            className="btn btn-ghost btn-sm btn-danger"
                            label="Delete"
                            title="Delete this attendance record?"
                            message={`The record for ${formatDate(s.date)} will be removed.`}
                            confirmLabel="Delete"
                            onConfirm={() => run(() => A.deleteAttendance(s.id), 'Record deleted')}
                          />
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function MemberRates({ club }: { club: Club }) {
  const db = useDB();
  const rows = activeMembers(db, club.id)
    .map((m) => ({ u: userById(db, m.userId)!, ...memberAttendance(db, club.id, m.userId) }))
    .sort((a, b) => (b.total ? b.present / b.total : 0) - (a.total ? a.present / a.total : 0));
  return (
    <div className="card card-flush">
      <div className="card-section">
        <h3 style={{ margin: 0 }}>By member</h3>
      </div>
      {rows.map(({ u, present, total }) => {
        const rate = total ? present / total : 0;
        return (
          <div key={u.id} className="list-item">
            <Avatar user={u} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="small strong">{u.name}</div>
              {total > 0 ? <Meter value={rate} tone={rateTone(rate)} /> : <span className="tiny muted">No records</span>}
            </div>
            <span className="tiny muted nowrap">{total ? `${present}/${total}` : ''}</span>
          </div>
        );
      })}
    </div>
  );
}
