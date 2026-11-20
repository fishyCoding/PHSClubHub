import { useEffect, useState } from 'react';
import { Avatar, ConfirmButton, Empty, Meter, pct, rateTone, useToast } from '../../components/ui';
import * as A from '../../data/actions';
import { formatDate, todayISO, weekdayOf } from '../../data/dates';
import * as P from '../../data/permissions';
import { activeMembers, attendanceFor, attendanceStats, memberAttendance, userById } from '../../data/selectors';
import { useDB } from '../../data/store';
import type { Club, ID } from '../../data/types';
import { useMe } from '../../components/Layout';

export function AttendanceTab({ club }: { club: Club }) {
  const db = useDB();
  const me = useMe();
  const { run } = useToast();
  const [date, setDate] = useState(todayISO());
  const sessions = attendanceFor(db, club.id);
  const existing = sessions.find((s) => s.date === date);
  const roster = activeMembers(db, club.id)
    .map((m) => userById(db, m.userId)!)
    .sort((a, b) => a.name.localeCompare(b.name));

  const [present, setPresent] = useState<ID[]>(existing?.presentUserIds ?? []);
  const [guests, setGuests] = useState(existing?.guestCount ?? 0);
  // Load the saved roll whenever the date changes.
  useEffect(() => {
    const s = attendanceFor(db, club.id).find((x) => x.date === date);
    setPresent(s?.presentUserIds ?? []);
    setGuests(s?.guestCount ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, club.id]);

  if (!P.canSeeAttendance(db, me.id, club.id)) return null;

  const stats = attendanceStats(db, club.id);
  const wd = weekdayOf(date);
  const normalDay = club.meetings.some((m) => m.day === wd);
  const toggle = (id: ID) => setPresent(present.includes(id) ? present.filter((x) => x !== id) : [...present, id]);

  return (
    <div className="stack-lg">
      <div className="callout small">
        Attendance is visible only to this club’s leaders and school administrators. It is used to evaluate club
        activity, not to grade students.
      </div>

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

      <div className="card stack">
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Take attendance</h3>
          <div className="row">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto' }} />
            {existing && <span className="badge ok">Saved · editing</span>}
          </div>
        </div>
        {!normalDay && (
          <div className="callout warn small">
            {club.name} does not normally meet on {wd ? wd + 's' : 'weekends'}. You can still record attendance for an
            extra meeting.
          </div>
        )}
        {roster.length === 0 ? (
          <Empty title="No members yet" />
        ) : (
          <>
            <div className="row-between small">
              <span className="muted">
                {present.length} of {roster.length} present
              </span>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setPresent(roster.map((u) => u.id))}>
                  Mark all present
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setPresent([])}>
                  Clear
                </button>
              </div>
            </div>
            <div className="roll">
              {roster.map((u) => {
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
                    <span className="small strong">{u.name}</span>
                    <span className="tick">✓</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        <div className="row-between">
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
          <button
            className="btn btn-primary"
            onClick={() => run(() => A.saveAttendance(club.id, date, present, guests), `Attendance saved for ${formatDate(date)}`)}
          >
            {existing ? 'Update attendance' : 'Save attendance'}
          </button>
        </div>
      </div>

      <div className="two-col">
        <AttendanceHistory club={club} onPick={setDate} />
        <MemberRates club={club} />
      </div>
    </div>
  );
}

export function AttendanceHistory({ club, onPick }: { club: Club; onPick?: (date: string) => void }) {
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
                    <td className="nowrap">{formatDate(s.date)}</td>
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
                          <button className="btn btn-ghost btn-sm" onClick={() => onPick(s.date)}>
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
