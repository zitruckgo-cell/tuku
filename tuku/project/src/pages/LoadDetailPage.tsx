import { useEffect, useState } from 'react';
import { ArrowLeft, Package, Clock, Phone, Star, Truck, CheckCircle, X, AlertTriangle, Gavel, MapPin, RotateCcw, Ticket, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import type { Load, Bid, Earning, LoadStop } from '../lib/types';
import { CARGO_LABELS, formatUGX } from '../lib/types';
import { StatusBadge, UrgencyBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

interface LoadDetailPageProps {
  loadId: string;
}

export function LoadDetailPage({ loadId }: LoadDetailPageProps) {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [load, setLoad] = useState<Load | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [earnings, setEarning] = useState<Earning | null>(null);
  const [stops, setStops] = useState<LoadStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [bidEta, setBidEta] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [bidError, setBidError] = useState('');
  const [adminStopForm, setAdminStopForm] = useState<{ stop_type: 'intermediate' | 'return'; address: string; ticket_label: string; contact_name: string; contact_phone: string; note: string }>({ stop_type: 'intermediate', address: '', ticket_label: '', contact_name: '', contact_phone: '', note: '' });
  const [adminStopLoading, setAdminStopLoading] = useState(false);

  async function fetchData() {
    const isInitial = !load && loading;
    if (isInitial) setLoading(true);
    setError('');
    try {
      const [loadRes, bidsRes, earningRes, stopsRes] = await Promise.all([
        supabase
          .from('loads')
          .select('*, shipper:shipper_id(id, full_name, phone, rating), awarded_rider:awarded_rider_id(id, full_name, phone, vehicle_plate, vehicle_model, rating, total_deliveries)')
          .eq('id', loadId)
          .maybeSingle(),
        supabase
          .from('bids')
          .select('*, rider:rider_id(id, full_name, phone, vehicle_plate, rating, total_deliveries)')
          .eq('load_id', loadId)
          .order('bid_amount_ugx', { ascending: true }),
        supabase
          .from('earnings')
          .select('*')
          .eq('load_id', loadId)
          .maybeSingle(),
        supabase
          .from('load_stops')
          .select('*')
          .eq('load_id', loadId)
          .order('stop_order', { ascending: true }),
      ]);
      if (loadRes.error) {
        console.error('LoadDetailPage fetch load error:', loadRes.error.message);
        setError(loadRes.error.message);
        setLoad(null);
      } else {
        setLoad(loadRes.data as Load);
      }
      if (bidsRes.error) {
        console.error('LoadDetailPage fetch bids error:', bidsRes.error.message);
      }
      setBids((bidsRes.data as Bid[]) ?? []);
      if (earningRes.error) {
        console.error('LoadDetailPage fetch earning error:', earningRes.error.message);
      }
      setEarning(earningRes.data as Earning);
      if (stopsRes.error) {
        console.error('LoadDetailPage fetch stops error:', stopsRes.error.message);
      }
      setStops((stopsRes.data as LoadStop[]) ?? []);
    } catch (err: any) {
      console.error('LoadDetailPage fetchData exception:', err);
      setError(err?.message || 'Failed to load this load. Please try again.');
      setLoad(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [loadId]);

  async function awardBid(bid: Bid) {
    setActionLoading(bid.id);
    setError('');
    // Accept this bid, reject others
    await supabase.from('bids').update({ status: 'rejected' }).eq('load_id', loadId).neq('id', bid.id);
    await supabase.from('bids').update({ status: 'accepted' }).eq('id', bid.id);
    const { error } = await supabase
      .from('loads')
      .update({ awarded_rider_id: bid.rider_id, status: 'awarded' })
      .eq('id', loadId);
    if (error) setError(error.message);
    else await fetchData();
    setActionLoading(null);
  }

  async function cancelLoad() {
    setActionLoading('cancel');
    const { error } = await supabase
      .from('loads')
      .update({ status: 'cancelled' })
      .eq('id', loadId);
    if (error) setError(error.message);
    else navigate('/shipper');
    setActionLoading(null);
  }

  async function submitBid() {
    if (!profile) return;
    setBidSubmitting(true);
    setBidError('');
    const amount = parseInt(bidAmount, 10);
    if (!amount || amount <= 0) {
      setBidError('Enter a valid bid amount.');
      setBidSubmitting(false);
      return;
    }
    const { error } = await supabase.from('bids').insert({
      load_id: loadId,
      rider_id: profile.id,
      bid_amount_ugx: amount,
      eta_minutes: bidEta ? parseInt(bidEta, 10) : null,
      message: bidMessage || null,
      status: 'pending',
    });
    if (error) {
      setBidError(error.message);
    } else {
      setShowBidForm(false);
      setBidAmount('');
      setBidEta('');
      setBidMessage('');
      await fetchData();
    }
    setBidSubmitting(false);
  }

  async function retractBid(bidId: string) {
    setActionLoading(`retract-${bidId}`);
    const { error } = await supabase.from('bids').delete().eq('id', bidId);
    if (error) setError(error.message);
    else await fetchData();
    setActionLoading(null);
  }

  async function markCompleted() {
    setActionLoading('complete');
    const { error } = await supabase
      .from('loads')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', loadId);
    if (error) setError(error.message);
    else await fetchData();
    setActionLoading(null);
  }

  async function adminAddStop() {
    if (!adminStopForm.address.trim()) return;
    setAdminStopLoading(true);
    const maxOrder = stops.length > 0 ? Math.max(...stops.map(s => s.stop_order)) : 0;
    const { error } = await supabase.from('load_stops').insert({
      load_id: loadId,
      stop_order: maxOrder + 1,
      stop_type: adminStopForm.stop_type,
      address: adminStopForm.address.trim(),
      ticket_label: adminStopForm.ticket_label.trim() || null,
      contact_name: adminStopForm.contact_name.trim() || null,
      contact_phone: adminStopForm.contact_phone.trim() || null,
      note: adminStopForm.note.trim() || null,
    });
    setAdminStopLoading(false);
    if (error) { setError(error.message); return; }
    setAdminStopForm({ stop_type: 'intermediate', address: '', ticket_label: '', contact_name: '', contact_phone: '', note: '' });
    await fetchData();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!load) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-3">{error || 'Load not found'}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => fetchData()} className="text-teal-400 hover:text-teal-300">Try Again</button>
            <span className="text-slate-600">·</span>
            <button onClick={() => navigate(profile?.role === 'shipper' ? '/shipper' : '/driver')} className="text-orange-400 hover:text-orange-300">Go back</button>
          </div>
        </div>
      </div>
    );
  }

  const isShipper = profile?.id === load.shipper_id;
  const isRider = profile?.id === load.awarded_rider_id;
  const isAdmin = profile?.role === 'admin';
  const myBid = bids.find(b => b.rider_id === profile?.id);
  const acceptedBid = bids.find(b => b.status === 'accepted');
  const pendingBids = bids.filter(b => b.status === 'pending');
  const canTrack = ['active_haul', 'delivered'].includes(load.status) && (isShipper || isRider);

  const mapSrc = load.pickup_lat && load.pickup_lng
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${load.pickup_lng - 0.02},${load.pickup_lat - 0.02},${(load.delivery_lng ?? load.pickup_lng) + 0.02},${(load.delivery_lat ?? load.pickup_lat) + 0.02}&layer=mapnik&marker=${load.pickup_lat},${load.pickup_lng}`
    : `https://www.openstreetmap.org/export/embed.html?bbox=32.55,0.29,32.62,0.37&layer=mapnik`;

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(isShipper ? '/shipper' : isAdmin ? '/admin' : '/driver')}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{load.title || CARGO_LABELS[load.cargo_type]}</h1>
            <p className="text-slate-400 text-sm mt-0.5">Load #{load.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <StatusBadge status={load.status} />
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Track Live Banner */}
        {canTrack && (
          <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-orange-300">
              <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-sm font-medium">Delivery is in progress</span>
            </div>
            <button
              onClick={() => navigate(`/haul/${load.id}`)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Track Live →
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left — Details */}
          <div className="space-y-5">
            {/* Cargo Details */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-4">Shipment Details</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Package size={16} className="text-orange-400 flex-shrink-0" />
                  <div>
                    <p className="text-slate-400 text-xs">Cargo Type</p>
                    <p className="text-white text-sm font-medium">{CARGO_LABELS[load.cargo_type]}</p>
                  </div>
                </div>
                {load.cargo_description && (
                  <div className="flex items-start gap-3">
                    <div className="w-4 flex-shrink-0" />
                    <div>
                      <p className="text-slate-400 text-xs">Description</p>
                      <p className="text-white text-sm">{load.cargo_description}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-orange-400 flex-shrink-0" />
                  <div>
                    <p className="text-slate-400 text-xs">Urgency</p>
                    <UrgencyBadge urgency={load.urgency} />
                  </div>
                </div>
              </div>
            </div>

            {/* Locations */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-4">Route{stops.length > 0 && ` (${stops.length + 2} points)`}</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-slate-400 text-xs">Pickup</p>
                    <p className="text-white text-sm">{load.pickup_address}</p>
                    {load.pickup_lat && <p className="text-slate-500 text-xs mt-0.5">{load.pickup_lat.toFixed(4)}°N, {load.pickup_lng?.toFixed(4)}°E</p>}
                  </div>
                </div>
                {stops.filter(s => s.stop_type === 'intermediate').map((stop) => (
                  <div key={stop.id}>
                    <div className="ml-1 border-l-2 border-dashed border-slate-700 h-4" />
                    <div className="flex items-start gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${stop.is_completed ? 'bg-green-400' : 'bg-sky-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-slate-400 text-xs">Stop {stop.stop_order}</p>
                          {stop.is_completed && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-500/15 text-green-400 border border-green-500/30">
                              Completed
                            </span>
                          )}
                        </div>
                        <p className="text-white text-sm">{stop.address}</p>
                        {stop.lat && <p className="text-slate-500 text-xs mt-0.5">{stop.lat.toFixed(4)}°N, {stop.lng?.toFixed(4)}°E</p>}
                        {(stop.contact_name || stop.contact_phone) && (
                          <p className="text-slate-400 text-xs mt-1">
                            {stop.contact_name && <span>{stop.contact_name}</span>}
                            {stop.contact_name && stop.contact_phone && <span> · </span>}
                            {stop.contact_phone && <a href={`tel:${stop.contact_phone}`} className="text-sky-400 hover:text-sky-300">{stop.contact_phone}</a>}
                          </p>
                        )}
                        {stop.note && <p className="text-slate-500 text-xs mt-1 italic">{stop.note}</p>}
                        {isRider && !stop.is_completed && load.status === 'active_haul' && (
                          <button
                            onClick={async () => {
                              setActionLoading(`stop-${stop.id}`);
                              await supabase.from('load_stops').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', stop.id);
                              setActionLoading(null);
                              fetchData();
                            }}
                            disabled={actionLoading === `stop-${stop.id}`}
                            className="mt-2 px-3 py-1.5 bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-medium rounded-lg hover:bg-sky-500/20 transition-colors"
                          >
                            {actionLoading === `stop-${stop.id}` ? 'Marking...' : 'Mark as Visited'}
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={async () => {
                              setActionLoading(`del-stop-${stop.id}`);
                              await supabase.from('load_stops').delete().eq('id', stop.id);
                              setActionLoading(null);
                              fetchData();
                            }}
                            disabled={actionLoading === `del-stop-${stop.id}`}
                            className="mt-2 ml-2 px-2 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/20 transition-colors inline-flex items-center gap-1"
                          >
                            <Trash2 size={12} /> {actionLoading === `del-stop-${stop.id}` ? '...' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="ml-1 border-l-2 border-dashed border-slate-700 h-4" />
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-slate-400 text-xs">Delivery</p>
                    <p className="text-white text-sm">{load.delivery_address}</p>
                    {load.delivery_lat && <p className="text-slate-500 text-xs mt-0.5">{load.delivery_lat.toFixed(4)}°N, {load.delivery_lng?.toFixed(4)}°E</p>}
                  </div>
                </div>
                {stops.filter(s => s.stop_type === 'return').length > 0 && (
                  <div className="pt-2">
                    <div className="flex items-center gap-2 mb-3">
                      <RotateCcw size={14} className="text-amber-400" />
                      <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Return Tickets</p>
                    </div>
                  </div>
                )}
                {stops.filter(s => s.stop_type === 'return').map((stop) => (
                  <div key={stop.id}>
                    <div className="ml-1 border-l-2 border-dashed border-amber-500/30 h-4" />
                    <div className="flex items-start gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${stop.is_completed ? 'bg-green-400' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-amber-400 text-xs font-medium">Return {stop.stop_order}</p>
                          {stop.is_completed && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-500/15 text-green-400 border border-green-500/30">
                              Collected
                            </span>
                          )}
                        </div>
                        <p className="text-white text-sm">{stop.address}</p>
                        {stop.ticket_label && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Ticket size={11} className="text-amber-400 flex-shrink-0" />
                            <p className="text-amber-300 text-xs">Collect: {stop.ticket_label}</p>
                          </div>
                        )}
                        {stop.lat && <p className="text-slate-500 text-xs mt-0.5">{stop.lat.toFixed(4)}°N, {stop.lng?.toFixed(4)}°E</p>}
                        {(stop.contact_name || stop.contact_phone) && (
                          <p className="text-slate-400 text-xs mt-1">
                            {stop.contact_name && <span>{stop.contact_name}</span>}
                            {stop.contact_name && stop.contact_phone && <span> · </span>}
                            {stop.contact_phone && <a href={`tel:${stop.contact_phone}`} className="text-sky-400 hover:text-sky-300">{stop.contact_phone}</a>}
                          </p>
                        )}
                        {stop.note && <p className="text-slate-500 text-xs mt-1 italic">{stop.note}</p>}
                        {isRider && !stop.is_completed && (load.status === 'active_haul' || load.status === 'delivered') && (
                          <button
                            onClick={async () => {
                              setActionLoading(`stop-${stop.id}`);
                              await supabase.from('load_stops').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', stop.id);
                              setActionLoading(null);
                              fetchData();
                            }}
                            disabled={actionLoading === `stop-${stop.id}`}
                            className="mt-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-500/20 transition-colors"
                          >
                            {actionLoading === `stop-${stop.id}` ? 'Marking...' : 'Mark as Collected'}
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={async () => {
                              setActionLoading(`del-stop-${stop.id}`);
                              await supabase.from('load_stops').delete().eq('id', stop.id);
                              setActionLoading(null);
                              fetchData();
                            }}
                            disabled={actionLoading === `del-stop-${stop.id}`}
                            className="mt-2 ml-2 px-2 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/20 transition-colors inline-flex items-center gap-1"
                          >
                            <Trash2 size={12} /> {actionLoading === `del-stop-${stop.id}` ? '...' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Map */}
            {load.pickup_lat && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                <iframe
                  src={mapSrc}
                  width="100%"
                  height="220"
                  className="border-0"
                  title="Route Map"
                />
              </div>
            )}

            {/* Admin — Manage Stops */}
            {isAdmin && (
              <div className="bg-slate-800 border border-blue-500/30 rounded-2xl p-5">
                <h3 className="text-blue-400 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Plus size={14} /> Admin: Manage Stops & Return Tickets
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAdminStopForm(f => ({ ...f, stop_type: 'intermediate' }))}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        adminStopForm.stop_type === 'intermediate'
                          ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                          : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      Intermediate Stop
                    </button>
                    <button
                      onClick={() => setAdminStopForm(f => ({ ...f, stop_type: 'return' }))}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        adminStopForm.stop_type === 'return'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      Return Ticket
                    </button>
                  </div>
                  <input
                    type="text"
                    value={adminStopForm.address}
                    onChange={e => setAdminStopForm(f => ({ ...f, address: e.target.value }))}
                    placeholder={adminStopForm.stop_type === 'return' ? 'Return stop address' : 'Intermediate stop address'}
                    className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  {adminStopForm.stop_type === 'return' && (
                    <input
                      type="text"
                      value={adminStopForm.ticket_label}
                      onChange={e => setAdminStopForm(f => ({ ...f, ticket_label: e.target.value }))}
                      placeholder="What to collect, e.g. Signed delivery receipt"
                      className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                    />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={adminStopForm.contact_name}
                      onChange={e => setAdminStopForm(f => ({ ...f, contact_name: e.target.value }))}
                      placeholder="Contact name (optional)"
                      className="bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none transition-colors"
                    />
                    <input
                      type="text"
                      value={adminStopForm.contact_phone}
                      onChange={e => setAdminStopForm(f => ({ ...f, contact_phone: e.target.value }))}
                      placeholder="Contact phone (optional)"
                      className="bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <input
                    type="text"
                    value={adminStopForm.note}
                    onChange={e => setAdminStopForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="Note for this stop (optional)"
                    className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-2 text-xs focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={adminAddStop}
                    disabled={adminStopLoading || !adminStopForm.address.trim()}
                    className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/50 text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> {adminStopLoading ? 'Adding...' : 'Add Stop'}
                  </button>
                </div>
                {stops.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Existing Stops ({stops.length})</p>
                    {stops.map(stop => (
                      <div key={stop.id} className="flex items-center gap-2 p-2 bg-slate-900 rounded-lg">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${stop.is_completed ? 'bg-green-400' : stop.stop_type === 'return' ? 'bg-amber-400' : 'bg-sky-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${stop.is_completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                            {stop.stop_type === 'return' && <RotateCcw size={10} className="inline mr-1 text-amber-400" />}
                            {stop.address}
                          </p>
                          {stop.ticket_label && <p className="text-amber-300 text-xs truncate">Collect: {stop.ticket_label}</p>}
                        </div>
                        {stop.is_completed ? (
                          <button
                            onClick={async () => {
                              setActionLoading(`reset-${stop.id}`);
                              await supabase.from('load_stops').update({ is_completed: false, completed_at: null }).eq('id', stop.id);
                              setActionLoading(null);
                              fetchData();
                            }}
                            disabled={actionLoading === `reset-${stop.id}`}
                            className="text-xs px-2 py-1 bg-slate-700 text-slate-400 rounded-lg hover:text-slate-200 transition-colors"
                          >
                            {actionLoading === `reset-${stop.id}` ? '...' : 'Reset'}
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              setActionLoading(`complete-${stop.id}`);
                              await supabase.from('load_stops').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', stop.id);
                              setActionLoading(null);
                              fetchData();
                            }}
                            disabled={actionLoading === `complete-${stop.id}`}
                            className="text-xs px-2 py-1 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors"
                          >
                            {actionLoading === `complete-${stop.id}` ? '...' : 'Done'}
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            setActionLoading(`del-stop-${stop.id}`);
                            await supabase.from('load_stops').delete().eq('id', stop.id);
                            setActionLoading(null);
                            fetchData();
                          }}
                          disabled={actionLoading === `del-stop-${stop.id}`}
                          className="p-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                          aria-label="Delete stop"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pricing */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-widest">Offered Price</p>
                  <p className="text-2xl font-bold text-orange-400 mt-1">{formatUGX(load.offer_price_ugx)}</p>
                </div>
                {acceptedBid && acceptedBid.bid_amount_ugx !== load.offer_price_ugx && (
                  <div className="text-right">
                    <p className="text-slate-400 text-xs">Accepted Bid</p>
                    <p className="text-xl font-bold text-green-400">{formatUGX(acceptedBid.bid_amount_ugx)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Earnings Breakdown */}
            {earning && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-4">Earnings Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Total Amount</span>
                    <span className="text-white font-semibold">{formatUGX(earning.total_amount_ugx)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Marketplace Fee (10%)</span>
                    <span className="text-red-400 font-medium">−{formatUGX(earning.marketplace_fee_ugx)}</span>
                  </div>
                  <div className="border-t border-slate-700 pt-3 flex items-center justify-between">
                    <span className="text-white text-sm font-medium">Driver Earnings (90%)</span>
                    <span className="text-teal-400 font-bold text-xl">{formatUGX(earning.driver_earnings_ugx)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      earning.status === 'paid' ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}>
                      {earning.status === 'paid' ? 'Paid' : 'Pending Payout'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Shipper / Rider Info */}
            {(load.shipper || load.awarded_rider) && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
                <h3 className="text-slate-400 text-xs uppercase tracking-widest">Contacts</h3>
                {load.shipper && !isShipper && (
                  <PersonCard label="Shipper" person={load.shipper} />
                )}
                {load.awarded_rider && (
                  <PersonCard label="Assigned Driver" person={load.awarded_rider} showVehicle />
                )}
              </div>
            )}

            {/* Actions for shipper */}
            {isShipper && (
              <div className="space-y-2">
                {load.status === 'delivered' && (
                  <button
                    onClick={markCompleted}
                    disabled={actionLoading === 'complete'}
                    className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:bg-green-500/50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={18} /> Confirm Delivery & Close
                  </button>
                )}
                {['posted', 'awarded'].includes(load.status) && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    disabled={actionLoading === 'cancel'}
                    className="w-full py-2.5 bg-slate-800 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/30 text-slate-400 hover:text-red-400 font-medium rounded-xl transition-all text-sm"
                  >
                    Cancel Load
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right — Bids */}
          {isShipper && (
            <div>
              <h3 className="text-white font-semibold mb-4">
                Bids ({pendingBids.length} pending)
              </h3>
              {bids.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center">
                  <Truck size={28} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No bids yet</p>
                  <p className="text-slate-600 text-xs mt-1">Drivers will start bidding soon.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bids.map(bid => (
                    <div
                      key={bid.id}
                      className={`bg-slate-800 border rounded-2xl p-4 transition-all ${
                        bid.status === 'accepted'
                          ? 'border-green-500/40 bg-green-500/5'
                          : bid.status === 'rejected'
                          ? 'border-slate-700 opacity-50'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-sm font-bold">
                            {bid.rider?.full_name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white text-sm font-semibold">{bid.rider?.full_name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Star size={10} className="text-yellow-400 fill-yellow-400" />
                              <span className="text-slate-400 text-xs">{bid.rider?.rating?.toFixed(1)} · {bid.rider?.total_deliveries} deliveries</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-green-400 font-bold text-lg">{formatUGX(bid.bid_amount_ugx)}</p>
                          {bid.eta_minutes && (
                            <p className="text-slate-400 text-xs mt-0.5">ETA: {bid.eta_minutes} min</p>
                          )}
                        </div>
                      </div>
                      {bid.message && (
                        <p className="text-slate-400 text-xs bg-slate-700/50 rounded-lg p-2 mb-3">{bid.message}</p>
                      )}
                      {bid.status === 'accepted' ? (
                        <div className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
                          <CheckCircle size={14} /> Awarded
                        </div>
                      ) : bid.status === 'pending' && load.status === 'posted' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => awardBid(bid)}
                            disabled={actionLoading === bid.id}
                            className="flex-1 py-2 bg-orange-500 hover:bg-orange-400 disabled:bg-orange-500/50 text-white text-sm font-semibold rounded-lg transition-colors"
                          >
                            {actionLoading === bid.id ? 'Awarding...' : 'Award This Driver'}
                          </button>
                          <a
                            href={`tel:${bid.rider?.phone}`}
                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-slate-300"
                            onClick={e => e.stopPropagation()}
                          >
                            <Phone size={16} />
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Driver view — place a bid */}
          {!isShipper && !myBid && load.status === 'posted' && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-4">Place a Bid</h3>
              {!showBidForm ? (
                <button
                  onClick={() => { setShowBidForm(true); setBidAmount(String(load.offer_price_ugx)); setBidError(''); }}
                  className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Gavel size={16} /> Place a Bid
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">Your Bid (UGX)</label>
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={String(load.offer_price_ugx)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">ETA (minutes, optional)</label>
                    <input
                      type="number"
                      value={bidEta}
                      onChange={(e) => setBidEta(e.target.value)}
                      placeholder="30"
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">Message (optional)</label>
                    <textarea
                      value={bidMessage}
                      onChange={(e) => setBidMessage(e.target.value)}
                      placeholder="Any notes for the shipper..."
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none resize-none"
                    />
                  </div>
                  {bidError && <p className="text-red-400 text-xs">{bidError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowBidForm(false)}
                      className="flex-1 py-2.5 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitBid}
                      disabled={bidSubmitting}
                      className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all text-sm disabled:opacity-50"
                    >
                      {bidSubmitting ? 'Submitting...' : 'Submit Bid'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Driver view — bid status */}
          {!isShipper && myBid && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-4">Your Bid</h3>
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-bold text-2xl">{formatUGX(myBid.bid_amount_ugx)}</p>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${
                  myBid.status === 'accepted' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  myBid.status === 'rejected' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                  'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {myBid.status === 'accepted' ? <><CheckCircle size={12} /> Accepted</> : myBid.status === 'rejected' ? <><X size={12} /> Rejected</> : <><Clock size={12} /> Pending</>}
                </span>
              </div>
              {myBid.eta_minutes && <p className="text-slate-400 text-sm">Estimated: {myBid.eta_minutes} minutes</p>}
              {myBid.message && <p className="text-slate-400 text-sm mt-2 bg-slate-700/50 rounded-lg p-2">{myBid.message}</p>}
              {myBid.status === 'accepted' && (
                <button
                  onClick={() => navigate(`/haul/${load.id}`)}
                  className="w-full mt-4 py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl transition-all"
                >
                  Start Haul →
                </button>
              )}
              {myBid.status === 'pending' && load.status === 'posted' && (
                <button
                  onClick={() => retractBid(myBid.id)}
                  disabled={actionLoading === `retract-${myBid.id}`}
                  className="w-full mt-4 py-2.5 bg-slate-700 hover:bg-red-500/20 hover:text-red-400 text-slate-300 text-sm rounded-xl border border-slate-600 hover:border-red-500/30 transition-all disabled:opacity-50"
                >
                  {actionLoading === `retract-${myBid.id}` ? 'Retracting...' : 'Retract Bid'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Cancel Modal */}
      {confirmDelete && (
        <Modal title="Cancel this load?" onClose={() => setConfirmDelete(false)} size="sm">
          <p className="text-slate-400 text-sm mb-5">This will cancel the load and notify any bidding drivers. This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors text-sm">
              Keep Load
            </button>
            <button
              onClick={() => { setConfirmDelete(false); cancelLoad(); }}
              className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-xl transition-all text-sm"
            >
              Cancel Load
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PersonCard({ label, person, showVehicle }: { label: string; person: any; showVehicle?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {person.full_name?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-slate-500 text-xs">{label}</p>
          <p className="text-white text-sm font-medium">{person.full_name}</p>
          {showVehicle && person.vehicle_plate && (
            <p className="text-slate-400 text-xs">🛺 {person.vehicle_plate} {person.vehicle_model ? `· ${person.vehicle_model}` : ''}</p>
          )}
          <div className="flex items-center gap-1 mt-0.5">
            <Star size={10} className="text-yellow-400 fill-yellow-400" />
            <span className="text-slate-400 text-xs">{(person.rating ?? 5).toFixed(1)}</span>
          </div>
        </div>
      </div>
      <a
        href={`tel:${person.phone}`}
        className="p-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
      >
        <Phone size={16} />
      </a>
    </div>
  );
}
