import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ClubBanner } from '../components/ClubBanner';
import { useMe } from '../components/Layout';
import {
  Avatar,
  Empty,
  Icon,
  matchesQuery,
  Meter,
  NoMatches,
  pct,
  personFields,
  rateTone,
  SearchBox,
  Segmented,
} from '../components/ui';
import { formatDate, slotLabel, todayISO } from '../data/dates';
import * as P from '../data/permissions';
import { clubById, rsvpSummary, scheduleForClubs } from '../data/selectors';
import { change, clubStats, type MeetingPoint, type StatsRange } from '../data/stats';
import { useDB } from '../data/store';
import type { Club } from '../data/types';

type RangeId = '30' | '90' | 'all';

/** /stats and /stats/:clubId: how many people are showing up to a club's meetings. */
export function Stats() {
  const { clubId } = useParams();
  const db = useDB();
  const me = useMe();
  const nav = useNavigate();
  const admin = P.isAdmin(db, me.id);
  const clubs = admin ? db.clubs.filter((c) => !c.archived) : P.clubsLedBy(db, me.id);
  const [rangeId, setRangeId] = useState<RangeId>('30');
  const range: StatsRange = rangeId === 'all' ? 'all' : (Number(rangeId) as 30 | 90);

  if (!clubId) {
    if (clubs.length > 0) return <Navigate to={`/stats/${clubs[0].id}`} replace />;
    return (
      <div className="card">
        <Empty title="Stats are for club leaders">
          Once an administrator verifies you as a leader, you'll see how many people come to your meetings here.{' '}
          <Link to="/my-clubs">Request leader access</Link>
        </Empty>
      </div>
    );
  }

  const club = clubById(db, clubId);
  if (!club || !P.canSeeAttendance(db, me.id, club.id)) {
    return (
      <div className="card">
        <Empty title="Leaders only">
          Only this club's leaders and school administrators can see its attendance.
        </Empty>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <ClubBanner
        club={club}
        eyebrow="Attendance stats"
        actions={
          <>
            {clubs.length > 1 && (
              <select
                className="input"
                style={{ width: 'auto' }}
                value={club.id}
                onChange={(e) => nav(`/stats/${e.target.value}`)}
                aria-label="Club"
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <Link to={`/lead/${club.id}?tab=attendance`} className="btn">
              Take attendance
            </Link>
          </>
        }
      />

      <div className="row-between">
        <Segmented<RangeId>
          value={rangeId}
          onChange={setRangeId}
          options={[
            { id: '30', label: 'Last 30 days' },
            { id: '90', label: 'Last 90 days' },
            { id: 'all', label: 'All time' },
          ]}
        />
        <span className="muted tiny">Only this club's leaders and administrators can see this page.</span>
      </div>

      <StatsBody club={club} range={range} />
    </div>
  );
}

function StatsBody({ club, range }: { club: Club; range: StatsRange }) {
  const db = useDB();
  const s = clubStats(db, club.id, range);
  const vs = range === 'all' ? '' : `vs previous ${range} days`;

  if (s.current.meetings === 0) {
    return (
      <div className="card">
        <Empty title="No attendance recorded in this period">
          Take attendance at your next meeting and the numbers show up here.
        </Empty>
      </div>
    );
  }

  const ft = s.followThrough;
  return (
    <>
      <div className="stats">
        <StatTile
          label="People per meeting"
          value={s.current.avgPeople.toFixed(1)}
          delta={change(s.current.avgPeople, s.previous?.avgPeople)}
          vs={vs}
          sub="members + guests, on average"
        />
        <StatTile
          label="Members showing up"
          value={pct(s.current.avgRate)}
          delta={change(s.current.avgRate, s.previous?.avgRate)}
          vs={vs}
          sub="of active members, on average"
        />
        <StatTile
          label="Meetings recorded"
          value={String(s.current.meetings)}
          sub={s.best ? `Biggest: ${s.best.members + s.best.guests} people on ${formatDate(s.best.date)}` : undefined}
        />
        <StatTile
          label="Said they'd come and did"
          value={ft.said ? pct(ft.came / ft.said) : '–'}
          sub={ft.said ? `${ft.came} of ${ft.said} “going” RSVPs` : 'No RSVPs for past meetings yet'}
        />
      </div>

      <NextMeetingForecast club={club} />

      <div className="card stack">
        <div className="row-between">
          <div>
            <h3 style={{ margin: 0 }}>Members at each meeting</h3>
            <p className="muted small">Line shows how many members the club had at the time.</p>
          </div>
        </div>
        <TurnoutChart points={s.points} />
      </div>

      <div className="two-col">
        <MemberTable records={s.members} />
        <aside className="stack">
          {s.byWeekday.length > 1 && (
            <div className="card stack" style={{ gap: 10 }}>
              <div>
                <h3 style={{ margin: 0 }}>Best days</h3>
                <p className="muted small">Average people per meeting</p>
              </div>
              <WeekdayBars rows={s.byWeekday} />
            </div>
          )}
          <Tips stats={s} />
        </aside>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- figures

function StatTile({
  label,
  value,
  delta,
  vs,
  sub,
}: {
  label: string;
  value: string;
  delta?: number | null;
  vs?: string;
  sub?: string;
}) {
  const up = (delta ?? 0) > 0;
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta !== undefined && delta !== null && Math.abs(delta) >= 0.005 && (
        <div className={`delta ${up ? 'up' : 'down'}`}>
          <span aria-hidden="true">{up ? '▲' : '▼'}</span> {Math.abs(Math.round(delta * 100))}%{' '}
          <span className="muted">{vs}</span>
        </div>
      )}
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function NextMeetingForecast({ club }: { club: Club }) {
  const db = useDB();
  const next = scheduleForClubs(db, [club.id], todayISO(), 14).find((x) => x.status !== 'cancelled');
  if (!next) return null;
  const r = rsvpSummary(db, club.id, next.date, next.slot);
  return (
    <div className="callout forecast">
      <Icon name="calendar" />
      <span>
        <strong>Next meeting:</strong> {formatDate(next.date, { weekday: 'long' })}, {slotLabel(next.slot)}.{' '}
        {r.going.length + r.maybe.length > 0 ? (
          <>
            {r.going.length} going{r.maybe.length > 0 && `, ${r.maybe.length} maybe`}
            {r.notGoing.length > 0 && `, ${r.notGoing.length} can't make it`}.
          </>
        ) : (
          'No RSVPs yet.'
        )}
      </span>
      <span className="spacer" />
      <Link to={`/lead/${club.id}?tab=schedule`} className="small nowrap">
        See who's coming
      </Link>
    </div>
  );
}

/** Track a container's width so the SVG can be drawn at real pixel size (crisp text). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || 640);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(n: number) {
  if (n <= 5) return 5;
  if (n <= 10) return 10;
  return Math.ceil(n / 5) * 5;
}

/** Column chart: one bar per meeting (members present), roster size as a reference line. */
function TurnoutChart({ points }: { points: MeetingPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  useEffect(() => setHover(null), [points]);

  const H = 220;
  const pad = { top: 18, right: 12, bottom: 26, left: 30 };
  const innerW = Math.max(100, width - pad.left - pad.right);
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(...points.map((p) => Math.max(p.members, p.roster)), 1));
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const band = innerW / points.length;
  const barW = Math.max(3, Math.min(24, band - 2)); // cap 24px, keep a 2px gap
  const ticks = [0, max / 2, max];
  // Label a handful of dates along the bottom.
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 70))));
  const last = points.length - 1;

  const bar = (x: number, top: number, w: number) => {
    const h = pad.top + innerH - top;
    const r = Math.min(4, w / 2, h);
    return `M${x},${pad.top + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${pad.top + innerH} Z`;
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="stack" style={{ gap: 8 }}>
      {asTable && (
        <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Members</th>
                <th className="num">Guests</th>
                <th className="num">Of</th>
                <th className="num">Rate</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.date}>
                  <td>{formatDate(p.date)}</td>
                  <td className="num">{p.members}</td>
                  <td className="num">{p.guests}</td>
                  <td className="num">{p.roster}</td>
                  <td className="num">{pct(p.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {
        <div
          ref={ref}
          className="chart"
          style={asTable ? { display: 'none' } : undefined}
          onMouseLeave={() => setHover(null)}
        >
          <svg width={width} height={H} role="img" aria-label="Members present at each meeting">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} className="grid" />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="axis">
                  {t}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const x = pad.left + i * band + (band - barW) / 2;
              return (
                <g key={p.date}>
                  {p.members > 0 && (
                    <path d={bar(x, y(p.members), barW)} className={`bar${hover === i ? ' on' : ''}`} />
                  )}
                  {i % every === 0 && (
                    <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="axis">
                      {formatDate(p.date, { weekday: undefined })}
                    </text>
                  )}
                  {/* Hit target: the whole column, wider than the bar. */}
                  <rect
                    x={pad.left + i * band}
                    y={pad.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    tabIndex={0}
                    aria-label={`${formatDate(p.date)}: ${p.members} of ${p.roster} members, ${p.guests} guests`}
                  />
                </g>
              );
            })}
            {/* Roster size: a step line across the chart. */}
            <path
              className="ref-line"
              d={points
                .map((p, i) => `${i === 0 ? 'M' : 'L'}${pad.left + i * band},${y(p.roster)} H${pad.left + (i + 1) * band}`)
                .join(' ')}
            />
            <text x={pad.left + innerW} y={y(points[last].roster) - 6} textAnchor="end" className="axis">
              {points[last].roster} members
            </text>
            {/* Label only the latest meeting. */}
            {hover === null && points[last].members > 0 && (
              <text
                x={pad.left + last * band + band / 2}
                y={y(points[last].members) - 6}
                textAnchor="middle"
                className="value-label"
              >
                {points[last].members}
              </text>
            )}
          </svg>
          {hp && hover !== null && (
            <div
              className="chart-tip"
              style={{
                left: Math.min(Math.max(pad.left + hover * band + band / 2, 80), width - 80),
                top: Math.max(0, y(hp.members) - 70),
              }}
            >
              <div className="strong">{formatDate(hp.date, { weekday: 'long' })}</div>
              <div>
                {hp.members} of {hp.roster} members ({pct(hp.rate)})
              </div>
              {hp.guests > 0 && <div className="muted">+ {hp.guests} guest{hp.guests === 1 ? '' : 's'}</div>}
            </div>
          )}
        </div>
      }
      <div>
        <button type="button" className="linklike small" onClick={() => setAsTable(!asTable)}>
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>
    </div>
  );
}

function WeekdayBars({ rows }: { rows: { day: string; avgPeople: number; meetings: number }[] }) {
  const max = Math.max(...rows.map((r) => r.avgPeople), 1);
  const top = rows.reduce((a, b) => (b.avgPeople > a.avgPeople ? b : a));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div key={r.day} className="hbar-row" title={`${r.meetings} meeting${r.meetings === 1 ? '' : 's'}`}>
          <span className="hbar-label">{r.day.slice(0, 3)}</span>
          <span className="hbar-track">
            <span className={`hbar${r === top ? ' top' : ''}`} style={{ width: `${(r.avgPeople / max) * 100}%` }} />
          </span>
          <span className="hbar-value">{r.avgPeople.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- members

type MemberFilter = 'all' | 'check-in';

function MemberTable({ records }: { records: ReturnType<typeof clubStats>['members'] }) {
  const [q, setQ] = useState('');
  const [show, setShow] = useState<MemberFilter>('all');
  const needCheckIn = records.filter((r) => r.missedInARow >= 3);
  const rows = records
    .filter((r) => show === 'all' || r.missedInARow >= 3)
    .filter((r) => matchesQuery(q, ...personFields(r.user)));

  return (
    <div className="card card-flush">
      <div className="card-section stack" style={{ gap: 10 }}>
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Members</h3>
          <Segmented<MemberFilter>
            value={show}
            onChange={setShow}
            options={[
              { id: 'all', label: `Everyone ${records.length}` },
              { id: 'check-in', label: `Missed 3+ in a row ${needCheckIn.length}` },
            ]}
          />
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Search members" count={rows.length} />
      </div>
      {rows.length === 0 ? (
        q ? (
          <NoMatches query={q} onClear={() => setQ('')} />
        ) : (
          <div className="card-section muted small">Nobody has missed 3 meetings in a row. Nice.</div>
        )
      ) : (
        rows.map((r) => (
          <div key={r.user.id} className="list-item">
            <Avatar user={r.user} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="strong small">{r.user.name}</div>
              <div className="tiny muted">
                {r.total ? `Came to ${r.present} of ${r.total}` : 'No meetings yet'}
                {r.lastPresent && ` · last came ${formatDate(r.lastPresent)}`}
              </div>
              {r.missedInARow >= 3 && (
                <span className="flag" title="Might be worth checking in with them" style={{ marginTop: 4 }}>
                  <Icon name="alert" size={13} />
                  Missed the last {r.missedInARow} meetings
                </span>
              )}
            </div>
            <div style={{ width: 90 }} className="hide-mobile">
              <Meter value={r.rate} tone={rateTone(r.rate)} />
            </div>
            <span className="small strong" style={{ width: 40, textAlign: 'right' }}>
              {r.total ? pct(r.rate) : '–'}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function Tips({ stats }: { stats: ReturnType<typeof clubStats> }) {
  const tips: string[] = [];
  const d = change(stats.current.avgRate, stats.previous?.avgRate);
  if (d !== null && d <= -0.1) tips.push('Turnout is down. A reminder announcement the day before often helps.');
  if (d !== null && d >= 0.1) tips.push('Turnout is up. Whatever you changed recently is working.');
  const slipping = stats.members.filter((m) => m.missedInARow >= 3).length;
  if (slipping) tips.push(`${slipping} member${slipping === 1 ? ' has' : 's have'} missed 3+ meetings in a row. A quick message might bring them back.`);
  if (stats.byWeekday.length > 1) {
    const best = stats.byWeekday.reduce((a, b) => (b.avgPeople > a.avgPeople ? b : a));
    tips.push(`${best.day}s get the most people.`);
  }
  if (tips.length === 0) return null;
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <h3 style={{ margin: 0 }}>What stands out</h3>
      <ul className="tips">
        {tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
