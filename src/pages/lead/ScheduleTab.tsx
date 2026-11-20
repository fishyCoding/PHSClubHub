import { useState } from 'react';
import { MeetingsEditor } from '../../components/MeetingsEditor';
import { WhosComing } from './WhosComing';
import { ConfirmButton, Segmented, useToast } from '../../components/ui';
import * as A from '../../data/actions';
import { addDays, describeMeeting, formatDate, slotLabel, slotTitle, todayISO, weekdayOf } from '../../data/dates';
import { upcomingEvents } from '../../data/selectors';
import { useDB } from '../../data/store';
import { slotsOn, type Club, type EventKind, type MeetingTime, type Slot } from '../../data/types';

/** Next date (from today) that has one of this club's regular meetings. */
function nextMeetingDate(club: Club): { date: string; meeting?: MeetingTime } {
  const today = todayISO();
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, i);
    const wd = weekdayOf(d);
    const m = club.meetings.find((x) => x.day === wd);
    if (m) return { date: d, meeting: m };
  }
  return { date: today };
}

export function ScheduleTab({ club }: { club: Club }) {
  const db = useDB();
  const { run } = useToast();
  const [meetings, setMeetings] = useState<MeetingTime[]>(club.meetings);
  const dirty = JSON.stringify(meetings) !== JSON.stringify(club.meetings);

  const next = nextMeetingDate(club);
  const [kind, setKind] = useState<EventKind>('cancelled');
  const [date, setDate] = useState(next.date);
  const [slot, setSlot] = useState<Slot>(next.meeting?.slot ?? 'lunch');
  const [room, setRoom] = useState(next.meeting?.room ?? '');
  const [title, setTitle] = useState('');
  const [announce, setAnnounce] = useState(true);
  const events = upcomingEvents(db, club.id);

  return (
    <div className="stack-lg">
      <WhosComing club={club} />
      <div className="card stack">
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Regular meetings</h3>
          <span className="muted small">{club.meetings.map(describeMeeting).join(' · ')}</span>
        </div>
        <MeetingsEditor value={meetings} onChange={setMeetings} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {dirty && (
            <button className="btn" onClick={() => setMeetings(club.meetings)}>
              Discard
            </button>
          )}
          <button
            className="btn btn-primary"
            disabled={!dirty}
            onClick={() =>
              run(() => A.updateClubBasics(club.id, { description: club.description, meetings }), 'Meeting times saved')
            }
          >
            Save meeting times
          </button>
        </div>
      </div>

      <div className="two-col">
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (run(() => A.createEvent(club.id, { kind, date, slot, room, title, announce }), 'Schedule updated')) {
              setTitle('');
            }
          }}
        >
          <h3 style={{ margin: 0 }}>One-time change</h3>
          <Segmented<EventKind>
            value={kind}
            onChange={setKind}
            options={[
              { id: 'cancelled', label: 'Cancel a meeting' },
              { id: 'moved', label: 'Change room' },
              { id: 'event', label: 'Add extra meeting' },
            ]}
          />
          <div className="form-grid">
            <label className="field">
              <span>Date</span>
              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  const ok = slotsOn(weekdayOf(e.target.value));
                  if (!ok.includes(slot)) setSlot('lunch');
                }}
              />
            </label>
            <label className="field">
              <span>Time</span>
              <select className="input" value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
                {slotsOn(weekdayOf(date)).map((s) => (
                  <option key={s} value={s}>
                    {slotTitle(s)}
                  </option>
                ))}
              </select>
            </label>
            {kind !== 'cancelled' && (
              <label className="field">
                <span>{kind === 'moved' ? 'New room' : 'Room'}</span>
                <input className="input" value={room} onChange={(e) => setRoom(e.target.value)} />
              </label>
            )}
          </div>
          <label className="field">
            <span>
              {kind === 'cancelled' ? 'Reason' : 'Description'} <span className="hint">(optional)</span>
            </span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === 'cancelled' ? 'Teacher conference day' : kind === 'moved' ? 'Bio lab is booked' : 'Saturday build session'}
            />
          </label>
          {date && kind !== 'event' && !club.meetings.some((m) => m.day === weekdayOf(date) && m.slot === slot) && (
            <div className="callout warn small">
              {club.name} does not normally meet {weekdayOf(date) ?? 'on weekends'} {slotLabel(slot)}.
            </div>
          )}
          <div className="row-between">
            <label className="check small">
              <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />
              Also post an update to followers and members
            </label>
            <button className="btn btn-primary" type="submit">
              Save change
            </button>
          </div>
        </form>

        <div className="card card-flush">
          <div className="card-section">
            <h3 style={{ margin: 0 }}>Upcoming changes</h3>
          </div>
          {events.length === 0 ? (
            <div className="card-section muted small">None scheduled.</div>
          ) : (
            events.map((e) => (
              <div key={e.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className={`badge ${e.kind === 'cancelled' ? 'danger' : e.kind === 'moved' ? 'warn' : 'info'}`}>
                      {e.kind === 'cancelled' ? 'Cancelled' : e.kind === 'moved' ? 'Moved' : 'Extra'}
                    </span>
                    <span className="strong small">{formatDate(e.date)}</span>
                  </div>
                  <div className="tiny muted">
                    {slotLabel(e.slot)} · {e.room} · {e.title}
                  </div>
                </div>
                <ConfirmButton
                  className="btn btn-ghost btn-sm btn-danger"
                  label="Undo"
                  title="Remove this change?"
                  message="The regular schedule will apply again for that day. Any update already sent stays in the feed."
                  confirmLabel="Remove"
                  onConfirm={() => run(() => A.deleteEvent(e.id), 'Change removed')}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
