import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RouterProvider, useRouter } from './contexts/RouterContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';

const AuthPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })));
const ShipperDashboard = lazy(() => import('./pages/ShipperDashboard').then(m => ({ default: m.ShipperDashboard })));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard').then(m => ({ default: m.DriverDashboard })));
const CreateLoadPage = lazy(() => import('./pages/CreateLoadPage').then(m => ({ default: m.CreateLoadPage })));
const LoadDetailPage = lazy(() => import('./pages/LoadDetailPage').then(m => ({ default: m.LoadDetailPage })));
const ActiveHaulPage = lazy(() => import('./pages/ActiveHaulPage').then(m => ({ default: m.ActiveHaulPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const DispatchDashboard = lazy(() => import('./pages/DispatchDashboard').then(m => ({ default: m.DispatchDashboard })));
const SupportPage = lazy(() => import('./pages/SupportPage').then(m => ({ default: m.SupportPage })));

function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/trucgo-logo-transparent.webp" alt="ZITRUCKGO LOGISTICS" className="w-16 h-16 rounded-full object-cover ring-1 ring-teal-500/30 animate-pulse" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { path, navigate } = useRouter();
  const { profile, loading, user } = useAuth();

  // Single source of truth for role-based redirects.
  // Fires after auth resolves AND after login (when profile role/id changes).
  // Depend on role + id, not the whole profile object — refreshProfile creates
  // a new object reference that would needlessly re-fire this effect.
  const profileId = profile?.id;
  const profileRole = profile?.role;
  useEffect(() => {
    if (loading || !profileId || !profileRole) return;

    if (path === '/' || path === '/auth') {
      if (profileRole === 'admin') navigate('/admin');
      else if (profileRole === 'dispatcher') navigate('/dispatch');
      else if (profileRole === 'driver') navigate('/driver');
      else navigate('/shipper');
      return;
    }

    if (path === '/driver' && profileRole !== 'driver') { navigate('/'); return; }
    if (path === '/shipper' && profileRole !== 'shipper') { navigate('/'); return; }
  }, [loading, profileId, profileRole, path, navigate]);

  // Show loader while auth resolves — no dashboard can render with stale data
  if (loading) return <PageLoader />;

  // User exists but profile hasn't loaded yet — show loader instead of
  // flashing the landing page during auth state transitions
  if (user && !profile) return <PageLoader />;

  // Login forms for role-specific routes (accessible to anyone, including logged-in users with different roles)
  if (path === '/admin') return profile?.role === 'admin'
    ? <Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>
    : <Suspense fallback={<PageLoader />}><AuthPage adminMode /></Suspense>;
  if (path === '/dispatch') return profile?.role === 'dispatcher'
    ? <Suspense fallback={<PageLoader />}><DispatchDashboard /></Suspense>
    : <Suspense fallback={<PageLoader />}><AuthPage dispatchMode /></Suspense>;

  // Not logged in
  if (!profile) {
    if (path === '/auth') return <Suspense fallback={<PageLoader />}><AuthPage /></Suspense>;
    return <LandingPage />;
  }

  // Logged in — role-specific dashboards
  if (path === '/driver') return <Suspense fallback={<PageLoader />}><DriverDashboard /></Suspense>;
  if (path === '/shipper') return <Suspense fallback={<PageLoader />}><ShipperDashboard /></Suspense>;
  if (path === '/auth') return <PageLoader />;
  if (path === '/load/create') return <Suspense fallback={<PageLoader />}><CreateLoadPage /></Suspense>;
  if (path === '/profile') return <Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>;
  if (path === '/support') return <Suspense fallback={<PageLoader />}><SupportPage /></Suspense>;
  const loadMatch = path.match(/^\/load\/([^/]+)$/);
  if (loadMatch) return <Suspense fallback={<PageLoader />}><LoadDetailPage loadId={loadMatch[1]} /></Suspense>;
  const haulMatch = path.match(/^\/haul\/([^/]+)$/);
  if (haulMatch) return <Suspense fallback={<PageLoader />}><ActiveHaulPage loadId={haulMatch[1]} /></Suspense>;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-400 mb-4">Page not found</p>
        <button onClick={() => navigate('/')} className="text-orange-400 hover:text-orange-300">Go home</button>
      </div>
    </div>
  );
}

function AppWithNav() {
  const { path } = useRouter();
  const isAdminArea = path === '/admin';
  const isDispatchArea = path === '/dispatch';
  const showNav = !isAdminArea && !isDispatchArea && path !== '/' && path !== '/driver' && path !== '/profile';

  return (
    <div className="min-h-screen bg-slate-950">
      {showNav && <Navbar />}
      <main className={showNav ? 'pt-16' : ''}>
        <AppRoutes />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppWithNav />
      </AuthProvider>
    </RouterProvider>
  );
}
