import { useState } from 'react';
import { Truck, Bell, LogOut, ChevronDown, LifeBuoy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';

export function Navbar() {
  const { profile, signOut } = useAuth();
  const { navigate } = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dashboardPath = profile?.role === 'admin' ? '/admin' : profile?.role === 'driver' ? '/driver' : '/shipper';

  async function handleSignOut() {
    await signOut();
    navigate('/');
    setDropdownOpen(false);
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-[#030F0D]/95 backdrop-blur-md border-b border-teal-900/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => navigate(profile ? dashboardPath : '/')}
            className="flex items-center gap-2.5"
          >
            <img src="/trucgo-logo-transparent.webp" alt="ZITRUCKGO LOGISTICS" className="w-10 h-10 rounded-full object-cover ring-1 ring-teal-500/30" />
            <div className="leading-tight">
              <span className="text-white font-bold text-lg tracking-tight">ZITRUCKGO</span>
              <span className="block text-teal-400 text-[10px] font-semibold uppercase tracking-[0.18em]">Logistics</span>
            </div>
          </button>

          {profile ? (
            <div className="flex items-center gap-3">
              {/* Role pill */}
              <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-medium border bg-teal-500/10 text-teal-400 border-teal-500/20">
                {profile.role === 'driver' ? '🛺 Driver' : '📦 Shipper'}
              </span>

              <button
                onClick={() => navigate('/support')}
                className="hidden sm:inline-flex text-slate-400 hover:text-white text-sm transition-colors"
              >
                Support
              </button>

              <button
                onClick={() => navigate(dashboardPath)}
                className="hidden sm:inline-flex text-slate-400 hover:text-white text-sm transition-colors"
              >
                {profile?.role === 'admin' ? 'Admin' : 'Dashboard'}
              </button>

              <button
                onClick={() => navigate('/support')}
                className="relative p-2 rounded-lg hover:bg-teal-900/30 text-slate-400 hover:text-white transition-colors"
                title="Notifications & Support"
              >
                <Bell size={18} />
              </button>

              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-xl hover:bg-teal-900/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-sm font-semibold">
                    {profile.full_name[0]?.toUpperCase()}
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[#0a2420] border border-teal-900/40 rounded-xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-teal-900/40">
                      <p className="text-white text-sm font-semibold truncate">{profile.full_name}</p>
                      <p className="text-slate-400 text-xs truncate">{profile.phone}</p>
                    </div>
                    <button
                      onClick={() => { navigate('/support'); setDropdownOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                    >
                      <LifeBuoy size={15} /> Support
                    </button>
                    <button
                      onClick={() => { navigate('/profile'); setDropdownOpen(false); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-slate-300 hover:bg-teal-900/30 hover:text-white text-sm transition-colors"
                    >
                      <Truck size={15} /> My Profile
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-red-400 hover:bg-red-500/10 text-sm transition-colors border-t border-teal-900/40"
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/auth', { mode: 'login' })}
                className="text-slate-300 hover:text-white text-sm transition-colors"
              >
                Log In
              </button>
              <button
                onClick={() => navigate('/auth', { mode: 'register' })}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Register Free
              </button>
            </div>
          )}
        </div>
      </div>

      {dropdownOpen && <div className="fixed inset-0 z-[-1]" onClick={() => setDropdownOpen(false)} />}
    </nav>
  );
}
