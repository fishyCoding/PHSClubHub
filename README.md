# PHS Club Hub

One place for Princeton High School students to find clubs, get updates from club leaders,
see when and where clubs meet, and (for leaders) track attendance. Maintained by the Tech Office.

**Status:** frontend prototype. All data lives in the browser (localStorage) and is seeded with
fictional demo data. The backend will be Supabase. See "Connecting Supabase" below.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # permission rules + render smoke tests
npm run build      # type-check + production build into dist/
```

Pick a demo account on the sign-in screen. **Account → Reset demo data** restores the seed.

| Demo account | What to try |
| --- | --- |
| Priya Raman (student) | Home feed incl. private messages, Explore, Schedule, follow/join, report a post |
| Sam Okoro (freshman) | Pending join request, pending leader request |
| Maya Chen (leader) | Lead → Robotics: post to followers / all members / specific members, cancel a meeting, take attendance, approve join requests |
| Aisha Mensah (leader) | GSA, a club with private membership |
| Dana Whitfield (admin) | Create clubs, verify leaders, moderation queue, attendance across clubs |

## Interfaces

- **Student:** Home (feed + next 7 days), Explore (search, category, day/time filters), Club page,
  Schedule (week view, with cancellations, room changes and extra meetings applied), My Clubs
  (memberships, follows, request leader access).
- **Club leader** (`/lead/:clubId`): Updates & messages, Schedule (regular meetings + one-time
  changes, optionally announced), Attendance (roll call, history, per-member rates), Members
  (approve/decline/remove), Club info (description).
- **Administrator** (`/admin`): Dashboard, Clubs (create/edit/archive, privacy, assign leaders),
  Leaders (verify/deny/revoke), Moderation (reports, remove/restore posts), Attendance (all clubs,
  sortable, drill-down).

## Rules (from the product Q&A)

| Rule | Where it lives |
| --- | --- |
| Only admins create clubs (Q-2) | `canCreateClub` |
| Members see each other; followers don't (Q-3) | `canSeeMembers` |
| Attendance: club leaders + admins only, for evaluating clubs (Q-4) | `canSeeAttendance` |
| Clubs can hide membership from everyone but leaders, advisor and admins (Q-5) | `Club.hiddenMembership` + `canSeeMembers` |
| Meeting times are described simply, e.g. "Tuesday lunch" (Q-6) | `MeetingTime { day, slot, room }` |
| Leader status is per club and needs admin verification | `LeaderRequest`, `Membership.role` |
| Joining needs leader approval; following is instant | `requestJoin` / `approveMember` / `follow` |
| Followers get public updates; members also get private messages | `Post.audience`, `canSeePost`, `isInFeed` |

All rules are in [src/data/permissions.ts](src/data/permissions.ts) and covered by
[src/data/permissions.test.ts](src/data/permissions.test.ts).

## Code layout

```
src/data/types.ts        data model (table-shaped)
src/data/permissions.ts  every visibility / permission rule
src/data/actions.ts      every write, with permission checks
src/data/selectors.ts    derived views (feed, schedule, attendance stats)
src/data/store.ts        localStorage-backed store + useDB() hook
src/data/seed.ts         fictional demo data
src/components/          shared UI
src/pages/               student pages, lead/ (leader tools), admin/
```

## Connecting Supabase

Components only call `useDB()`, selectors and functions in `actions.ts`, so the swap stays inside `src/data/`:

1. **Tables:** one per array in the `DB` type: `users` (→ `profiles` linked to `auth.users`),
   `clubs` (meetings as a `jsonb` column or a `club_meetings` table), `memberships`, `follows`,
   `posts` (audience as `audience_type` + `audience_user_ids uuid[]`), `club_events`,
   `attendance_sessions`, `leader_requests`, `reports`, `audit_log`, `post_reads`.
2. **Auth:** replace the demo account picker with Supabase Auth (school Google SSO), restricted to the school domain.
3. **Row Level Security:** turn each function in `permissions.ts` into an RLS policy. Most important:
   members of hidden-membership clubs must not be able to read `memberships` rows for that club; attendance
   rows only for club leaders and admins; posts by audience.
4. **Actions:** turn each function in `actions.ts` into a Supabase call (multi-step ones like
   `decideLeaderRequest` and `createEvent` with an announcement as Postgres functions/RPC).
5. **Store:** replace `store.ts` with a data-fetching layer (e.g. TanStack Query + Supabase realtime for the feed).

The seed emails use the placeholder domain `phs.example.edu`.
