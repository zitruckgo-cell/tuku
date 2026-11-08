import { useEffect, useState } from 'react';
import { ArrowLeft, Phone, Navigation, CheckCircle, Camera, Truck, MessageSquare, Zap, AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import type { Load, StatusUpdate, RiderLocation, ProofOfDelivery, LoadStop } from '../lib/types';
import { CARGO_LABELS, HAUL_STATUS_LABELS, formatUGX } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { sendDeliveryEmail } from '../lib/email';

interface ActiveHaulPageProps {
  loadId: string;
}

const HAUL_STEPS: { key: StatusUpdate['status']; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'en_route_to_pickup', label: 'En Route to Pickup', icon: Navigation, desc: 'Rider heading to pickup location' },
  { key: 'picked_up', label: 'Picked Up', icon: CheckCircle, desc: 'Item collected from sender' },
  { key: 'en_route_to_delivery', label: 'En Route to Delivery', icon: Truck, desc: 'Rider delivering to recipient' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle, desc: 'Delivered to recipient' },
];

export function ActiveHaulPage({ loadId }: ActiveHaulPageProps) {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [load, setLoad] = useState<Load | null>(null);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [riderLoc, setRiderLoc] = useState<RiderLocation | null>(null);
  const [pod, setPod] = useState<ProofOfDelivery | null>(null);
  const [stops, setStops] = useState<LoadStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPodModal, setShowPodModal] = useState(false);
  const [podForm, setPodForm] = useState({ recipient_name: '', notes: '' });
  const [error, setError] = useState('');

  const isRider = profile?.id === load?.awarded_rider_id;
  const isShipper = profile?.id === load?.shipper_id;

  const latestHaulStatus = statusUpdates[statusUpdates.length - 1]?.status;
  const currentStepIdx = HAUL_STEPS.findIndex(s => s.key === latestHaulStatus);

  async function fetchData() {
    const isInitial = !load && loading;
    if (isInitial) setLoading(true);
    const [loadRes, updatesRes, locRes, podRes, stopsRes] = await Promise.all([
      supabase.from('loads')
        .select('*, shipper:shipper_id(id, full_name, phone), awarded_rider:awarded_rider_id(id, full_name, phone, vehicle_plate, vehicle_model, rating)')
        .eq('id', loadId)
        .maybeSingle(),
      supabase.from('status_updates')
        .select('*, by_user:by_user_id(id, full_name)')
        .eq('load_id', loadId)
        .order('created_at', { ascending: true }),
      supabase.from('rider_locations')
        .select('*')
        .eq('load_id', loadId)
        .maybeSingle(),
      supabase.from('proof_of_delivery')
        .select('*')
        .eq('load_id', loadId)
        .maybeSingle(),
      supabase.from('load_stops')
        .select('*')
        .eq('load_id', loadId)
        .order('stop_order', { ascending: true }),
    ]);
    const loadData = loadRes.data as Load;
    setLoad(loadData);
    setStatusUpdates((updatesRes.data as StatusUpdate[]) ?? []);
    setRiderLoc(locRes.data as RiderLocation ?? null);
    setPod(podRes.data as ProofOfDelivery ?? null);
    setStops((stopsRes.data as LoadStop[]) ?? []);
    setLoading(false);
  }

  // Realtime subscription for rider location + status updates
  useEffect(() => {
    fetchData();

    const locSub = supabase.channel('rider-loc-' + loadId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_locations', filter: `load_id=eq.${loadId}` },
        (payload) => { setRiderLoc(payload.new as RiderLocation); })
      .subscribe();

    const statusSub = supabase.channel('status-updates-' + loadId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'status_updates', filter: `load_id=eq.${loadId}` },
        () => { fetchData(); })
      .subscribe();

    return () => {
      supabase.removeChannel(locSub);
      supabase.removeChannel(statusSub);
    };
  }, [loadId]);

  // Rider: start haul / update GPS / advance status
  async function startHaul() {
    if (!profile || !load) return;
    setActionLoading('start');
    setError('');

    // Get actual GPS if available, else use simulated Kampala coords
    let lat = load.pickup_lat ?? 0.3163;
    let lng = load.pickup_lng ?? 32.5819;

    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    // Update load status
    await supabase.from('loads').update({ status: 'active_haul' }).eq('id', load.id);
    // Insert initial status update
    await supabase.from('status_updates').insert({
      load_id: load.id,
      by_user_id: profile.id,
      status: 'en_route_to_pickup',
      lat,
      lng,
      note: 'Rider started haul',
    });
    // Upsert rider location
    await upsertRiderLocation(lat, lng);
    await fetchData();
    setActionLoading(null);
  }

  async function upsertRiderLocation(lat: number, lng: number) {
    if (!profile) return;
    const existing = await supabase.from('rider_locations').select('id').eq('rider_id', profile.id).maybeSingle();
    if (existing.data) {
      await supabase.from('rider_locations').update({ lat, lng, load_id: loadId, updated_at: new Date().toISOString() }).eq('rider_id', profile.id);
    } else {
      await supabase.from('rider_locations').insert({ rider_id: profile.id, load_id: loadId, lat, lng });
    }
  }

  async function pushGPS() {
    if (!profile || !load) return;
    let lat = riderLoc?.lat ?? load.pickup_lat ?? 0.3163;
    let lng = riderLoc?.lng ?? load.pickup_lng ?? 32.5819;

    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      // Simulate small movement if real GPS unavailable
      lat += (Math.random() - 0.5) * 0.003;
      lng += (Math.random() - 0.5) * 0.003;
    }
    await upsertRiderLocation(lat, lng);
  }

  async function advanceStatus(newStatus: StatusUpdate['status']) {
    if (!profile || !load) return;
    setActionLoading(newStatus);
    setError('');
    await pushGPS();
    await supabase.from('status_updates').insert({
      load_id: load.id,
      by_user_id: profile.id,
      status: newStatus,
      note: HAUL_STATUS_LABELS[newStatus],
    });
    if (newStatus === 'delivered') {
      await supabase.from('loads').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', load.id);
      sendDeliveryEmail(load.id, load.title, podForm.recipient_name || undefined);
    }
    await fetchData();
    setActionLoading(null);
  }

  async function submitPOD() {
    if (!profile || !load) return;
    if (!podForm.recipient_name.trim()) { setError('Recipient name is required.'); return; }
    setActionLoading('pod');
    setError('');
    const { error } = await supabase.from('proof_of_delivery').insert({
      load_id: load.id,
      rider_id: profile.id,
      recipient_name: podForm.recipient_name.trim(),
      notes: podForm.notes.trim() || null,
      delivered_at: new Date().toISOString(),
    });
    if (error) { setError(error.message); setActionLoading(null); return; }
    await advanceStatus('delivered');
    setShowPodModal(false);
    setActionLoading(null);
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
        <p className="text-slate-400">Load not found. <button onClick={() => navigate(-1 as any)} className="text-orange-400">Go back</button></p>
      </div>
    );
  }

  const rider = load.awarded_rider as any;
  const shipper = load.shipper as any;

  // Map URL centered on rider or midpoint
  const mapLat = riderLoc?.lat ?? load.pickup_lat ?? 0.3163;
  const mapLng = riderLoc?.lng ?? load.pickup_lng ?? 32.5819;
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng - 0.015},${mapLat - 0.015},${mapLng + 0.015},${mapLat + 0.015}&layer=mapnik&marker=${mapLat},${mapLng}`;

  // Next haul status action
  const nextStatusActions: Record<string, { label: string; newStatus: StatusUpdate['status'] }> = {
    '': { label: 'Start Haul', newStatus: 'en_route_to_pickup' },
    'en_route_to_pickup': { label: 'Confirm Pickup', newStatus: 'picked_up' },
    'picked_up': { label: 'En Route to Delivery', newStatus: 'en_route_to_delivery' },
    'en_route_to_delivery': { label: 'Confirm Delivery', newStatus: 'delivered' },
  };
  const nextAction = nextStatusActions[latestHaulStatus ?? ''];

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(isShipper ? '/shipper' : '/driver')}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">Active Haul</h1>
              <StatusBadge status={load.status} />
            </div>
            <p className="text-slate-400 text-sm mt-0.5 truncate">
              {load.title || CARGO_LABELS[load.cargo_type]} · #{load.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Live GPS status bar */}
        {riderLoc && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-300 text-sm font-medium">
                GPS Active · {riderLoc.lat.toFixed(4)}°N, {riderLoc.lng.toFixed(4)}°E
              </span>
            </div>
            <span className="text-slate-500 text-xs">Updated {new Date(riderLoc.updated_at).toLocaleTimeString()}</span>
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-5">
          {/* Left panel — 3 cols */}
          <div className="lg:col-span-3 space-y-5">
            {/* Map */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden relative">
              <iframe
                src={mapSrc}
                width="100%"
                height="320"
                className="border-0"
                title="Live Rider Location"
                key={`${mapLat}-${mapLng}`}
              />
              {/* Overlay badge */}
              <div className="absolute top-3 left-3 px-3 py-1.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg text-xs text-slate-300 flex items-center gap-1.5">
                <Navigation size={12} className="text-orange-400" />
                Rider Location
              </div>
            </div>

            {/* Route Summary */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Pickup</p>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                    <p className="text-white text-sm leading-snug">{load.pickup_address}</p>
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Delivery</p>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                    <p className="text-white text-sm leading-snug">{load.delivery_address}</p>
                  </div>
                </div>
              </div>
              {stops.length > 0 && (
                <div className="pt-3 border-t border-slate-700 space-y-2">
                  {stops.filter(s => s.stop_type === 'intermediate').length > 0 && (
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider mb-1.5">Intermediate Stops</p>
                      {stops.filter(s => s.stop_type === 'intermediate').map(stop => (
                        <div key={stop.id} className="flex items-center gap-2 py-1">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${stop.is_completed ? 'bg-green-400' : 'bg-sky-400'}`} />
                          <p className={`text-sm flex-1 ${stop.is_completed ? 'text-slate-500 line-through' : 'text-white'}`}>{stop.address}</p>
                          {isRider && !stop.is_completed && load.status === 'active_haul' && (
                            <button
                              onClick={async () => {
                                setActionLoading(`stop-${stop.id}`);
                                await supabase.from('load_stops').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', stop.id);
                                setActionLoading(null);
                                fetchData();
                              }}
                              disabled={actionLoading === `stop-${stop.id}`}
                              className="text-xs px-2 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 rounded-lg hover:bg-sky-500/20 transition-colors"
                            >
                              {actionLoading === `stop-${stop.id}` ? '...' : 'Done'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {stops.filter(s => s.stop_type === 'return').length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center gap-2 mb-1.5">
                        <RotateCcw size={12} className="text-amber-400" />
                        <p className="text-amber-400 text-xs uppercase tracking-wider">Return Tickets</p>
                      </div>
                      {stops.filter(s => s.stop_type === 'return').map(stop => (
                        <div key={stop.id} className="flex items-center gap-2 py-1">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${stop.is_completed ? 'bg-green-400' : 'bg-amber-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${stop.is_completed ? 'text-slate-500 line-through' : 'text-white'}`}>{stop.address}</p>
                            {stop.ticket_label && <p className="text-amber-300 text-xs truncate">Collect: {stop.ticket_label}</p>}
                          </div>
                          {isRider && !stop.is_completed && (load.status === 'active_haul' || load.status === 'delivered') && (
                            <button
                              onClick={async () => {
                                setActionLoading(`stop-${stop.id}`);
                                await supabase.from('load_stops').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', stop.id);
                                setActionLoading(null);
                                fetchData();
                              }}
                              disabled={actionLoading === `stop-${stop.id}`}
                              className="text-xs px-2 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors"
                            >
                              {actionLoading === `stop-${stop.id}` ? '...' : 'Collected'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="pt-3 border-t border-slate-700 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-slate-500 text-xs">Cargo</p>
                  <p className="text-white text-sm font-medium mt-0.5">{CARGO_LABELS[load.cargo_type]}</p>
                </div>
                <div className="text-center border-x border-slate-700">
                  <p className="text-slate-500 text-xs">Price</p>
                  <p className="text-orange-400 text-sm font-bold mt-0.5">{formatUGX(load.offer_price_ugx)}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-500 text-xs">Status</p>
                  <p className="text-white text-sm font-medium mt-0.5">
                    {latestHaulStatus ? HAUL_STATUS_LABELS[latestHaulStatus] : 'Not Started'}
                  </p>
                </div>
              </div>
            </div>

            {/* Shipment Details */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-3">Shipment Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Item Type</span>
                  <span className="text-white">{CARGO_LABELS[load.cargo_type]}</span>
                </div>
                {load.cargo_description && (
                  <div className="flex justify-between text-sm gap-8">
                    <span className="text-slate-400 flex-shrink-0">Description</span>
                    <span className="text-white text-right">{load.cargo_description}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Urgency</span>
                  <span className={`font-medium ${load.urgency === 'critical' ? 'text-red-400' : load.urgency === 'urgent' ? 'text-amber-400' : 'text-slate-300'}`}>
                    {load.urgency === 'critical' ? '⚡ Critical' : load.urgency === 'urgent' ? '🔥 Urgent' : 'Standard'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Created</span>
                  <span className="text-white">{new Date(load.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* POD */}
            {pod && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={18} className="text-green-400" />
                  <h3 className="text-green-300 font-semibold">Proof of Delivery</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recipient</span>
                    <span className="text-white">{pod.recipient_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Delivered At</span>
                    <span className="text-white">{new Date(pod.delivered_at).toLocaleString()}</span>
                  </div>
                  {pod.notes && (
                    <div className="pt-2 border-t border-green-500/20">
                      <p className="text-slate-400 text-xs mb-1">Notes</p>
                      <p className="text-white">{pod.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right panel — 2 cols */}
          <div className="lg:col-span-2 space-y-4">
            {/* Rider Card */}
            {rider && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-3">Driver</h3>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                    {rider.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{rider.full_name}</p>
                    {rider.vehicle_plate && (
                      <p className="text-slate-400 text-xs">🛺 {rider.vehicle_plate}{rider.vehicle_model ? ` · ${rider.vehicle_model}` : ''}</p>
                    )}
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-yellow-400 text-xs">★</span>
                      <span className="text-slate-400 text-xs">{(rider.rating ?? 5).toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <a
                  href={`tel:${rider.phone}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 text-sky-400 rounded-xl text-sm font-medium transition-all"
                >
                  <Phone size={15} /> Call Driver
                </a>
              </div>
            )}

            {/* Shipper Card */}
            {shipper && !isShipper && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-3">Shipper</h3>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-lg font-bold">
                    {shipper.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{shipper.full_name}</p>
                    <p className="text-slate-400 text-xs">{shipper.phone}</p>
                  </div>
                </div>
                <a
                  href={`tel:${shipper.phone}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 text-orange-400 rounded-xl text-sm font-medium transition-all"
                >
                  <Phone size={15} /> Call Shipper
                </a>
              </div>
            )}

            {/* Dispatcher Contact (decorative) */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-3">Dispatcher</h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
                  <MessageSquare size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold">ZITRUCKGO Control</p>
                  <p className="text-slate-400 text-xs">Support & monitoring</p>
                </div>
              </div>
              <a
                href="tel:+256800100200"
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 text-violet-400 rounded-xl text-sm font-medium transition-all"
              >
                <Phone size={15} /> +256 800 100 200
              </a>
            </div>

            {/* Haul Timeline */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-4">Status Timeline</h3>
              <div className="space-y-3">
                {HAUL_STEPS.map((step, i) => {
                  const done = currentStepIdx >= i;
                  const current = currentStepIdx === i;
                  return (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        done ? 'bg-green-500' : 'bg-slate-700 border border-slate-600'
                      }`}>
                        {done ? <CheckCircle size={14} className="text-white" /> : <span className="text-slate-500 text-xs">{i + 1}</span>}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${done ? 'text-white' : 'text-slate-500'}`}>
                          {step.label}
                          {current && load.status === 'active_haul' && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-orange-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse inline-block" />
                              Now
                            </span>
                          )}
                        </p>
                        <p className="text-slate-600 text-xs mt-0.5">{step.desc}</p>
                        {statusUpdates.find(u => u.status === step.key) && (
                          <p className="text-slate-500 text-xs mt-0.5">
                            {new Date(statusUpdates.find(u => u.status === step.key)!.created_at).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rider Actions */}
            {isRider && (
              <div className="space-y-3">
                {load.status === 'awarded' && (
                  <button
                    onClick={startHaul}
                    disabled={actionLoading === 'start'}
                    className="w-full py-3.5 bg-orange-500 hover:bg-orange-400 disabled:bg-orange-500/50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg"
                  >
                    <Zap size={20} /> {actionLoading === 'start' ? 'Starting...' : 'Start Haul Now'}
                  </button>
                )}
                {load.status === 'active_haul' && nextAction && nextAction.newStatus !== 'delivered' && (
                  <button
                    onClick={() => advanceStatus(nextAction.newStatus)}
                    disabled={!!actionLoading}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:bg-orange-500/50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading === nextAction.newStatus ? 'Updating...' : nextAction.label + ' →'}
                  </button>
                )}
                {load.status === 'active_haul' && latestHaulStatus === 'en_route_to_delivery' && (
                  <button
                    onClick={() => setShowPodModal(true)}
                    disabled={!!actionLoading}
                    className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:bg-green-500/50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Camera size={18} /> Submit Proof of Delivery
                  </button>
                )}
                {load.status === 'active_haul' && (
                  <button
                    onClick={pushGPS}
                    disabled={!!actionLoading}
                    className="w-full py-2.5 bg-slate-800 border border-slate-700 hover:border-sky-500/40 text-slate-400 hover:text-sky-400 font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Navigation size={15} /> Update My Location
                  </button>
                )}
              </div>
            )}

            {/* Shipper — confirm delivery */}
            {isShipper && load.status === 'delivered' && (
              <div className="space-y-3">
                {!pod && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm text-center">
                    Waiting for rider to submit Proof of Delivery...
                  </div>
                )}
                <button
                  onClick={async () => {
                    setActionLoading('complete');
                    await supabase.from('loads').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', loadId);
                    await fetchData();
                    setActionLoading(null);
                  }}
                  disabled={!!actionLoading}
                  className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:bg-green-500/50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading === 'complete' ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : <><CheckCircle size={18} /> Confirm & Close Load</>}
                </button>
              </div>
            )}

            {load.status === 'completed' && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                <CheckCircle size={24} className="text-green-400 mx-auto mb-2" />
                <p className="text-green-300 font-semibold">Load Completed!</p>
                <p className="text-slate-400 text-xs mt-1">Load closed · {formatUGX(load.offer_price_ugx)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* POD Modal */}
      {showPodModal && (
        <Modal title="Proof of Delivery" onClose={() => setShowPodModal(false)}>
          <p className="text-slate-400 text-sm mb-5">Confirm you delivered the item to the recipient.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Recipient Name *</label>
              <input
                type="text"
                value={podForm.recipient_name}
                onChange={e => setPodForm(f => ({ ...f, recipient_name: e.target.value }))}
                placeholder="Name of person who received the item"
                className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Delivery Notes (optional)</label>
              <textarea
                value={podForm.notes}
                onChange={e => setPodForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Left with receptionist, building secure, etc."
                rows={2}
                className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500 transition-colors resize-none"
              />
            </div>
            <div className="p-3 bg-slate-700/50 rounded-xl flex items-center gap-3 text-sm text-slate-400">
              <Camera size={16} className="text-slate-500 flex-shrink-0" />
              GPS coordinates are automatically recorded with your proof of delivery.
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={submitPOD}
              disabled={actionLoading === 'pod'}
              className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:bg-green-500/50 text-white font-semibold rounded-xl transition-all"
            >
              {actionLoading === 'pod' ? 'Submitting...' : 'Confirm Delivery'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
