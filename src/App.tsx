import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ui';
import * as P from './data/permissions';
import { useDB } from './data/store';
import { AdminAttendance } from './pages/admin/AdminAttendance';
import { AdminClubs } from './pages/admin/AdminClubs';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminLeaders } from './pages/admin/AdminLeaders';
import { AdminModeration } from './pages/admin/AdminModeration';
import { ClubPage } from './pages/ClubPage';
import { Explore } from './pages/Explore';
import { Home } from './pages/Home';
import { LeadClub, LeadIndex } from './pages/lead/LeadClub';
import { Login } from './pages/Login';
import { MyClubs } from './pages/MyClubs';
import { NotFound } from './pages/NotFound';
import { Schedule } from './pages/Schedule';

function AdminOnly({ children }: { children: JSX.Element }) {
  const db = useDB();
  return P.isAdmin(db, db.sessionUserId) ? children : <Navigate to="/" replace />;
}

function StudentOnly({ children }: { children: JSX.Element }) {
  const db = useDB();
  return P.isAdmin(db, db.sessionUserId) ? <Navigate to="/admin" replace /> : children;
}

function AppRoutes() {
  const db = useDB();
  if (!P.getUser(db, db.sessionUserId)) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<StudentOnly><Home /></StudentOnly>} />
        <Route path="explore" element={<Explore />} />
        <Route path="clubs/:clubId" element={<ClubPage />} />
        <Route path="schedule" element={<StudentOnly><Schedule /></StudentOnly>} />
        <Route path="my-clubs" element={<StudentOnly><MyClubs /></StudentOnly>} />
        <Route path="lead" element={<LeadIndex />} />
        <Route path="lead/:clubId" element={<LeadClub />} />
        <Route path="admin" element={<AdminOnly><AdminDashboard /></AdminOnly>} />
        <Route path="admin/clubs" element={<AdminOnly><AdminClubs /></AdminOnly>} />
        <Route path="admin/leaders" element={<AdminOnly><AdminLeaders /></AdminOnly>} />
        <Route path="admin/moderation" element={<AdminOnly><AdminModeration /></AdminOnly>} />
        <Route path="admin/attendance" element={<AdminOnly><AdminAttendance /></AdminOnly>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <ToastProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </HashRouter>
    </ToastProvider>
  );
}
