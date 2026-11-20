import { useState } from 'react';
import { ClubCard } from '../components/ClubCard';
import { useMe } from '../components/Layout';
import { Empty } from '../components/ui';
import { myClubIds } from '../data/selectors';
import { useDB } from '../data/store';
import { slotTitle } from '../data/dates';
import { CATEGORIES, slotsOn, WEEKDAYS, type Category, type Slot, type Weekday } from '../data/types';

export function Explore() {
  const db = useDB();
  const me = useMe();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | null>(null);
  const [day, setDay] = useState<Weekday | ''>('');
  const [slot, setSlot] = useState<Slot | ''>('');

  const query = q.trim().toLowerCase();
  const clubs = db.clubs
    .filter((c) => !c.archived)
    .filter((c) => !cat || c.category === cat)
    .filter((c) => !day || c.meetings.some((m) => m.day === day))
    .filter((c) => !slot || c.meetings.some((m) => m.slot === slot && (!day || m.day === day)))
    .filter(
      (c) =>
        !query ||
        c.name.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.advisor.toLowerCase().includes(query),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const filtered = !!(q || cat || day || slot);

  // Suggestions: clubs you're not in yet, in categories you already like.
  const mine = myClubIds(db, me.id);
  const taken = new Set([...mine.joined, ...mine.pending, ...mine.following]);
  const likedCats = new Set([...taken].map((id) => db.clubs.find((c) => c.id === id)?.category));
  const suggested =
    me.role === 'student' && taken.size > 0
      ? db.clubs
          .filter((c) => !c.archived && !taken.has(c.id) && likedCats.has(c.category))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 3)
      : [];

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Explore clubs</h1>
          <p>
            Follow a club to get its updates. Join to become a member and also get private messages from its leaders.
          </p>
        </div>
      </div>

      <div className="stack">
        <div className="row">
          <label className="search">
            <input
              className="input"
              placeholder="Search clubs, topics, advisors"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search clubs"
            />
          </label>
          <select className="input" style={{ width: 'auto' }} value={day} onChange={(e) => {
            const d = e.target.value as Weekday | '';
            setDay(d);
            if (slot && !slotsOn(d || null).includes(slot)) setSlot('');
          }} aria-label="Day">
            <option value="">Any day</option>
            {WEEKDAYS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select className="input" style={{ width: 'auto' }} value={slot} onChange={(e) => setSlot(e.target.value as Slot | '')} aria-label="Time">
            <option value="">Any time</option>
            {slotsOn(day || null).map((s) => (
              <option key={s} value={s}>
                {slotTitle(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="chips">
          <button className={`chip${!cat ? ' on' : ''}`} onClick={() => setCat(null)}>
            All
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip${cat === c ? ' on' : ''}`} onClick={() => setCat(cat === c ? null : c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered && (
        <div className="row-between muted small">
          <span>
            {clubs.length} club{clubs.length === 1 ? '' : 's'}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setQ('');
              setCat(null);
              setDay('');
              setSlot('');
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {!filtered && suggested.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <div className="section-head">
            <h2>Suggested for you</h2>
            <span className="muted small">Based on clubs you already follow</span>
          </div>
          <div className="grid grid-cards">
            {suggested.map((c) => (
              <ClubCard key={c.id} club={c} userId={me.id} />
            ))}
          </div>
          <div className="section-head" style={{ marginTop: 12 }}>
            <h2>All clubs</h2>
          </div>
        </section>
      )}

      {clubs.length === 0 ? (
        <div className="card">
          <Empty title="No clubs match">
            Try a different search or clear the filters.
          </Empty>
        </div>
      ) : (
        <div className="grid grid-cards">
          {clubs.map((c) => (
            <ClubCard key={c.id} club={c} userId={me.id} />
          ))}
        </div>
      )}
    </div>
  );
}
