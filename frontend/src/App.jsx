/**
 * src/App.jsx
 *
 * Root component. Sets up:
 *   - React Query (QueryClientProvider)
 *   - React Hot Toast notifications
 *   - Session restore on mount (validates stored JWT with GET /auth/me)
 *   - All application routes via React Router <Routes>
 *
 * Route structure:
 *   /                  → Landing (public)
 *   /discover          → Discover campaigns (public)
 *   /campaigns/:id     → Campaign detail (public)
 *   /login             → Login  (redirects to /dashboard if already logged in)
 *   /register          → Register (redirects to /dashboard if already logged in)
 *   /dashboard/*       → Protected, role-switched dashboard
 *   /admin/milestones  → Protected, admin only
 *   *                  → 404 Not Found
 */

import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Session restore hook
import useSessionRestore from './hooks/useSessionRestore';

// Layouts
import AppShell from './layouts/AppShell';

// Router guards
import ProtectedRoute from './router/ProtectedRoute';
import RoleGuard      from './router/RoleGuard';

// Public pages
import Landing        from './pages/Landing';
import Discover       from './pages/Discover';
import CampaignDetail from './pages/CampaignDetail';
import Login          from './pages/Login';
import Register       from './pages/Register';
import RoleSelect     from './pages/RoleSelect';
import NotFound       from './pages/NotFound';

// Dashboard pages
import DashboardRouter    from './pages/dashboard/DashboardRouter';
import InvestorDashboard  from './pages/dashboard/InvestorDashboard';
import InvestorHistory    from './pages/dashboard/InvestorHistory';
import StartupDashboard   from './pages/dashboard/StartupDashboard';
import StartupProfilePage from './pages/dashboard/StartupProfile';
import CreateCampaignPage from './pages/dashboard/CreateCampaignPage';
import CampaignManager   from './pages/dashboard/CampaignManager';
import MyCampaigns       from './pages/dashboard/MyCampaigns';
import MilestoneExecutionPage from './pages/dashboard/MilestoneExecutionPage';

// Auth store (for redirect logic on auth pages)
import useAuthStore from './store/authStore';

import AdminMilestones    from './pages/dashboard/AdminMilestones';
import AdminLogin         from './pages/admin/AdminLogin';
import AdminLayout        from './layouts/AdminLayout';
import AdminDashboard     from './pages/admin/AdminDashboard';
import AdminSyncManager from './pages/admin/AdminSyncManager';
import InvestorProfileSetup from './pages/InvestorProfileSetup';
import Notifications      from './pages/Notifications';

// Startup onboarding pages
import StartupWelcome               from './pages/startup/StartupWelcome';
import StartupPendingVerification   from './pages/startup/StartupPendingVerification';
import StartupOnboarding            from './pages/startup/StartupOnboarding';

// ─── React Query client ───────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            1000 * 60 * 2, // 2 minutes before refetch
      retry:                1,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Auth-page guard: redirect logged-in users away from /login, /register ───

function AuthPageGuard({ children }) {
  const { isLoggedIn } = useAuthStore();
  if (isLoggedIn) return <Navigate to="/dashboard" replace />;
  return children;
}

// ─── Role Switch for Dashboard Index ────────────────────────────────────────

function RoleSwitch({ investor, startup }) {
  const { role } = useAuthStore();
  if (role === 'investor') return investor;
  if (role === 'startup') return startup;
  return null;
}

// ─── Session aware router ─────────────────────────────────────────────────────

function AppRoutes() {
  const [persistReady, setPersistReady] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) setPersistReady(true);
    const unsub = useAuthStore.persist.onFinishHydration(() => setPersistReady(true));
    return unsub;
  }, []);

  const { isRestoring } = useSessionRestore();

  // Wait for Zustand persist to rehydrate from localStorage before routing; otherwise
  // isLoggedIn is briefly false and ProtectedRoute redirects to /login.
  // While verifying the stored JWT, show a minimal full-page spinner.
  if (!persistReady || isRestoring) {
    return (
      <div style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        minHeight:       '100vh',
        background:      'var(--color-bg)',
        flexDirection:   'column',
        gap:             '1rem',
      }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Restoring session…
        </span>
      </div>
    );
  }

  return (
    <Routes>
      {/* ── Hidden Admin Routes (No AppShell) ─────────────────────────── */}
      <Route path="/login/admin" element={<AuthPageGuard><AdminLogin /></AuthPageGuard>} />
      
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleGuard role="admin">
              <AdminLayout />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="milestones" element={<AdminMilestones />} />
        <Route path="sync" element={<AdminSyncManager />} />
      </Route>

      {/* AppShell wraps all pages — provides Navbar + Footer via <Outlet> */}
      <Route element={<AppShell />}>

        {/* ── Public routes ─────────────────────────────────────────────── */}
        <Route index                          element={<Landing />} />
        <Route path="discover"                element={<Discover />} />
        <Route path="campaigns/:campaignId"   element={<CampaignDetail />} />

        {/* ── Auth routes (redirect to /dashboard if already logged in) ── */}

        {/* Step 1: Role selection gateway */}
        <Route path="auth/role" element={<AuthPageGuard><RoleSelect /></AuthPageGuard>} />

        {/* Step 2a: Role-specific login — /login/investor  /login/startup */}
        <Route path="login/:role" element={<AuthPageGuard><Login /></AuthPageGuard>} />

        {/* Step 2b: Role-specific signup — /signup/investor  /signup/startup */}
        <Route path="signup/:role" element={<AuthPageGuard><Register /></AuthPageGuard>} />

        {/* Legacy redirects — keep old /login and /register working */}
        <Route path="login"    element={<AuthPageGuard><RoleSelect /></AuthPageGuard>} />
        <Route path="register" element={<AuthPageGuard><RoleSelect /></AuthPageGuard>} />

        {/* ── Profile Setup routes ───────────────────────────────────────── */}
        <Route path="setup">
          <Route path="investor" element={
            <ProtectedRoute>
              <RoleGuard role="investor">
                <InvestorProfileSetup />
              </RoleGuard>
            </ProtectedRoute>
          } />
        </Route>

        {/* ── Protected dashboard ────────────────────────────────────────── */}
        <Route
          path="dashboard"
          element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>}
        >
          {/* Index Route based on role */}
          <Route index element={
            <RoleSwitch 
              investor={<InvestorDashboard />}
              startup={<StartupDashboard />}
            />
          } />

          {/* Investor sub-routes */}
          <Route
            path="investments"
            element={
              <RoleGuard role="investor">
                <InvestorHistory />
              </RoleGuard>
            }
          />

          {/* Startup: campaigns list */}
          <Route
            path="campaigns"
            element={
              <RoleGuard role="startup">
                <MyCampaigns />
              </RoleGuard>
            }
          />

          {/* Startup: request campaign — replaces old new flow */}
          <Route
            path="campaigns/new"
            element={
              <RoleGuard role="startup">
                <CreateCampaignPage />
              </RoleGuard>
            }
          />

          {/* Edit existing campaign draft */}
          <Route
            path="campaigns/:campaignId/edit"
            element={
              <RoleGuard role="startup">
                <CreateCampaignPage />
              </RoleGuard>
            }
          />

          {/* Startup: single campaign manager — MUST be after /new */}
          <Route
            path="campaigns/:campaignId"
            element={
              <RoleGuard role="startup">
                <CampaignManager />
              </RoleGuard>
            }
          />

          {/* Startup: milestone execution */}
          <Route
            path="campaigns/:campaignId/milestones/:milestoneId/execute"
            element={
              <RoleGuard role="startup">
                <MilestoneExecutionPage />
              </RoleGuard>
            }
          />

          {/* Startup profile create/edit */}
          <Route
            path="profile"
            element={
              <RoleGuard role="startup">
                <StartupProfilePage />
              </RoleGuard>
            }
          />
        </Route>


        {/* Notifications — all authenticated users */}
        <Route
          path="notifications"
          element={<ProtectedRoute><Notifications /></ProtectedRoute>}
        />

        {/* ── Startup onboarding routes ─────────────────────────────── */}
        {/* Shown after new startup registers — before profile creation */}
        <Route
          path="startup/welcome"
          element={
            <ProtectedRoute>
              <RoleGuard role="startup">
                <StartupWelcome />
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* Shown when startup profile exists but is not yet approved */}
        <Route
          path="startup/pending-verification"
          element={
            <ProtectedRoute>
              <RoleGuard role="startup">
                <StartupPendingVerification />
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* Full multi-step onboarding form (create / edit / submit profile) */}
        <Route
          path="startup/onboarding"
          element={
            <ProtectedRoute>
              <RoleGuard role="startup">
                <StartupOnboarding />
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background:   '#1c1f35',
            color:        '#f0f2ff',
            border:       '1px solid #252840',
            fontSize:     '0.875rem',
            borderRadius: '10px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#0f1020' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#0f1020' } },
        }}
      />
      <AppRoutes />
    </QueryClientProvider>
  );
}
