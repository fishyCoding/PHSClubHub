// Demo data. All names are fictional. Dates are generated relative to "now"
// so the prototype always looks current.

import { addDays, mondayOf, todayISO, weekdayOf } from './dates';
import { scheduleForClubs } from './selectors';
import type {
  AttendanceSession,
  Club,
  ClubEvent,
  DB,
  Follow,
  LeaderRequest,
  Membership,
  Post,
  Report,
  Rsvp,
  User,
} from './types';

export const DB_VERSION = 6;

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

// Small deterministic PRNG so the demo looks the same on every reset.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const users: User[] = [
  { id: 'u-admin', name: 'Dana Whitfield', email: 'dwhitfield@phs.example.edu', role: 'admin', title: 'Tech Office' },
  { id: 'u-admin2', name: 'Marcus Okafor', email: 'mokafor@phs.example.edu', role: 'admin', title: 'Activities Office' },
  { id: 'u-maya', name: 'Maya Chen', email: 'mchen27@phs.example.edu', role: 'student', grade: 11 },
  { id: 'u-jordan', name: 'Jordan Alvarez', email: 'jalvarez26@phs.example.edu', role: 'student', grade: 12 },
  { id: 'u-priya', name: 'Priya Raman', email: 'praman28@phs.example.edu', role: 'student', grade: 10 },
  { id: 'u-sam', name: 'Sam Okoro', email: 'sokoro29@phs.example.edu', role: 'student', grade: 9 },
  { id: 'u-lena', name: 'Lena Fischer', email: 'lfischer27@phs.example.edu', role: 'student', grade: 11 },
  { id: 'u-theo', name: 'Theo Brooks', email: 'tbrooks26@phs.example.edu', role: 'student', grade: 12 },
  { id: 'u-aisha', name: 'Aisha Mensah', email: 'amensah28@phs.example.edu', role: 'student', grade: 10 },
  { id: 'u-kenji', name: 'Kenji Watanabe', email: 'kwatanabe27@phs.example.edu', role: 'student', grade: 11 },
  { id: 'u-sofia', name: 'Sofia Russo', email: 'srusso29@phs.example.edu', role: 'student', grade: 9 },
  { id: 'u-eli', name: 'Eli Goldberg', email: 'egoldberg26@phs.example.edu', role: 'student', grade: 12 },
  { id: 'u-nora', name: 'Nora Park', email: 'npark28@phs.example.edu', role: 'student', grade: 10 },
  { id: 'u-dev', name: 'Dev Patel', email: 'dpatel27@phs.example.edu', role: 'student', grade: 11 },
  { id: 'u-grace', name: 'Grace Liu', email: 'gliu29@phs.example.edu', role: 'student', grade: 9 },
  { id: 'u-omar', name: 'Omar Haddad', email: 'ohaddad26@phs.example.edu', role: 'student', grade: 12 },
  { id: 'u-ruby', name: 'Ruby Santos', email: 'rsantos28@phs.example.edu', role: 'student', grade: 10 },
  { id: 'u-felix', name: 'Felix Nguyen', email: 'fnguyen27@phs.example.edu', role: 'student', grade: 11 },
];

const created = hoursAgo(24 * 70);

const clubs: Club[] = [
  {
    id: 'c-robotics', name: 'Robotics Team', category: 'STEM', advisor: 'Mr. Harlan',
    description: 'We design, build and program robots for the FIRST Robotics Competition. No experience needed: we teach CAD, machining, wiring and Java.',
    meetings: [
      { day: 'Tuesday', slot: 'after school', room: 'Room 112 (Engineering Lab)' },
      { day: 'Thursday', slot: 'after school', room: 'Room 112 (Engineering Lab)' },
    ],
    hiddenMembership: false, archived: false, createdAt: created, createdBy: 'u-admin',
  },
  {
    id: 'c-debate', name: 'Debate Society', category: 'Academic', advisor: 'Ms. Koenig',
    description: 'Public Forum and Lincoln-Douglas debate. We compete at regional tournaments most months and hold practice rounds every week.',
    meetings: [{ day: 'Wednesday', slot: 'after school', room: 'Room 204' }],
    hiddenMembership: false, archived: false, createdAt: created, createdBy: 'u-admin',
  },
  {
    id: 'c-mun', name: 'Model UN', category: 'Academic', advisor: 'Mr. Delgado',
    description: 'Represent countries, write resolutions and negotiate at conferences. Great for anyone interested in history, politics or public speaking.',
    meetings: [
      { day: 'Monday', slot: 'lunch', room: 'Room 231' },
      { day: 'Tuesday', slot: 'flex time', room: 'Room 231', note: 'conference prep' },
    ],
    hiddenMembership: false, archived: false, createdAt: created, createdBy: 'u-admin',
  },
  {
    id: 'c-enviro', name: 'Environmental Club', category: 'Service', advisor: 'Dr. Sato',
    description: 'Campus composting, the spring stream cleanup, and pushing for greener school policies. Come help the garden grow.',
    meetings: [{ day: 'Thursday', slot: 'lunch', room: 'Room 150 (Bio Lab)' }],
    hiddenMembership: false, archived: false, createdAt: created, createdBy: 'u-admin',
  },
  {
    id: 'c-chess', name: 'Chess Club', category: 'Games & Hobbies', advisor: 'Mr. Ivanov',
    description: 'Casual games, puzzles and the occasional tournament. All levels welcome, boards provided.',
    meetings: [{ day: 'Friday', slot: 'lunch', room: 'Library' }],
    hiddenMembership: false, archived: false, createdAt: created, createdBy: 'u-admin',
  },
  {
    id: 'c-art', name: 'Art Collective', category: 'Arts', advisor: 'Ms. Moreau',
    description: 'Open studio time, collaborative murals and a student gallery show every spring.',
    meetings: [{ day: 'Wednesday', slot: 'lunch', room: 'Art Room A' }],
    hiddenMembership: false, archived: false, createdAt: created, createdBy: 'u-admin',
  },
  {
    id: 'c-code', name: 'Coding Club', category: 'STEM', advisor: 'Ms. Brandt',
    description: 'Build apps, websites and games. We run a hackathon in March and prep for the USACO and Congressional App Challenge.',
    meetings: [{ day: 'Monday', slot: 'after school', room: 'Room 118 (Computer Lab)' }],
    hiddenMembership: false, archived: false, createdAt: created, createdBy: 'u-admin',
  },
  {
    id: 'c-gsa', name: 'Gender & Sexuality Alliance', category: 'Culture & Identity', advisor: 'Ms. Ortega',
    description: 'A supportive space for LGBTQ+ students and allies. Membership is private: only club leaders and our advisor can see who belongs.',
    meetings: [{ day: 'Tuesday', slot: 'lunch', room: 'Room 220' }],
    hiddenMembership: true, archived: false, createdAt: created, createdBy: 'u-admin',
  },
  {
    id: 'c-mind', name: 'Mental Health Matters', category: 'Wellness', advisor: 'Mr. Reyes (Counseling)',
    description: 'Peer support, de-stress events and awareness campaigns. Membership is private.',
    meetings: [{ day: 'Thursday', slot: 'tiger time', room: 'Counseling Center' }],
    hiddenMembership: true, archived: false, createdAt: created, createdBy: 'u-admin',
  },
  {
    id: 'c-paper', name: 'The Tower (Newspaper)', category: 'Media', advisor: 'Ms. Albright',
    description: 'The student newspaper. Writers, photographers, editors and layout designers all welcome.',
    meetings: [
      { day: 'Monday', slot: 'after school', room: 'Room 105' },
      { day: 'Friday', slot: 'after school', room: 'Room 105', note: 'production weeks only' },
    ],
    hiddenMembership: false, archived: false, createdAt: created, createdBy: 'u-admin',
  },
  {
    id: 'c-key', name: 'Key Club', category: 'Service', advisor: 'Mrs. Duval',
    description: 'Volunteer service projects around Princeton: food drives, tutoring, park cleanups.',
    meetings: [{ day: 'Wednesday', slot: 'flex time', room: 'Cafeteria' }],
    hiddenMembership: false, archived: false, createdAt: created, createdBy: 'u-admin',
  },
  {
    id: 'c-film', name: 'Film Club', category: 'Arts', advisor: 'Mr. Tran',
    description: 'Watch and discuss films, then make our own shorts.',
    meetings: [{ day: 'Friday', slot: 'after school', room: 'Auditorium' }],
    hiddenMembership: false, archived: true, createdAt: created, createdBy: 'u-admin',
  },
];

// [userId, clubId, role, status]
const roster: Array<[string, string, 'member' | 'leader', 'active' | 'pending']> = [
  // Robotics: Maya leads
  ['u-maya', 'c-robotics', 'leader', 'active'],
  ['u-kenji', 'c-robotics', 'leader', 'active'],
  ['u-priya', 'c-robotics', 'member', 'active'],
  ['u-dev', 'c-robotics', 'member', 'active'],
  ['u-grace', 'c-robotics', 'member', 'active'],
  ['u-felix', 'c-robotics', 'member', 'active'],
  ['u-omar', 'c-robotics', 'member', 'active'],
  ['u-sam', 'c-robotics', 'member', 'pending'],
  ['u-sofia', 'c-robotics', 'member', 'pending'],
  // Debate: Jordan leads
  ['u-jordan', 'c-debate', 'leader', 'active'],
  ['u-maya', 'c-debate', 'member', 'active'],
  ['u-eli', 'c-debate', 'member', 'active'],
  ['u-nora', 'c-debate', 'member', 'active'],
  ['u-aisha', 'c-debate', 'member', 'active'],
  ['u-ruby', 'c-debate', 'member', 'pending'],
  // Model UN
  ['u-theo', 'c-mun', 'leader', 'active'],
  ['u-jordan', 'c-mun', 'member', 'active'],
  ['u-aisha', 'c-mun', 'member', 'active'],
  ['u-eli', 'c-mun', 'member', 'active'],
  ['u-sofia', 'c-mun', 'member', 'active'],
  // Environmental
  ['u-ruby', 'c-enviro', 'leader', 'active'],
  ['u-priya', 'c-enviro', 'member', 'active'],
  ['u-lena', 'c-enviro', 'member', 'active'],
  ['u-grace', 'c-enviro', 'member', 'active'],
  ['u-nora', 'c-enviro', 'member', 'active'],
  // Chess
  ['u-omar', 'c-chess', 'leader', 'active'],
  ['u-kenji', 'c-chess', 'member', 'active'],
  ['u-felix', 'c-chess', 'member', 'active'],
  ['u-priya', 'c-chess', 'member', 'pending'],
  // Art
  ['u-nora', 'c-art', 'leader', 'active'],
  ['u-sofia', 'c-art', 'member', 'active'],
  ['u-lena', 'c-art', 'member', 'active'],
  ['u-grace', 'c-art', 'member', 'active'],
  // Coding
  ['u-dev', 'c-code', 'leader', 'active'],
  ['u-maya', 'c-code', 'member', 'active'],
  ['u-kenji', 'c-code', 'member', 'active'],
  ['u-sam', 'c-code', 'member', 'active'],
  ['u-felix', 'c-code', 'member', 'active'],
  // GSA (hidden membership)
  ['u-aisha', 'c-gsa', 'leader', 'active'],
  ['u-priya', 'c-gsa', 'member', 'active'],
  ['u-theo', 'c-gsa', 'member', 'active'],
  ['u-ruby', 'c-gsa', 'member', 'active'],
  // Mental health (hidden membership)
  ['u-eli', 'c-mind', 'leader', 'active'],
  ['u-lena', 'c-mind', 'member', 'active'],
  ['u-sam', 'c-mind', 'member', 'active'],
  // Newspaper
  ['u-lena', 'c-paper', 'leader', 'active'],
  ['u-theo', 'c-paper', 'member', 'active'],
  ['u-nora', 'c-paper', 'member', 'active'],
  // Key Club
  ['u-grace', 'c-key', 'leader', 'active'],
  ['u-sofia', 'c-key', 'member', 'active'],
  ['u-omar', 'c-key', 'member', 'active'],
];

const memberships: Membership[] = roster.map(([userId, clubId, role, status], i) => ({
  id: `m-${i}`,
  userId,
  clubId,
  role,
  status,
  requestedAt: status === 'pending' ? hoursAgo(20 + i) : hoursAgo(24 * 60),
  ...(status === 'active' ? { approvedAt: hoursAgo(24 * 59), approvedBy: 'u-admin' } : {}),
}));

const follows: Follow[] = [
  ['u-priya', 'c-art'], ['u-priya', 'c-code'], ['u-priya', 'c-debate'],
  ['u-sam', 'c-chess'], ['u-sam', 'c-mun'], ['u-sam', 'c-enviro'],
  ['u-maya', 'c-art'], ['u-maya', 'c-enviro'],
  ['u-jordan', 'c-paper'], ['u-lena', 'c-robotics'], ['u-dev', 'c-chess'],
  ['u-aisha', 'c-art'], ['u-grace', 'c-code'],
].map(([userId, clubId]) => ({ userId, clubId, createdAt: hoursAgo(24 * 30) }));

const posts: Post[] = [
  {
    id: 'p-s1', clubId: 'c-debate', authorId: 'u-jordan', kind: 'schedule', pinned: false,
    title: 'Cancelled: next Wednesday after school', body: 'Ms. Koenig is at a conference. Practice rounds resume the week after.',
    audience: { type: 'public' }, createdAt: hoursAgo(5),
  },
  {
    id: 'p-s2', clubId: 'c-enviro', authorId: 'u-ruby', kind: 'schedule', pinned: false,
    title: 'Moved: next Thursday lunch is in the Courtyard Garden', body: 'Bring gloves, we are planting bulbs.',
    audience: { type: 'public' }, createdAt: hoursAgo(30),
  },
  {
    id: 'p-1', clubId: 'c-robotics', authorId: 'u-maya', kind: 'update', pinned: true,
    title: 'Build season kickoff is in January',
    body: 'We will watch the game reveal together in the Engineering Lab. Before then, please finish the CAD onboarding module. Ask Kenji if you get stuck.',
    audience: { type: 'public' }, createdAt: hoursAgo(50),
  },
  {
    id: 'p-2', clubId: 'c-robotics', authorId: 'u-maya', kind: 'update', pinned: false,
    title: 'Shop safety quiz due Friday',
    body: 'Every member needs to pass the safety quiz before using the drill press or band saw. Link is in the team drive. This is members only.',
    audience: { type: 'members' }, createdAt: hoursAgo(6),
  },
  {
    id: 'p-3', clubId: 'c-robotics', authorId: 'u-kenji', kind: 'update', pinned: false,
    title: 'Programming sub-team: bring laptops',
    body: 'Priya, Dev and Felix: Thursday we are setting up the new swerve drive code. Please bring a charged laptop with WPILib installed.',
    audience: { type: 'selected', userIds: ['u-priya', 'u-dev', 'u-felix'] }, createdAt: hoursAgo(3),
  },
  {
    id: 'p-4', clubId: 'c-debate', authorId: 'u-jordan', kind: 'update', pinned: true,
    title: 'Tournament sign-ups open',
    body: 'The December invitational sign-up sheet is open until next Wednesday. Novices are strongly encouraged to come.',
    audience: { type: 'public' }, createdAt: hoursAgo(28),
  },
  {
    id: 'p-5', clubId: 'c-debate', authorId: 'u-jordan', kind: 'update', pinned: false,
    title: 'Partner assignments',
    body: 'Partner pairs for the invitational are posted in our shared folder. Message me if you have a conflict.',
    audience: { type: 'members' }, createdAt: hoursAgo(10),
  },
  {
    id: 'p-6', clubId: 'c-enviro', authorId: 'u-ruby', kind: 'update', pinned: false,
    title: 'Compost bins need volunteers',
    body: 'We need two people per lunch period to help sort compost. Followers welcome too: just show up at the cafeteria doors.',
    audience: { type: 'public' }, createdAt: hoursAgo(20),
  },
  {
    id: 'p-7', clubId: 'c-art', authorId: 'u-nora', kind: 'update', pinned: false,
    title: 'Mural design vote',
    body: 'Three designs for the B-wing mural are up on the board in Art Room A. Stop by and vote with a sticker!',
    audience: { type: 'public' }, createdAt: hoursAgo(36),
  },
  {
    id: 'p-8', clubId: 'c-code', authorId: 'u-dev', kind: 'update', pinned: false,
    title: 'Hackathon planning committee',
    body: 'We are looking for 4 people to help plan the March hackathon: sponsors, food, judging. Reply to me in person at Monday\'s meeting.',
    audience: { type: 'public' }, createdAt: hoursAgo(72),
  },
  {
    id: 'p-9', clubId: 'c-gsa', authorId: 'u-aisha', kind: 'update', pinned: false,
    title: 'Ally week planning',
    body: 'We are planning Ally Week activities. Anyone can follow for public events; member details stay private.',
    audience: { type: 'public' }, createdAt: hoursAgo(44),
  },
  {
    id: 'p-10', clubId: 'c-mun', authorId: 'u-theo', kind: 'update', pinned: false,
    title: 'Country assignments are out',
    body: 'Check your email for your country assignment for the winter conference. Position papers are due in three weeks.',
    audience: { type: 'public' }, createdAt: hoursAgo(15),
  },
  {
    id: 'p-11', clubId: 'c-chess', authorId: 'u-omar', kind: 'update', pinned: false,
    title: 'Blitz tournament results',
    body: 'Congrats to Kenji for winning the lunch blitz bracket! Rematch next month. Also: whoever keeps taking the black queens, please stop :)',
    audience: { type: 'public' }, createdAt: hoursAgo(90),
  },
];

const today = todayISO();
const monday = mondayOf(today);

const events: ClubEvent[] = [
  {
    id: 'e-1', clubId: 'c-debate', kind: 'cancelled', date: addDays(monday, 7 + 2), slot: 'after school',
    room: 'Room 204', title: 'No practice: teacher conference day', createdBy: 'u-jordan', createdAt: hoursAgo(12),
  },
  {
    id: 'e-2', clubId: 'c-robotics', kind: 'event', date: addDays(monday, 5), slot: 'after school',
    room: 'Room 112 (Engineering Lab)', title: 'Saturday build session (10am to 2pm)', createdBy: 'u-maya', createdAt: hoursAgo(30),
  },
  {
    id: 'e-3', clubId: 'c-enviro', kind: 'moved', date: addDays(monday, 7 + 3), slot: 'lunch',
    room: 'Courtyard Garden', title: 'Meeting outside in the garden', createdBy: 'u-ruby', createdAt: hoursAgo(8),
  },
  {
    id: 'e-4', clubId: 'c-art', kind: 'event', date: addDays(monday, 7 + 4), slot: 'after school',
    room: 'Art Room A', title: 'Mural painting day', createdBy: 'u-nora', createdAt: hoursAgo(36),
  },
];

// Attendance: past 6 weeks of regular meetings for each club.
// Chess deliberately has none recently, so the admin "needs attention" flag shows up.
function buildAttendance(): AttendanceSession[] {
  const out: AttendanceSession[] = [];
  const rand = rng(42);
  const turnout: Record<string, number> = {
    'c-robotics': 0.88, 'c-debate': 0.8, 'c-mun': 0.7, 'c-enviro': 0.6,
    'c-art': 0.75, 'c-code': 0.65, 'c-gsa': 0.85, 'c-mind': 0.7, 'c-paper': 0.55, 'c-key': 0.5,
  };
  let n = 0;
  for (const club of clubs) {
    if (club.archived) continue;
    const rate = turnout[club.id];
    const start = addDays(today, club.id === 'c-chess' ? -70 : -42);
    const end = club.id === 'c-chess' ? addDays(today, -45) : addDays(today, -1);
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const wd = weekdayOf(d);
      if (!wd || !club.meetings.some((m) => m.day === wd)) continue;
      const members = memberships
        .filter((m) => m.clubId === club.id && m.status === 'active')
        .map((m) => m.userId);
      const present = members.filter(() => rand() < (rate ?? 0.6));
      out.push({
        id: `a-${n++}`,
        clubId: club.id,
        date: d,
        rosterUserIds: members,
        presentUserIds: present,
        guestCount: Math.floor(rand() * 3),
        takenBy: members[0],
        takenAt: `${d}T15:00:00.000Z`,
      });
    }
  }
  return out;
}

const leaderRequests: LeaderRequest[] = [
  {
    id: 'lr-1', userId: 'u-lena', clubId: 'c-enviro', position: 'Vice President', status: 'pending',
    note: 'Elected VP at the October meeting. Ruby and Dr. Sato can confirm.', createdAt: hoursAgo(26),
  },
  {
    id: 'lr-2', userId: 'u-sam', clubId: 'c-chess', position: 'Co-President', status: 'pending',
    note: 'Omar asked me to help run the club next semester.', createdAt: hoursAgo(4),
  },
];

const reports: Report[] = [
  {
    id: 'r-1', postId: 'p-11', reporterId: 'u-felix', status: 'open', createdAt: hoursAgo(80),
    reason: 'Calling people out about the missing queens feels like it is aimed at someone.',
  },
];

/** A few answers for the coming week so leaders see headcounts in the demo. */
function buildRsvps(db: DB): Rsvp[] {
  const rand = rng(7);
  const out: Rsvp[] = [];
  const leaveBlank = new Set(['u-priya', 'u-maya']); // demo users get to answer themselves
  for (const item of scheduleForClubs(db, db.clubs.map((c) => c.id), today, 8)) {
    if (item.status === 'cancelled') continue;
    for (const m of db.memberships) {
      if (m.clubId !== item.clubId || m.status !== 'active' || leaveBlank.has(m.userId)) continue;
      const x = rand();
      const status = x < 0.55 ? 'going' : x < 0.7 ? 'maybe' : x < 0.82 ? 'not_going' : null;
      if (status) out.push({ userId: m.userId, clubId: item.clubId, date: item.date, slot: item.slot, status, at: hoursAgo(rand() * 48) });
    }
  }
  return out;
}

export function createSeed(): DB {
  const db: DB = {
    version: DB_VERSION,
    users,
    clubs,
    memberships,
    follows,
    posts,
    events,
    attendance: buildAttendance(),
    leaderRequests,
    reports,
    audit: [],
    rsvps: [],
    reads: { 'u-priya': ['p-1', 'p-7'] },
    sessionUserId: null,
  };
  db.rsvps = buildRsvps(db);
  return db;
}
