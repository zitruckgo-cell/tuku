import { useEffect, useState, useCallback } from 'react';
import {
  Truck, Package, MapPin, Radio, ArrowRight, Search,
  RefreshCw, AlertTriangle, CheckCircle2, Navigation, Gavel, User,
  Phone, Star, Activity, Eye, Filter, ChevronDown, XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import type { Load, Profile, Bid, LoadStatus, Urgency } from '../lib/types';
import { formatUGX, STATUS_LABELS, CARGO_LABELS, URGENCY_LABELS } from '../lib/types';
import { StatusBadge, UrgencyBadge } from '../components/StatusBadge';

type DispatchTab = 'overview' | 'loads' | 'hauls' | 'drivers' | 'bids';
type LoadFilter = 'all' | LoadStatus;
type DispatchLoad = Load & { driver?: Profile; shipper?: Profile };

const STATUS_FLOW: LoadStatus[] = ['posted', 'awarded', 'active_haul', 'delivered', 'completed'];

export function DispatchDashboard() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [activeTab, setActiveTab] = useState<DispatchTab>('overview');
  const [loads, setLoads] = useState<DispatchLoad[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [bids, setBids] = useState<(Bid & { driver?: Profile; load?: Load })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [loadFilter, setLoadFilter] = useState<LoadFilter>('all');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedLoad, setSelectedLoad] = useState<DispatchLoad | null>(null);
  const [assignModalLoad, setAssignModalLoad] = useState<DispatchLoad | null>(null);

  const fetchAll = useCallback(async () => {
    const isInitial = loads.length === 0 && loading;
    if (isInitial) setLoading(true);
    setError('');
    try {
      const [loadsRes, driversRes, bidsRes] = await Promise.all([
        supabase.from('loads').select('*, shipper:shipper_id(full_name, phone), driver:awarded_rider_id(full_name, phone, rating, vehicle_plate)').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'driver').order('created_at', { ascending: false }),
        supabase.from('bids').select('*, driver:rider_id(full_name, phone, rating, vehicle_plate, is_available), load:load_id(title, pickup_address, delivery_address, offer_price_ugx, status, urgency)').order('created_at', { ascending: false }).limit(50),
      ]);

      if (loadsRes.error) throw loadsRes.error;
      if (driversRes.error) throw driversRes.error;
      if (bidsRes.error) throw bidsRes.error;

      setLoads((loadsRes.data as unknown as DispatchLoad[]) ?? []);
      setDrivers((driversRes.data as Profile[]) ?? []);
      setBids((bidsRes.data as unknown as (Bid & { driver?: Profile; load?: Load })[]) ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(t); }
  }, [successMsg]);

  const filteredLoads = loads.filter(l => {
    if (loadFilter !== 'all' && l.status !== loadFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${l.title} ${l.pickup_address} ${l.delivery_address} ${l.cargo_description ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const stats = {
    activeHauls: loads.filter(l => l.status === 'active_haul').length,
    postedLoads: loads.filter(l => l.status === 'posted').length,
    awardedLoads: loads.filter(l => l.status === 'awarded').length,
    delivered: loads.filter(l => l.status === 'delivered' || l.status === 'completed').length,
    availableDrivers: drivers.filter(d => d.is_available).length,
    totalDrivers: drivers.length,
    pendingBids: bids.filter(b => b.status === 'pending').length,
    urgentLoads: loads.filter(l => (l.urgency === 'urgent' || l.urgency === 'critical') && (l.status === 'posted' || l.status === 'awarded')).length,
  };

  async function assignDriver(loadId: string, driverId: string) {
    setError('');
    setSuccessMsg('');
    try {
      const { error } = await supabase
        .from('loads')
        .update({ awarded_rider_id: driverId, status: 'awarded', updated_at: new Date().toISOString() })
        .eq('id', loadId);
      if (error) throw error;

      const { error: bidError } = await supabase
        .from('bids')
        .update({ status: 'accepted' })
        .eq('load_id', loadId)
        .eq('rider_id', driverId);
      if (bidError) throw bidError;

      const { error: rejectError } = await supabase
        .from('bids')
        .update({ status: 'rejected' })
        .eq('load_id', loadId)
        .neq('rider_id', driverId);
      if (rejectError) throw rejectError;

      setSuccessMsg('Driver assigned successfully');
      setAssignModalLoad(null);
      await fetchAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to assign driver');
    }
  }

  async function cancelLoad(loadId: string) {
    setError('');
    try {
      const { error } = await supabase
        .from('loads')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', loadId);
      if (error) throw error;
      setSuccessMsg('Load cancelled');
      setSelectedLoad(null);
      await fetchAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to cancel load');
    }
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="min-h-screen bg-[#030F0D]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
                <Radio size={20} className="text-teal-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Dispatch Dashboard</h1>
                <p className="text-slate-400 text-sm">{greeting}, {profile?.full_name?.split(' ')[0] ?? 'Dispatcher'}</p>
              </div>
            </div>
          </div>
          <button onClick={fetchAll} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-teal-900/30 hover:bg-teal-900/50 text-teal-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mb-6 p-1 bg-[#0a2420] border border-teal-900/40 rounded-xl w-fit overflow-x-auto">
          {([
            { key: 'overview', label: 'Overview', icon: Activity },
            { key: 'loads', label: 'Load Board', icon: Package },
            { key: 'hauls', label: 'Active Hauls', icon: Navigation },
            { key: 'drivers', label: 'Drivers', icon: Truck },
            { key: 'bids', label: 'Bids', icon: Gavel },
          ] as { key: DispatchTab; label: string; icon: React.ElementType }[]).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === t.key ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'}`}>
              <t.icon size={16} /> {t.label}
              {t.key === 'hauls' && stats.activeHauls > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold">{stats.activeHauls}</span>
              )}
              {t.key === 'bids' && stats.pendingBids > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">{stats.pendingBids}</span>
              )}
            </button>
          ))}
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm flex items-center gap-2">
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading dispatch data...</div>
        ) : (
          <>
            {activeTab === 'overview' && <OverviewTab stats={stats} loads={loads} bids={bids} navigate={navigate} />}
            {activeTab === 'loads' && (
              <LoadsTab
                loads={filteredLoads} search={search} setSearch={setSearch}
                loadFilter={loadFilter} setLoadFilter={setLoadFilter}
                onView={setSelectedLoad} onAssign={setAssignModalLoad} onCancel={cancelLoad}
              />
            )}
            {activeTab === 'hauls' && <HaulsTab loads={loads.filter(l => l.status === 'active_haul' || l.status === 'awarded')} navigate={navigate} />}
            {activeTab === 'drivers' && <DriversTab drivers={drivers} />}
            {activeTab === 'bids' && <BidsTab bids={bids} navigate={navigate} />}
          </>
        )}
      </div>

      {/* Load Detail Modal */}
      {selectedLoad && (
        <LoadDetailModal load={selectedLoad} onClose={() => setSelectedLoad(null)} onAssign={() => { setAssignModalLoad(selectedLoad); setSelectedLoad(null); }} onCancel={() => cancelLoad(selectedLoad.id)} />
      )}

      {/* Assign Driver Modal */}
      {assignModalLoad && (
        <AssignDriverModal load={assignModalLoad} drivers={drivers} onClose={() => setAssignModalLoad(null)} onAssign={assignDriver} />
      )}
    </div>
  );
}

// --- Overview Tab ---

function OverviewTab({ stats, loads, bids, navigate }: {
  stats: { activeHauls: number; postedLoads: number; awardedLoads: number; delivered: number; availableDrivers: number; totalDrivers: number; pendingBids: number; urgentLoads: number };
  loads: DispatchLoad[];
  bids: (Bid & { driver?: Profile; load?: Load })[];
  navigate: (path: string, params?: Record<string, string>) => void;
}) {
  const recentLoads = loads.slice(0, 5);
  const recentBids = bids.filter(b => b.status === 'pending').slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <OverviewStatCard icon={Navigation} label="Active Hauls" value={stats.activeHauls} sub={`${stats.awardedLoads} awarded`} color="text-orange-400" bg="bg-orange-500/10" />
        <OverviewStatCard icon={Package} label="Posted Loads" value={stats.postedLoads} sub={`${stats.urgentLoads} urgent`} color="text-teal-400" bg="bg-teal-500/10" />
        <OverviewStatCard icon={Truck} label="Available Drivers" value={stats.availableDrivers} sub={`${stats.totalDrivers} total`} color="text-blue-400" bg="bg-blue-500/10" />
        <OverviewStatCard icon={Gavel} label="Pending Bids" value={stats.pendingBids} sub={`${stats.delivered} delivered`} color="text-amber-400" bg="bg-amber-500/10" />
      </div>

      {/* Pipeline */}
      <div className="bg-[#0a2420] border border-teal-900/40 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Activity size={18} className="text-teal-400" /> Delivery Pipeline</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {STATUS_FLOW.map((s, i) => {
            const count = loads.filter(l => l.status === s).length;
            const colors: Record<string, string> = {
              posted: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
              awarded: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
              active_haul: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
              delivered: 'bg-green-500/15 border-green-500/30 text-green-400',
              completed: 'bg-slate-500/15 border-slate-500/30 text-slate-400',
            };
            return (
              <div key={s} className="flex items-center gap-2 shrink-0">
                <div className={`px-4 py-3 rounded-xl border ${colors[s]} min-w-[100px] text-center`}>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs mt-0.5">{STATUS_LABELS[s]}</p>
                </div>
                {i < STATUS_FLOW.length - 1 && <ArrowRight size={16} className="text-slate-600 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Loads */}
        <div className="bg-[#0a2420] border border-teal-900/40 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2"><Package size={18} className="text-teal-400" /> Recent Loads</h3>
          </div>
          {recentLoads.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No loads yet</p>
          ) : (
            <div className="space-y-3">
              {recentLoads.map(l => (
                <div key={l.id} onClick={() => navigate(`/load/${l.id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#030F0D] border border-teal-900/20 hover:border-teal-700/50 cursor-pointer transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{l.title || CARGO_LABELS[l.cargo_type as keyof typeof CARGO_LABELS]}</p>
                    <p className="text-slate-500 text-xs truncate">{l.pickup_address} → {l.delivery_address}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-teal-400 text-sm font-semibold">{formatUGX(l.offer_price_ugx)}</p>
                    <StatusBadge status={l.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Bids */}
        <div className="bg-[#0a2420] border border-teal-900/40 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2"><Gavel size={18} className="text-amber-400" /> Pending Bids</h3>
          </div>
          {recentBids.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No pending bids</p>
          ) : (
            <div className="space-y-3">
              {recentBids.map(b => (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#030F0D] border border-teal-900/20">
                  <div className="w-8 h-8 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 text-sm font-semibold shrink-0">
                    {b.driver?.full_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{b.driver?.full_name ?? 'Unknown driver'}</p>
                    <p className="text-slate-500 text-xs truncate">{b.load?.title || 'Load'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-teal-400 text-sm font-semibold">{formatUGX(b.bid_amount_ugx)}</p>
                    <p className="text-slate-500 text-xs">{b.eta_minutes}min ETA</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Loads Tab ---

function LoadsTab({ loads, search, setSearch, loadFilter, setLoadFilter, onView, onAssign, onCancel }: {
  loads: DispatchLoad[];
  search: string; setSearch: (v: string) => void;
  loadFilter: LoadFilter; setLoadFilter: (v: LoadFilter) => void;
  onView: (l: DispatchLoad) => void;
  onAssign: (l: DispatchLoad) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search loads by title, address..."
            className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <select value={loadFilter} onChange={e => setLoadFilter(e.target.value as LoadFilter)}
            className="appearance-none bg-[#0a2420] border border-teal-900/50 text-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-colors cursor-pointer">
            <option value="all">All Statuses</option>
            <option value="posted">Posted</option>
            <option value="awarded">Awarded</option>
            <option value="active_haul">Active Haul</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Load Cards */}
      {loads.length === 0 ? (
        <div className="bg-[#0a2420] border border-teal-900/40 rounded-2xl p-12 text-center text-slate-400 text-sm">No loads match your filters.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loads.map(l => (
            <div key={l.id} className="bg-[#0a2420] border border-teal-900/40 rounded-2xl p-5 hover:border-teal-700/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium text-sm truncate">{l.title || CARGO_LABELS[l.cargo_type as keyof typeof CARGO_LABELS]}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{CARGO_LABELS[l.cargo_type as keyof typeof CARGO_LABELS]}</p>
                </div>
                <StatusBadge status={l.status} />
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-teal-400 mt-1 shrink-0" />
                  <span className="text-slate-400 truncate">{l.pickup_address}</span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-orange-400 mt-1 shrink-0" />
                  <span className="text-slate-400 truncate">{l.delivery_address}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-teal-400 font-semibold text-sm">{formatUGX(l.offer_price_ugx)}</span>
                <UrgencyBadge urgency={l.urgency as Urgency} />
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => onView(l)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-900/40 hover:bg-teal-800/60 text-teal-300 rounded-lg text-xs font-medium transition-colors">
                  <Eye size={14} /> View
                </button>
                {(l.status === 'posted' || l.status === 'awarded') && (
                  <button onClick={() => onAssign(l)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-lg text-xs font-medium transition-colors">
                    <User size={14} /> Assign
                  </button>
                )}
                {l.status !== 'cancelled' && l.status !== 'completed' && (
                  <button onClick={() => onCancel(l.id)}
                    className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors">
                    <XCircle size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Hauls Tab ---

function HaulsTab({ loads, navigate }: {
  loads: DispatchLoad[];
  navigate: (path: string, params?: Record<string, string>) => void;
}) {
  if (loads.length === 0) {
    return <div className="bg-[#0a2420] border border-teal-900/40 rounded-2xl p-12 text-center text-slate-400 text-sm">No active or awarded hauls.</div>;
  }

  return (
    <div className="space-y-3">
      {loads.map(l => (
        <div key={l.id} className="bg-[#0a2420] border border-teal-900/40 rounded-2xl p-5 hover:border-teal-700/50 transition-colors">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${l.status === 'active_haul' ? 'bg-orange-500/15 border border-orange-500/30' : 'bg-blue-500/15 border border-blue-500/30'}`}>
                <Navigation size={18} className={l.status === 'active_haul' ? 'text-orange-400' : 'text-blue-400'} />
              </div>
              <div className="min-w-0">
                <p className="text-white font-medium text-sm truncate">{l.title || CARGO_LABELS[l.cargo_type as keyof typeof CARGO_LABELS]}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-slate-500 text-xs truncate">{l.pickup_address} → {l.delivery_address}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-teal-400 font-semibold text-sm">{formatUGX(l.offer_price_ugx)}</p>
                <StatusBadge status={l.status} />
              </div>
              {l.status === 'active_haul' && (
                <button onClick={() => navigate(`/haul/${l.id}`)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 rounded-lg text-xs font-medium transition-colors">
                  <Navigation size={14} /> Track Live
                </button>
              )}
              {l.status === 'awarded' && (
                <button onClick={() => navigate(`/load/${l.id}`)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-900/40 hover:bg-teal-800/60 text-teal-300 rounded-lg text-xs font-medium transition-colors">
                  <Eye size={14} /> View Load
                </button>
              )}
            </div>
          </div>

          {l.driver && (
            <div className="mt-3 pt-3 border-t border-teal-900/20 flex items-center gap-2 text-xs text-slate-400">
              <Truck size={12} className="text-blue-400" />
              <span className="text-white font-medium">{l.driver.full_name}</span>
              {l.driver.vehicle_plate && <span>· {l.driver.vehicle_plate}</span>}
              {l.driver.phone && <span>· {l.driver.phone}</span>}
              {l.driver.rating != null && (
                <span className="flex items-center gap-0.5"><Star size={10} className="text-amber-400" /> {l.driver.rating.toFixed(1)}</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Drivers Tab ---

function DriversTab({ drivers }: { drivers: Profile[] }) {
  if (drivers.length === 0) {
    return <div className="bg-[#0a2420] border border-teal-900/40 rounded-2xl p-12 text-center text-slate-400 text-sm">No drivers registered.</div>;
  }

  return (
    <div className="bg-[#0a2420] border border-teal-900/40 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-teal-900/40 text-left">
              <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Driver</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell">Contact</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Vehicle</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Rating</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Deliveries</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map(d => (
              <tr key={d.id} className="border-b border-teal-900/20 hover:bg-teal-900/10 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                        {d.full_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a2420] ${d.is_available ? 'bg-green-400' : 'bg-slate-500'}`} />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{d.full_name}</p>
                      <p className="text-slate-500 text-xs">{d.verification_status ?? 'pending'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                    <Phone size={12} className="text-slate-500" /> {d.phone ?? '—'}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-300 text-sm">
                  {d.vehicle_plate ? `${d.vehicle_plate} · ${d.vehicle_model ?? ''}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${d.is_available ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>
                    {d.is_available ? 'Available' : 'Offline'}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {d.rating != null ? (
                    <span className="flex items-center gap-1 text-sm">
                      <Star size={14} className="text-amber-400" /> <span className="text-white font-medium">{d.rating.toFixed(1)}</span>
                    </span>
                  ) : <span className="text-slate-500">—</span>}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-sm">
                  {d.total_deliveries ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Bids Tab ---

function BidsTab({ bids, navigate }: {
  bids: (Bid & { driver?: Profile; load?: Load })[];
  navigate: (path: string, params?: Record<string, string>) => void;
}) {
  const pendingBids = bids.filter(b => b.status === 'pending');
  const acceptedBids = bids.filter(b => b.status === 'accepted');
  const rejectedBids = bids.filter(b => b.status === 'rejected');

  if (bids.length === 0) {
    return <div className="bg-[#0a2420] border border-teal-900/40 rounded-2xl p-12 text-center text-slate-400 text-sm">No bids submitted yet.</div>;
  }

  const BID_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending:  { label: 'Pending',  color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    accepted: { label: 'Accepted', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
    rejected: { label: 'Rejected', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  };

  return (
    <div className="space-y-6">
      {/* Pending Bids */}
      {pendingBids.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Gavel size={18} className="text-amber-400" /> Pending Bids ({pendingBids.length})
          </h3>
          <div className="bg-[#0a2420] border border-amber-500/20 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-teal-900/40 text-left">
                    <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Driver</th>
                    <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Load</th>
                    <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Bid Amount</th>
                    <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell">ETA</th>
                    <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Message</th>
                    <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBids.map(b => (
                    <tr key={b.id} className="border-b border-teal-900/20 hover:bg-teal-900/10 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-semibold shrink-0">
                            {b.driver?.full_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{b.driver?.full_name ?? 'Unknown'}</p>
                            <p className="text-slate-500 text-xs">{b.driver?.phone ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <button onClick={() => navigate(`/load/${b.load_id}`)}
                          className="text-teal-400 hover:text-teal-300 text-sm font-medium truncate max-w-[180px] block">
                          {b.load?.title || CARGO_LABELS[(b.load?.cargo_type ?? 'other') as keyof typeof CARGO_LABELS]}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-teal-400 text-sm font-semibold">{formatUGX(b.bid_amount_ugx)}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-slate-400 text-sm">{b.eta_minutes} min</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-sm max-w-[200px] truncate">{b.message ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => navigate(`/load/${b.load_id}`)}
                          className="px-3 py-1.5 bg-teal-900/40 hover:bg-teal-800/60 text-teal-300 rounded-lg text-xs font-medium transition-colors">
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Recent Accepted/Rejected */}
      <div>
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-green-400" /> Resolved Bids
        </h3>
        <div className="bg-[#0a2420] border border-teal-900/40 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-teal-900/40 text-left">
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Driver</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Load</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Bid</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...acceptedBids, ...rejectedBids].slice(0, 20).map(b => {
                  const sc = BID_STATUS_CONFIG[b.status] ?? BID_STATUS_CONFIG.pending;
                  return (
                    <tr key={b.id} className="border-b border-teal-900/20 hover:bg-teal-900/10 transition-colors">
                      <td className="px-4 py-3 text-white text-sm">{b.driver?.full_name ?? 'Unknown'}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-400 text-sm truncate max-w-[180px]">{b.load?.title ?? '—'}</td>
                      <td className="px-4 py-3 text-teal-400 text-sm font-medium">{formatUGX(b.bid_amount_ugx)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.color}`}>{sc.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Load Detail Modal ---

function LoadDetailModal({ load, onClose, onAssign, onCancel }: {
  load: DispatchLoad;
  onClose: () => void;
  onAssign: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#0a2420] border border-teal-900/40 rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-[#0a2420] border-b border-teal-900/40 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
              <Package size={18} className="text-teal-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{load.title || CARGO_LABELS[load.cargo_type]}</h3>
              <p className="text-slate-400 text-xs">{CARGO_LABELS[load.cargo_type]} · {URGENCY_LABELS[load.urgency as Urgency]}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal-900/30 text-slate-400 hover:text-white transition-colors">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                <MapPin size={14} className="text-teal-400" />
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider">Pickup</p>
                <p className="text-white text-sm">{load.pickup_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                <MapPin size={14} className="text-orange-400" />
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider">Delivery</p>
                <p className="text-white text-sm">{load.delivery_address}</p>
              </div>
            </div>
          </div>

          {load.cargo_description && (
            <div className="p-4 rounded-xl bg-[#030F0D] border border-teal-900/30">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Cargo Description</p>
              <p className="text-slate-300 text-sm">{load.cargo_description}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[#030F0D] border border-teal-900/30 text-center">
              <p className="text-slate-500 text-xs">Price</p>
              <p className="text-teal-400 font-semibold text-sm mt-1">{formatUGX(load.offer_price_ugx)}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#030F0D] border border-teal-900/30 text-center">
              <p className="text-slate-500 text-xs">Weight</p>
              <p className="text-white font-semibold text-sm mt-1">{load.weight_kg ? `${load.weight_kg}kg` : '—'}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#030F0D] border border-teal-900/30 text-center">
              <p className="text-slate-500 text-xs">Status</p>
              <div className="mt-1 flex justify-center"><StatusBadge status={load.status} /></div>
            </div>
          </div>

          {load.driver && (
            <div className="p-4 rounded-xl bg-[#030F0D] border border-teal-900/30">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Assigned Driver</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 text-sm font-semibold">
                  {load.driver.full_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{load.driver.full_name}</p>
                  <p className="text-slate-500 text-xs">{load.driver.phone ?? '—'} {load.driver.vehicle_plate ? `· ${load.driver.vehicle_plate}` : ''}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            {(load.status === 'posted' || load.status === 'awarded') && (
              <button onClick={onAssign}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-xl text-sm font-semibold transition-colors">
                <User size={16} /> Assign Driver
              </button>
            )}
            {load.status !== 'cancelled' && load.status !== 'completed' && (
              <button onClick={onCancel}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-semibold transition-colors">
                <XCircle size={16} /> Cancel Load
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Assign Driver Modal ---

function AssignDriverModal({ load, drivers, onClose, onAssign }: {
  load: DispatchLoad;
  drivers: Profile[];
  onClose: () => void;
  onAssign: (loadId: string, driverId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const availableDrivers = drivers.filter(d => {
    if (!d.is_available) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${d.full_name} ${d.phone} ${d.vehicle_plate ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#0a2420] border border-teal-900/40 rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-[#0a2420] border-b border-teal-900/40 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-lg font-semibold text-white">Assign Driver</h3>
            <p className="text-slate-400 text-xs">{load.title || CARGO_LABELS[load.cargo_type]} · {formatUGX(load.offer_price_ugx)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal-900/30 text-slate-400 hover:text-white transition-colors">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search available drivers..."
              className="w-full bg-[#030F0D] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
          </div>

          {availableDrivers.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No available drivers found.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {availableDrivers.map(d => (
                <div key={d.id} onClick={() => setSelected(d.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selected === d.id ? 'bg-teal-500/15 border border-teal-500/40' : 'bg-[#030F0D] border border-teal-900/20 hover:border-teal-700/40'}`}>
                  <div className="w-9 h-9 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 text-sm font-semibold shrink-0">
                    {d.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{d.full_name}</p>
                    <p className="text-slate-500 text-xs">{d.phone} {d.vehicle_plate ? `· ${d.vehicle_plate}` : ''}</p>
                  </div>
                  {d.rating != null && (
                    <span className="flex items-center gap-1 text-xs">
                      <Star size={12} className="text-amber-400" /> {d.rating.toFixed(1)}
                    </span>
                  )}
                  {selected === d.id && <CheckCircle2 size={18} className="text-teal-400" />}
                </div>
              ))}
            </div>
          )}

          {selected && (
            <button onClick={() => onAssign(load.id, selected)}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-semibold transition-colors">
              <CheckCircle2 size={16} /> Confirm Assignment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Helper Components ---

function OverviewStatCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: React.ElementType; label: string; value: number; sub: string; color: string; bg: string;
}) {
  return (
    <div className="bg-[#0a2420] border border-teal-900/40 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
          <Icon size={18} className={color} />
        </div>
        <span className={`text-3xl font-bold ${color}`}>{value}</span>
      </div>
      <p className="text-white text-sm font-medium">{label}</p>
      <p className="text-slate-500 text-xs mt-0.5">{sub}</p>
    </div>
  );
}
