import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClubIcon, Meter, Modal, pct, rateTone, Sparkline } from '../../components/ui';
import { formatDate } from '../../data/dates';
import { attendanceStats, clubById, type ClubAttendanceStats } from '../../data/selectors';
import { useDB } from '../../data/store';
import { AttendanceHistory, MemberRates } from '../lead/AttendanceTab';

type SortKey = 'name' | 'rate' | 'avg' | 'recent' | 'members';

export function AdminAttendance() {
  const db = useDB();
  const [sort, setSort] = useState<SortKey>('rate');
  const [open, setOpen] = useState<string | null>(null);
  const rows = db.clubs
    .filter((c) => !c.archived)
    .map((c) => ({ c, s: attendanceStats(db, c.id) }));

  const sorters: Record<SortKey, (a: { c: { name: string }; s: ClubAttendanceStats }, b: typeof a) => number> = {
    name: (a, b) => a.c.name.localeCompare(b.c.name),
    rate: (a, b) => b.s.avgRate - a.s.avgRate,
    avg: (a, b) => b.s.avgPresent - a.s.avgPresent,
    recent: (a, b) => b.s.sessionsLast30 - a.s.sessionsLast30,
    members: (a, b) => b.s.activeMembers - a.s.activeMembers,
  };
  rows.sort(sorters[sort]);

  const Th = ({ k, children, num }: { k: SortKey; children: React.ReactNode; num?: boolean }) => (
    <th className={num ? 'num' : ''}>
      <button
        className="btn btn-ghost btn-sm"
        style={{ padding: 0, fontSize: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', color: sort === k ? 'var(--accent)' : 'inherit' }}
        onClick={() => setSort(k)}
      >
        {children}
        {sort === k && ' ↓'}
      </button>
    </th>
  );

  const openClub = open ? clubById(db, open) : undefined;

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Attendance</h1>
          <p>
            Recorded by club leaders and used to evaluate club activity. Only leaders and administrators can see it.
          </p>
        </div>
      </div>
      <div className="card card-flush table-wrap">
        <table className="table">
          <thead>
            <tr>
              <Th k="name">Club</Th>
              <Th k="members" num>
                Members
              </Th>
              <Th k="recent" num>
                Meetings (30d)
              </Th>
              <Th k="avg" num>
                Avg. present
              </Th>
              <Th k="rate">Avg. rate</Th>
              <th>Trend</th>
              <th>Last recorded</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, s }) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(c.id)}>
                <td>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <ClubIcon club={c} />
                    <Link to={`/stats/${c.id}`} className="strong text" title="Open attendance stats">
                      {c.name}
                    </Link>
                  </div>
                </td>
                <td className="num">{s.activeMembers}</td>
                <td className="num">
                  {s.sessionsLast30 === 0 ? <span className="badge danger">0</span> : s.sessionsLast30}
                </td>
                <td className="num">{s.sessions ? s.avgPresent.toFixed(1) : '–'}</td>
                <td style={{ minWidth: 120 }}>
                  {s.sessions ? (
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <Meter value={s.avgRate} tone={rateTone(s.avgRate)} />
                      <span className="tiny">{pct(s.avgRate)}</span>
                    </div>
                  ) : (
                    <span className="muted tiny">No records</span>
                  )}
                </td>
                <td>
                  <Sparkline values={s.trend} />
                </td>
                <td className="small nowrap">
                  {s.lastSession ? formatDate(s.lastSession) : <span className="muted">Never</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Click a club to see each meeting and per-member attendance.</p>

      {openClub && (
        <Modal title={`${openClub.name} attendance`} onClose={() => setOpen(null)}>
          <div className="row">
            <Link to={`/stats/${openClub.id}`} className="btn btn-sm btn-primary">
              Full attendance stats
            </Link>
            <Link to={`/lead/${openClub.id}`} className="small">
              Open club management
            </Link>
          </div>
          <AttendanceHistory club={openClub} />
          <MemberRates club={openClub} />
        </Modal>
      )}
    </div>
  );
}
