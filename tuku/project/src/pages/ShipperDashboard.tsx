import { useEffect, useState } from 'react';
import { Plus, Package, Truck, CheckCircle, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import type { Load, LoadStatus } from '../lib/types';
import { STATUS_LABELS, formatUGX } from '../lib/types';
import { LoadCard } from '../components/LoadCard';
import { StatusBadge } from '../components/StatusBadge';

const FILTERS = [
  { key: 'all', label: 'All Loads' },
  { key: 'posted', label: 'Available' },
  { key: 'awarded', label: 'Assigned' },
  { key: 'active_haul', label: 'Active Haul' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
];

export function ShipperDashboard() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  async function fetchLoads() {
    const isInitial = loads.length === 0 && loading;
    if (isInitial) setLoading(true);
    const { data } = await supabase
      .from('loads')
      .select('*, awarded_rider:awarded_rider_id(id, full_name, phone, vehicle_plate, rating)')
      .eq('shipper_id', profile!.id)
      .order('created_at', { ascending: false });
    setLoads((data as Load[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (profile) fetchLoads();
  }, [profile?.id]);

  const filtered = filter === 'all' ? loads : loads.filter(l => l.status === filter);

  const stats = {
    total: loads.length,
    active: loads.filter(l => l.status === 'active_haul').length,
    pending: loads.filter(l => ['posted', 'awarded'].includes(l.status)).length,
    completed: loads.filter(l => l.status === 'completed').length,
    totalSpend: loads.filter(l => l.status === 'completed').reduce((s, l) => s + (l.offer_price_ugx ?? 0), 0),
  };

  return (
    <div className="min-h-screen bg-[#030F0D]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Good {getGreeting()}, <span className="text-teal-400">{profile?.full_name.split(' ')[0]}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Manage your shipments and track deliveries</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchLoads}
              className="p-2.5 rounded-xl bg-[#0a2420] border border-teal-900/40 text-slate-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => navigate('/load/create')}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-teal-500/20"
            >
              <Plus size={18} /> Post a Load
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Package, label: 'Total Loads', value: stats.total, color: 'text-teal-400', bg: 'bg-teal-500/10' },
            { icon: Truck, label: 'Active Hauls', value: stats.active, color: 'text-teal-300', bg: 'bg-teal-400/10' },
            { icon: Clock, label: 'Pending', value: stats.pending, color: 'text-teal-400', bg: 'bg-teal-500/10' },
            { icon: TrendingUp, label: 'Total Spent', value: formatUGX(stats.totalSpend), color: 'text-teal-300', bg: 'bg-teal-400/10' },
          ].map((s, i) => (
            <div key={i} className="card p-5">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon size={20} className={s.color} />
              </div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-slate-400 text-sm mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Active Hauls Banner */}
        {stats.active > 0 && (
          <div className="mb-6 p-4 bg-teal-500/10 border border-teal-500/20 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <p className="text-teal-300 font-medium text-sm">
                {stats.active} delivery {stats.active === 1 ? 'is' : 'are'} currently in progress
              </p>
            </div>
            <button
              onClick={() => setFilter('active_haul')}
              className="text-teal-400 hover:text-teal-300 text-sm font-medium"
            >
              Track Now →
            </button>
          </div>
        )}

        {/* Status Pipeline */}
        <div className="mb-8 bg-[#0a2420]/70 border border-teal-900/40 rounded-2xl p-5">
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-4">Delivery Pipeline</p>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {(['posted', 'awarded', 'active_haul', 'delivered', 'completed'] as const).map((s, i, arr) => {
              const count = loads.filter(l => l.status === s).length;
              return (
                <div key={s} className="flex items-center">
                  <button
                    onClick={() => setFilter(s)}
                    className={`flex flex-col items-center px-4 py-2 rounded-xl transition-all flex-shrink-0 ${
                      filter === s ? 'bg-teal-900/50 border border-teal-800/60' : 'hover:bg-teal-900/20'
                    }`}
                  >
                    <span className={`text-xl font-bold ${count > 0 ? 'text-white' : 'text-slate-600'}`}>{count}</span>
                    <StatusBadge status={s} />
                  </button>
                  {i < arr.length - 1 && (
                    <div className="w-6 h-px bg-teal-900/50 flex-shrink-0 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f.key
                  ? 'bg-teal-500 text-white'
                  : 'bg-[#0a2420] border border-teal-900/40 text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
              {f.key !== 'all' && (
                <span className="ml-1.5 opacity-60">
                  {loads.filter(l => l.status === f.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loads */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="flex gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-900/30" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-teal-900/30 rounded w-3/4" />
                    <div className="h-3 bg-teal-900/30 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-teal-900/30 rounded" />
                  <div className="h-3 bg-teal-900/30 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl card flex items-center justify-center mx-auto mb-4">
              {filter === 'all' ? <Package size={28} className="text-slate-600" /> : <CheckCircle size={28} className="text-slate-600" />}
            </div>
            <p className="text-slate-400 font-medium mb-1">
              {filter === 'all' ? 'No loads yet' : `No ${STATUS_LABELS[filter as LoadStatus] ?? filter} loads`}
            </p>
            <p className="text-slate-600 text-sm mb-6">
              {filter === 'all' ? 'Post your first load to get started.' : 'Nothing in this status yet.'}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => navigate('/load/create')}
                className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all"
              >
                Post Your First Load
              </button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(load => (
              <div key={load.id}>
                <LoadCard load={load} />
                {load.status === 'active_haul' && (
                  <button
                    onClick={() => navigate(`/haul/${load.id}`)}
                    className="w-full mt-2 py-2 text-sm font-medium text-teal-400 hover:text-teal-300 bg-teal-500/5 hover:bg-teal-500/10 border border-teal-500/20 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Truck size={14} /> Track Live
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
