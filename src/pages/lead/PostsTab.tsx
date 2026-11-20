import { useState } from 'react';
import { useMe } from '../../components/Layout';
import { PostCard } from '../../components/PostCard';
import { Avatar, Empty, Segmented, useToast } from '../../components/ui';
import * as A from '../../data/actions';
import { activeMembers, clubPostsFor, followerCount, userById } from '../../data/selectors';
import { useDB } from '../../data/store';
import type { Audience, Club, ID } from '../../data/types';

type AudienceType = Audience['type'];

export function PostsTab({ club }: { club: Club }) {
  const db = useDB();
  const me = useMe();
  const { run } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [aud, setAud] = useState<AudienceType>('public');
  const [selected, setSelected] = useState<ID[]>([]);
  const [pinned, setPinned] = useState(false);

  const members = activeMembers(db, club.id)
    .filter((m) => m.userId !== me.id)
    .map((m) => userById(db, m.userId)!)
    .sort((a, b) => a.name.localeCompare(b.name));
  const followers = followerCount(db, club.id);
  const posts = clubPostsFor(db, me.id, club.id);

  const reach =
    aud === 'public'
      ? `${members.length} members and ${followers} followers`
      : aud === 'members'
        ? `${members.length} members only`
        : `${selected.length} selected member${selected.length === 1 ? '' : 's'}`;

  const submit = () => {
    const audience: Audience =
      aud === 'selected' ? { type: 'selected', userIds: selected } : { type: aud };
    if (run(() => A.createPost(club.id, { title, body, audience, pinned }), 'Sent')) {
      setTitle('');
      setBody('');
      setSelected([]);
      setPinned(false);
    }
  };

  return (
    <div className="two-col">
      <div className="stack">
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h3 style={{ margin: 0 }}>New update or message</h3>
          <div className="stack" style={{ gap: 6 }}>
            <span className="small strong">Send to</span>
            <Segmented<AudienceType>
              value={aud}
              onChange={setAud}
              options={[
                { id: 'public', label: 'Followers + members' },
                { id: 'members', label: 'All members' },
                { id: 'selected', label: 'Specific members' },
              ]}
            />
            <span className="tiny muted">
              {aud === 'public'
                ? 'Public update: shows on the club page and in followers’ and members’ feeds.'
                : 'Private message: only the chosen members (and other leaders) will see it.'}
            </span>
          </div>
          {aud === 'selected' && (
            <div className="card" style={{ padding: 10, maxHeight: 220, overflowY: 'auto' }}>
              <div className="row-between" style={{ marginBottom: 6 }}>
                <span className="small strong">Members</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelected(selected.length === members.length ? [] : members.map((m) => m.id))}
                >
                  {selected.length === members.length ? 'Clear' : 'Select all'}
                </button>
              </div>
              {members.length === 0 && <p className="muted small">No other members yet.</p>}
              {members.map((u) => (
                <label key={u.id} className="check" style={{ padding: '4px 0' }}>
                  <input
                    type="checkbox"
                    checked={selected.includes(u.id)}
                    onChange={(e) =>
                      setSelected(e.target.checked ? [...selected, u.id] : selected.filter((x) => x !== u.id))
                    }
                  />
                  <Avatar user={u} />
                  <span className="small">{u.name}</span>
                </label>
              ))}
            </div>
          )}
          <label className="field">
            <span>Title</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's happening?" />
          </label>
          <label className="field">
            <span>Message</span>
            <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details, links, what to bring…" />
          </label>
          <div className="row-between">
            <label className="check small">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              Pin to top of club page
            </label>
            <div className="row">
              <span className="tiny muted">Reaches {reach}</span>
              <button className="btn btn-primary" type="submit" disabled={!title.trim() || (aud === 'selected' && !selected.length)}>
                Send
              </button>
            </div>
          </div>
        </form>

        <h3>Sent</h3>
        {posts.length === 0 ? (
          <div className="card">
            <Empty title="Nothing sent yet" />
          </div>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} viewerId={me.id} showClub={false} />)
        )}
      </div>
      <aside className="stack">
        <div className="card stack small">
          <h3 style={{ margin: 0 }}>Who sees what</h3>
          <div>
            <strong>Followers</strong> get public updates only.
          </div>
          <div>
            <strong>Members</strong> get public updates plus private messages.
          </div>
          <div className="muted">
            Posts can be reported to school administrators, who can remove anything that breaks school rules.
          </div>
        </div>
      </aside>
    </div>
  );
}
