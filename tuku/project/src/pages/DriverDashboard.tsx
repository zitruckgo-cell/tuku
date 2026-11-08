import { useEffect, useState, useRef } from 'react';
import { Truck, DollarSign, Star, Package, CheckCircle, RefreshCw, Zap, Wallet, Clock, LayoutDashboard, Navigation, FileText, MessageSquare, Bell, UserRound, Menu, X, Home, TrendingUp, Box, Search, Award, CheckCircle2, BellRing, X as XIcon, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import type { Load, Earning } from '../lib/types';
import { CARGO_LABELS, formatUGX, STATUS_LABELS } from '../lib/types';
import { LoadCard } from '../components/LoadCard';
import { Modal } from '../components/Modal';
import { DocumentUpload } from '../components/DocumentUpload';
import { useDriverLocation } from '../hooks/useDriverLocation';

export function DriverDashboard() {
  const { profile, refreshProfile } = useAuth();
  const { navigate } = useRouter();

  const [openLoads, setOpenLoads] = useState<Load[]>([]);
  const [myLoads, setMyLoads] = useState<Load[]>([]);
  const [myBids, setMyBids] = useState<Record<string, { status: string; bid_amount_ugx: number }>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [activeTab, setActiveTab] = useState<'available' | 'mine'>('available');
  const [searchQuery, setSearchQuery] = useState('');
  const [bidModal, setBidModal] = useState<{ load: Load } | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidEta, setBidEta] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError] = useState('');
  const [togglingAvail, setTogglingAvail] = useState(false);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'loads' | 'mine' | 'active' | 'earnings' | 'documents' | 'ratings' | 'notifications'>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [newLoadAlert, setNewLoadAlert] = useState<Load | null>(null);
  const [newLoadCount, setNewLoadCount] = useState(0);
  const prevLoadCountRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const { state: gpsState, lastPing } = useDriverLocation();

  function playAlertSound() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      // Two-tone ascending alert
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);
        gain.gain.setValueAtTime(0, now + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.15, now + i * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.3);
      });
    } catch { /* AudioContext not available */ }
  }

  function dismissNewLoadAlert() {
    setNewLoadAlert(null);
  }

  async function fetchLoads() {
    const isInitial = openLoads.length === 0 && myLoads.length === 0 && loading;
    if (isInitial) setLoading(true);
    setFetchError('');
    try {
      const [open, mine, bids, earn] = await Promise.all([
        supabase
          .from('loads')
          .select('*, shipper:shipper_id(id, full_name, phone), stops:load_stops(*)')
          .eq('status', 'posted')
          .order('created_at', { ascending: false }),
        supabase
          .from('loads')
          .select('*, shipper:shipper_id(id, full_name, phone), stops:load_stops(*)')
          .eq('awarded_rider_id', profile!.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('bids')
          .select('load_id, status, bid_amount_ugx')
          .eq('rider_id', profile!.id),
        supabase
          .from('earnings')
          .select('*')
          .eq('driver_id', profile!.id)
          .order('created_at', { ascending: false }),
      ]);
      if (open.error) {
        console.error('Driver fetch open loads error:', open.error.message);
        setFetchError(open.error.message);
      }
      if (mine.error) console.error('Driver fetch my loads error:', mine.error.message);
      if (bids.error) console.error('Driver fetch bids error:', bids.error.message);
      if (earn.error) console.error('Driver fetch earnings error:', earn.error.message);
      setOpenLoads((open.data as Load[]) ?? []);
      setMyLoads((mine.data as Load[]) ?? []);
      setEarnings((earn.data as Earning[]) ?? []);
      const bidMap: Record<string, { status: string; bid_amount_ugx: number }> = {};
      for (const b of (bids.data ?? []) as any[]) {
        bidMap[b.load_id] = { status: b.status, bid_amount_ugx: b.bid_amount_ugx };
      }
      setMyBids(bidMap);
    } catch (err: any) {
      console.error('Driver fetchLoads exception:', err);
      setFetchError(err?.message || 'Failed to load loads. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile) fetchLoads();
  }, [profile?.id]);

  // Realtime: refresh when loads change (new load posted, load awarded, etc.)
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('driver-loads-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loads' }, (payload: any) => {
        if (payload.new && payload.new.status === 'posted') {
          setNewLoadAlert(payload.new as Load);
          setNewLoadCount(c => c + 1);
          playAlertSound();
          setTimeout(() => setNewLoadAlert(null), 8000);
        }
        fetchLoads();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'loads' }, () => fetchLoads())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'loads' }, () => fetchLoads())
      .subscribe();

    // Fallback: poll every 15 seconds in case realtime misses an event
    const interval = setInterval(() => fetchLoads(), 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [profile?.id]);

  // Clear the new-load badge when the driver views the available loads tab
  useEffect(() => {
    if (activeSection === 'loads' || activeSection === 'dashboard') {
      setNewLoadCount(0);
    }
  }, [activeSection]);

  async function toggleAvailability() {
    if (!profile) return;
    setTogglingAvail(true);
    await supabase.from('profiles').update({ is_available: !profile.is_available }).eq('id', profile.id);
    await refreshProfile();
    setTogglingAvail(false);
  }

  async function submitBid() {
    if (!bidModal || !profile) return;
    const amount = parseInt(bidAmount);
    if (!amount || amount < 1000) { setBidError('Enter a valid amount (min UGX 1,000)'); return; }
    setBidLoading(true);
    setBidError('');
    const existingBid = myBids[bidModal.load.id];
    const payload = {
      load_id: bidModal.load.id,
      rider_id: profile.id,
      bid_amount_ugx: amount,
      eta_minutes: bidEta ? parseInt(bidEta) : null,
      message: bidMessage.trim() || null,
      status: 'pending',
    };
    let error;
    if (existingBid) {
      // Counter-offer: update existing bid
      ({ error } = await supabase.from('bids').update({
        bid_amount_ugx: amount,
        eta_minutes: bidEta ? parseInt(bidEta) : null,
        message: bidMessage.trim() || null,
        status: 'pending',
      }).eq('load_id', bidModal.load.id).eq('rider_id', profile.id));
    } else {
      ({ error } = await supabase.from('bids').insert(payload));
    }
    setBidLoading(false);
    if (error) {
      setBidError(error.message.includes('duplicate') ? 'You already placed a bid on this load.' : error.message);
      return;
    }
    setBidModal(null);
    setBidAmount('');
    setBidEta('');
    setBidMessage('');
    await fetchLoads();
  }

  async function acceptLoad(load: Load) {
    if (!profile) return;
    const { error } = await supabase
      .from('loads')
      .update({ awarded_rider_id: profile.id, status: 'awarded' })
      .eq('id', load.id);
    if (!error) {
      await supabase.from('bids').insert({
        load_id: load.id,
        rider_id: profile.id,
        bid_amount_ugx: load.offer_price_ugx,
        status: 'accepted',
        message: 'Direct accept at offered price',
      });
      fetchLoads();
    }
  }

  const stats = {
    active: myLoads.filter(l => l.status === 'active_haul').length,
    completed: myLoads.filter(l => l.status === 'completed').length,
    earnings: earnings.filter(e => e.payout_status === 'paid').reduce((s, e) => s + e.driver_earnings_ugx, 0),
    pendingPayouts: earnings.filter(e => e.payout_status === 'pending').reduce((s, e) => s + e.driver_earnings_ugx, 0),
    failedPayouts: earnings.filter(e => e.payout_status === 'failed').length,
    rating: profile?.rating ?? 5.0,
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredOpenLoads = q
    ? openLoads.filter(l => {
        const hay = `${l.title ?? ''} ${l.pickup_address ?? ''} ${l.delivery_address ?? ''} ${l.cargo_description ?? ''} ${CARGO_LABELS[l.cargo_type] ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
    : openLoads;
  const filteredMyLoads = q
    ? myLoads.filter(l => {
        const hay = `${l.title ?? ''} ${l.pickup_address ?? ''} ${l.delivery_address ?? ''} ${l.cargo_description ?? ''} ${CARGO_LABELS[l.cargo_type] ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
    : myLoads;

  const activeHaul = myLoads.find(l => l.status === 'active_haul');
  const awardedLoads = myLoads.filter(l => l.status === 'awarded');
  const firstName = profile?.full_name.split(' ')[0] ?? 'Driver';
  const navItems = [
    { key: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { key: 'loads' as const, label: 'Find Loads', icon: Box },
    { key: 'mine' as const, label: 'My Loads', icon: Truck },
    { key: 'active' as const, label: 'Active Delivery', icon: Navigation },
    { key: 'earnings' as const, label: 'Earnings', icon: DollarSign },
    { key: 'documents' as const, label: 'Documents', icon: FileText },
    { key: 'messages' as const, label: 'Messages', icon: MessageSquare },
    { key: 'ratings' as const, label: 'Ratings', icon: Star },
    { key: 'notifications' as const, label: 'Notifications', icon: Bell },
    { key: 'profile' as const, label: 'Profile', icon: UserRound },
  ];

  function selectSection(key: typeof navItems[number]['key']) {
    setMobileNavOpen(false);
    if (key === 'dashboard' || key === 'loads' || key === 'mine') {
      setActiveSection(key);
      if (key === 'loads') setActiveTab('available');
      if (key === 'mine') setActiveTab('mine');
      return;
    }
    if (key === 'active') {
      if (activeHaul) navigate(`/haul/${activeHaul.id}`);
      return;
    }
    if (key === 'earnings' || key === 'documents' || key === 'ratings' || key === 'notifications') {
      setActiveSection(key);
      return;
    }
    if (key === 'profile') navigate('/profile');
    if (key === 'messages') navigate('/support');
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7fafc] text-[#152238]">
      <header className="border-b border-[#e6edf2] bg-white px-4 py-4 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-5">
          <button onClick={() => navigate('/')} className="flex min-w-0 items-center gap-3 text-left">
            <img src="/trucgo-logo-transparent.webp" alt="ZITRUCKGO LOGISTICS" className="h-12 w-12 rounded-full object-cover ring-1 ring-[#128663]/30" />
            <div className="min-w-0">
              <p className="truncate text-xl font-bold leading-tight text-[#152238]">Dual Portal</p>
              <p className="text-base text-[#718096]">{firstName}</p>
            </div>
          </button>
          <div className="hidden items-center gap-1 rounded-[22px] bg-[#f1f6fa] p-1.5 sm:flex">
            <button onClick={() => navigate('/shipper')} className="flex items-center gap-2 rounded-[17px] px-6 py-3 text-base font-medium text-[#6d7c90] transition-colors hover:text-[#152238]"><Package size={21} /> Shipper</button>
            <button className="flex items-center gap-2 rounded-[17px] bg-white px-6 py-3 text-base font-semibold text-[#128663] shadow-sm"><Truck size={21} /> Driver</button>
          </div>
          <div className="flex items-center gap-3">
            {gpsState === 'tracking' && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200" title={lastPing ? `Last location sent ${lastPing.toLocaleTimeString()}` : 'Sharing live location'}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                GPS Live
              </span>
            )}
            {gpsState === 'permission_denied' && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200" title="Allow location access in your browser to share your live position">
                <Navigation size={12} /> GPS Off
              </span>
            )}
            {gpsState === 'error' && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200" title="Geolocation is not available on this device">
                <AlertCircle size={12} /> GPS Error
              </span>
            )}
            <button onClick={() => navigate('/')} className="rounded-xl p-3 text-[#718096] transition-colors hover:bg-[#f1f6fa] hover:text-[#128663]" aria-label="Home"><Home size={25} /></button>
          </div>
        </div>
      </header>
      <div className="min-h-screen flex flex-col xl:flex-row xl:items-start">
        <aside className="hidden xl:flex xl:w-80 xl:shrink-0 xl:flex-col xl:my-8 xl:ml-8 xl:mr-4 xl:h-[calc(100vh-9rem)] xl:sticky xl:top-8 xl:overflow-y-auto rounded-3xl border border-[#e6edf2] bg-white px-5 py-8 shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#eef2f5] px-3 pb-8">
            <img src="/trucgo-logo-transparent.webp" alt="ZITRUCKGO LOGISTICS" className="h-12 w-12 rounded-full object-cover ring-1 ring-[#128663]/30" />
            <div>
              <p className="text-xl font-bold leading-tight text-[#152238]">Driver Portal</p>
              <p className="text-base text-[#718096]">{firstName}</p>
            </div>
          </div>
          <nav className="mt-8 space-y-2" aria-label="Driver navigation">
            {navItems.map(item => {
              const Icon = item.icon;
              const selected = item.key === activeSection;
              const showBadge = item.key === 'loads' && newLoadCount > 0;
              return (
                <button key={item.key} onClick={() => selectSection(item.key)}
                  className={`flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left text-lg font-medium transition-all ${selected ? 'bg-[#e8fbf3] text-[#128663]' : 'text-[#4e5d70] hover:bg-[#f5f8fa] hover:text-[#152238]'}`}>
                  <span className="relative">
                    <Icon size={21} strokeWidth={selected ? 2.4 : 1.9} />
                    {showBadge && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e54848] px-1 text-[10px] font-bold text-white animate-bounce">{newLoadCount}</span>
                    )
                    }
                  </span>
                  {item.label}
                  {showBadge && <span className="ml-auto text-xs font-bold text-[#e54848]">NEW</span>}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden">
          <div className="border-b border-[#e6edf2] bg-white px-4 py-4 xl:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/trucgo-logo-transparent.webp" alt="ZITRUCKGO LOGISTICS" className="h-10 w-10 rounded-full object-cover ring-1 ring-[#128663]/30" />
                <div><p className="font-bold text-[#152238]">Driver Portal</p><p className="text-xs text-[#718096]">{firstName}</p></div>
              </div>
              <button onClick={() => setMobileNavOpen(open => !open)} className="rounded-xl p-2 text-[#4e5d70] hover:bg-[#f1f6fa]" aria-label="Toggle navigation">
                {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
            {mobileNavOpen && <nav className="mt-4 grid grid-cols-2 gap-2">{navItems.map(item => { const Icon = item.icon; const showBadge = item.key === 'loads' && newLoadCount > 0; return <button key={item.key} onClick={() => selectSection(item.key)} className="relative flex items-center gap-2 rounded-xl bg-[#f5f8fa] px-3 py-2.5 text-left text-sm text-[#4e5d70]"><Icon size={16} />{item.label}{showBadge && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e54848] px-1 text-[10px] font-bold text-white">{newLoadCount}</span>}</button>; })}</nav>}
          </div>

          {/* New Load Alert Toast */}
          {newLoadAlert && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
              <div className="flex items-start gap-3 rounded-2xl border border-[#128663] bg-white shadow-xl p-4 animate-[slideDown_0.3s_ease-out]">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#e8fbf3]">
                  <BellRing size={22} className="text-[#128663] animate-wiggle" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#152238] text-sm">New Load Posted!</p>
                  <p className="text-[#718096] text-sm mt-0.5 truncate">
                    {newLoadAlert.title || CARGO_LABELS[newLoadAlert.cargo_type] || 'New delivery request'}
                  </p>
                  <p className="text-[#a0aec0] text-xs mt-0.5 truncate">
                    {newLoadAlert.pickup_address} → {newLoadAlert.delivery_address}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => { setActiveSection('loads'); setActiveTab('available'); dismissNewLoadAlert(); }}
                      className="px-3 py-1.5 bg-[#128663] hover:bg-[#0f7355] text-white text-xs font-semibold rounded-lg transition-colors"
                    >View Load</button>
                    <span className="text-[#128663] font-semibold text-xs">{formatUGX(newLoadAlert.offer_price_ugx)}</span>
                  </div>
                </div>
                <button onClick={dismissNewLoadAlert} className="flex-shrink-0 text-[#a0aec0] hover:text-[#152238] transition-colors" aria-label="Dismiss">
                  <XIcon size={18} />
                </button>
              </div>
            </div>
          )}

          <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 xl:px-10 xl:py-10">
            <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#128663]">
                  {activeSection === 'dashboard' ? 'Driver dashboard' :
                   activeSection === 'loads' ? 'Find loads' :
                   activeSection === 'mine' ? 'My loads' :
                   activeSection === 'earnings' ? 'Earnings & payouts' :
                   activeSection === 'documents' ? 'My documents' :
                   activeSection === 'ratings' ? 'Ratings & reviews' :
                   activeSection === 'notifications' ? 'Notifications' : 'Driver dashboard'}
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-[#152238] sm:text-5xl">
                  {activeSection === 'dashboard' ? `Welcome, ${firstName}` :
                   activeSection === 'loads' ? 'Find Loads' :
                   activeSection === 'mine' ? 'My Loads' :
                   activeSection === 'earnings' ? 'Earnings & Payouts' :
                   activeSection === 'documents' ? 'My Documents' :
                   activeSection === 'ratings' ? 'Ratings & Reviews' :
                   activeSection === 'notifications' ? 'Notifications' : `Welcome, ${firstName}`}
                </h1>
                <p className="mt-3 max-w-xl text-lg leading-relaxed text-[#718096]">
                  {activeSection === 'dashboard' ? 'Your delivery dashboard at a glance. Find your next load and keep every haul moving.' :
                   activeSection === 'loads' ? 'Browse available loads and place your bids.' :
                   activeSection === 'mine' ? 'Track loads assigned to you and manage your deliveries.' :
                   activeSection === 'earnings' ? 'View your payout history.' :
                   activeSection === 'documents' ? 'Upload and manage your verification documents.' :
                   activeSection === 'ratings' ? 'See how shppers rated your deliveries.' :
                   activeSection === 'notifications' ? 'Recent activity and updates on your loads.' : 'Your delivery dashboard at a glance.'}
                </p>
              </div>
              <div className="flex w-full items-center gap-3 xl:w-auto">
                <button onClick={() => setActiveSection('dashboard')}
                  className={`flex items-center gap-2 rounded-2xl px-5 py-4 text-sm font-bold shadow-sm transition-all ${
                    activeSection === 'dashboard'
                      ? 'bg-[#e8fbf3] text-[#128663] border-2 border-[#128663]'
                      : 'bg-[#128663] text-white hover:bg-[#0f7355]'
                  }`}>
                  <LayoutDashboard size={18} /> Dashboard
                </button>
                <button onClick={toggleAvailability} disabled={togglingAvail}
                  className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border-2 px-3 py-4 text-xs font-bold transition-all sm:min-w-48 sm:px-5 sm:text-sm ${profile?.is_available ? 'border-[#128663] bg-[#e8fbf3] text-[#128663] hover:bg-[#d5f5e8]' : 'border-[#e6edf2] bg-white text-[#718096] hover:border-[#128663]'}`}>
                  <span className={`h-3 w-3 rounded-full ${profile?.is_available ? 'bg-[#128663]' : 'bg-[#cbd5e0]'}`} />
                  {profile?.is_available ? 'Online — Available for Loads' : 'Offline — Go Online'}
                </button>
                <button onClick={fetchLoads} className="rounded-2xl border border-[#e6edf2] bg-white p-4 text-[#718096] shadow-sm transition-colors hover:border-[#128663] hover:text-[#128663]" aria-label="Refresh loads"><RefreshCw size={18} /></button>
              </div>
            </div>

            {/* ===== DASHBOARD / LOADS / MINE ===== */}
            {(activeSection === 'dashboard' || activeSection === 'loads' || activeSection === 'mine') && (
              <>
            {/* Overview cards */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { icon: Package, label: 'Available Loads', value: openLoads.length, color: 'text-[#e6a700]', bg: 'bg-[#fef9e7]' },
                { icon: Truck, label: 'Active Load', value: stats.active, color: 'text-[#2563eb]', bg: 'bg-[#eff6ff]' },
                { icon: DollarSign, label: "Today's Earnings", value: formatUGX(stats.earnings), color: 'text-[#128663]', bg: 'bg-[#e8fbf3]' },
                { icon: TrendingUp, label: 'Weekly Earnings', value: formatUGX(stats.earnings), color: 'text-[#0ea5e9]', bg: 'bg-[#f0f9ff]' },
              ].map((s, i) => (
                <div key={i} className="rounded-3xl border border-[#e6edf2] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-6">
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${s.bg}`}><s.icon size={22} className={s.color} /></div>
                  <p className="text-2xl font-bold tracking-tight text-[#152238] sm:text-3xl">{s.value}</p>
                  <p className="mt-1 text-sm font-medium text-[#718096]">{s.label}</p>
                </div>
              ))}
            </div>

        {/* Earnings History (summary on dashboard) */}
        {activeSection === 'dashboard' && earnings.length > 0 && (
          <div className="mb-8">
            <h3 className="text-[#152238] font-semibold mb-3 flex items-center gap-2">
              <Wallet size={16} className="text-[#128663]" /> Recent Earnings
            </h3>
            <div className="bg-white border border-[#e6edf2] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#e6edf2] text-left bg-[#f7fafc]">
                      <th className="px-4 py-3 text-[#718096] text-xs font-semibold uppercase">Date</th>
                      <th className="px-4 py-3 text-[#718096] text-xs font-semibold uppercase">Load</th>
                      <th className="px-4 py-3 text-[#718096] text-xs font-semibold uppercase">Earnings</th>
                      <th className="px-4 py-3 text-[#718096] text-xs font-semibold uppercase">Fee</th>
                      <th className="px-4 py-3 text-[#718096] text-xs font-semibold uppercase">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.slice(0, 5).map(e => (
                      <tr key={e.id} className="border-b border-[#eef2f5]">
                        <td className="px-4 py-3 text-[#718096] text-sm">{new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                        <td className="px-4 py-3 text-[#152238] text-sm font-mono">{e.load_id.slice(0, 8).toUpperCase()}</td>
                        <td className="px-4 py-3 text-[#128663] text-sm font-semibold">{formatUGX(e.driver_earnings_ugx)}</td>
                        <td className="px-4 py-3 text-[#e6a700] text-sm">{formatUGX(e.marketplace_fee_ugx)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            e.payout_status === 'paid' ? 'bg-[#e8fbf3] text-[#128663] border-[#a7e3d0]' :
                            e.payout_status === 'failed' ? 'bg-[#fef2f2] text-[#e54848] border-[#f5b3b3]' :
                            e.payout_status === 'refunded' ? 'bg-[#f1f5f9] text-[#64748b] border-[#cbd5e1]' :
                            'bg-[#fef9e7] text-[#8a6d00] border-[#f5d97e]'
                          }`}>
                            {e.payout_status ?? 'pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Active Haul Banner */}
        {activeHaul && (
          <div className="mb-6 p-4 bg-[#e8fbf3] border border-[#a7e3d0] rounded-2xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#128663] animate-pulse" />
                <div>
                  <p className="text-[#128663] font-semibold">Active Haul in Progress</p>
                  <p className="text-[#718096] text-sm mt-0.5 truncate max-w-sm">
                    {activeHaul.title || CARGO_LABELS[activeHaul.cargo_type]} → {activeHaul.delivery_address}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/haul/${activeHaul.id}`)}
                className="flex-shrink-0 px-4 py-2 bg-[#128663] hover:bg-[#0f7355] text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Open Haul
              </button>
            </div>
          </div>
        )}

        {/* Awarded loads */}
        {awardedLoads.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[#152238] font-semibold mb-3 flex items-center gap-2">
              <Zap size={16} className="text-[#e6a700]" />
              Loads Awarded to You ({awardedLoads.length})
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {awardedLoads.map(load => (
                <div key={load.id} className="rounded-2xl border border-[#e6edf2] bg-white p-5 shadow-sm">
                  <p className="text-[#152238] font-semibold mb-1">{load.title || CARGO_LABELS[load.cargo_type]}</p>
                  <p className="text-[#718096] text-sm mb-3 line-clamp-1">{load.pickup_address} → {load.delivery_address}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[#128663] font-semibold">{formatUGX(load.offer_price_ugx)}</span>
                    <button
                      onClick={() => navigate(`/haul/${load.id}`)}
                      className="px-4 py-2 bg-[#128663] hover:bg-[#0f7355] text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      Start Haul
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search + Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a0aec0]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by title, address, or cargo type..."
              className="w-full bg-white border border-[#e6edf2] text-[#152238] placeholder-[#a0aec0] rounded-xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#128663] transition-colors"
            />
          </div>
          <div className="flex w-full bg-[#f1f6fa] border border-[#e6edf2] rounded-xl p-1 sm:w-fit">
          {[
            { key: 'available', label: `Available (${filteredOpenLoads.length})` },
            { key: 'mine', label: `My Loads (${filteredMyLoads.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all sm:flex-none sm:px-5 ${
                activeTab === tab.key ? 'bg-white text-[#128663] shadow-sm' : 'text-[#718096] hover:text-[#152238]'
              }`}
            >
              {tab.label}
            </button>
          ))}
          </div>
        </div>

        {/* Load List */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="rounded-2xl border border-[#e6edf2] bg-white p-5 h-40 animate-pulse" />)}
          </div>
        ) : fetchError ? (
          <div className="text-center py-16">
            <p className="text-[#e54848] font-medium mb-2">Could not load loads</p>
            <p className="text-[#718096] text-sm mb-4">{fetchError}</p>
            <button onClick={fetchLoads} className="px-5 py-2.5 bg-[#128663] hover:bg-[#0f7355] text-white text-sm font-semibold rounded-xl transition-colors">Try Again</button>
          </div>
        ) : activeTab === 'available' ? (
          filteredOpenLoads.length === 0 ? (
            <div className="text-center py-20">
              <Package size={32} className="text-[#cbd5e0] mx-auto mb-3" />
              <p className="text-[#718096]">No open loads right now</p>
              <p className="text-[#a0aec0] text-sm mt-1">Check back soon — new loads are posted frequently.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOpenLoads.map(load => {
                const existingBid = myBids[load.id];
                const canCounter = existingBid && existingBid.status === 'pending';
                return (
                  <LoadCard
                    key={load.id}
                    load={load}
                    onBid={existingBid ? undefined : () => { setBidModal({ load }); setBidAmount(String(load.offer_price_ugx)); setBidError(''); }}
                    onAccept={existingBid ? undefined : () => acceptLoad(load)}
                    onCounterOffer={canCounter ? () => {
                      setBidModal({ load });
                      setBidAmount(String(existingBid.bid_amount_ugx));
                      setBidError('');
                    } : undefined}
                    bidStatus={existingBid}
                  />
                );
              })}
            </div>
          )
        ) : (
          filteredMyLoads.length === 0 ? (
            <div className="text-center py-20">
              <CheckCircle size={32} className="text-[#cbd5e0] mx-auto mb-3" />
              <p className="text-[#718096]">No loads assigned to you yet</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMyLoads.map(load => (
                <div key={load.id}>
                  <LoadCard load={load} />
                  {(load.status === 'awarded' || load.status === 'active_haul') && (
                    <button
                      onClick={() => navigate(`/haul/${load.id}`)}
                      className="w-full mt-2 py-2 text-sm font-medium text-[#128663] hover:text-[#0f7355] bg-[#e8fbf3] hover:bg-[#d5f5e8] border border-[#a7e3d0] rounded-xl transition-all"
                    >
                      {load.status === 'awarded' ? 'Start This Haul →' : 'Track Live →'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        )}
              </>
            )}

            {/* ===== EARNINGS ===== */}
            {activeSection === 'earnings' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-3xl border border-[#e6edf2] bg-white p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8fbf3]"><DollarSign size={22} className="text-[#128663]" /></div>
                    <p className="text-2xl font-bold text-[#152238]">{formatUGX(stats.earnings)}</p>
                    <p className="mt-1 text-sm text-[#718096]">Total Paid Out</p>
                  </div>
                  <div className="rounded-3xl border border-[#e6edf2] bg-white p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fef9e7]"><Clock size={22} className="text-[#e6a700]" /></div>
                    <p className="text-2xl font-bold text-[#152238]">{formatUGX(stats.pendingPayouts)}</p>
                    <p className="mt-1 text-sm text-[#718096]">Pending Payouts</p>
                  </div>
                  <div className="rounded-3xl border border-[#e6edf2] bg-white p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff6ff]"><TrendingUp size={22} className="text-[#2563eb]" /></div>
                    <p className="text-2xl font-bold text-[#152238]">{stats.completed}</p>
                    <p className="mt-1 text-sm text-[#718096]">Completed Deliveries</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-[#152238] font-semibold mb-3 flex items-center gap-2">
                    <Wallet size={16} className="text-[#128663]" /> Payout History
                  </h3>
                  {earnings.length === 0 ? (
                    <div className="text-center py-16">
                      <Wallet size={32} className="text-[#cbd5e0] mx-auto mb-3" />
                      <p className="text-[#718096]">No earnings yet</p>
                      <p className="text-[#a0aec0] text-sm mt-1">Complete a delivery to start earning.</p>
                    </div>
                  ) : (
                    <div className="bg-white border border-[#e6edf2] rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[#e6edf2] text-left bg-[#f7fafc]">
                              <th className="px-4 py-3 text-[#718096] text-xs font-semibold uppercase">Date</th>
                              <th className="px-4 py-3 text-[#718096] text-xs font-semibold uppercase">Load</th>
                              <th className="px-4 py-3 text-[#718096] text-xs font-semibold uppercase">Earnings</th>
                              <th className="px-4 py-3 text-[#718096] text-xs font-semibold uppercase">Fee</th>
                              <th className="px-4 py-3 text-[#718096] text-xs font-semibold uppercase">Payout</th>
                            </tr>
                          </thead>
                          <tbody>
                            {earnings.map(e => (
                              <tr key={e.id} className="border-b border-[#eef2f5]">
                                <td className="px-4 py-3 text-[#718096] text-sm">{new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                                <td className="px-4 py-3 text-[#152238] text-sm font-mono">{e.load_id.slice(0, 8).toUpperCase()}</td>
                                <td className="px-4 py-3 text-[#128663] text-sm font-semibold">{formatUGX(e.driver_earnings_ugx)}</td>
                                <td className="px-4 py-3 text-[#e6a700] text-sm">{formatUGX(e.marketplace_fee_ugx)}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                                    e.payout_status === 'paid' ? 'bg-[#e8fbf3] text-[#128663] border-[#a7e3d0]' :
                                    e.payout_status === 'failed' ? 'bg-[#fef2f2] text-[#e54848] border-[#f5b3b3]' :
                                    e.payout_status === 'refunded' ? 'bg-[#f1f5f9] text-[#64748b] border-[#cbd5e1]' :
                                    'bg-[#fef9e7] text-[#8a6d00] border-[#f5d97e]'
                                  }`}>
                                    {e.payout_status ?? 'pending'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== DOCUMENTS ===== */}
            {activeSection === 'documents' && profile && (
              <div className="max-w-2xl space-y-6">
                <div className="rounded-2xl border border-[#e6edf2] bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8fbf3]"><FileText size={20} className="text-[#128663]" /></div>
                    <div>
                      <h3 className="text-[#152238] font-semibold">Verification Documents</h3>
                      <p className="text-[#718096] text-sm">Upload your documents for admin verification.</p>
                    </div>
                  </div>
                  <div className="mb-4 flex items-center gap-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                      profile.verification_status === 'approved' ? 'bg-[#e8fbf3] text-[#128663] border-[#a7e3d0]' :
                      profile.verification_status === 'rejected' ? 'bg-[#fef2f2] text-[#e54848] border-[#f5b3b3]' :
                      profile.verification_status === 'suspended' ? 'bg-[#f1f5f9] text-[#64748b] border-[#cbd5e1]' :
                      'bg-[#fef9e7] text-[#8a6d00] border-[#f5d97e]'
                    }`}>
                      {profile.verification_status ?? 'pending'}
                    </span>
                  </div>
                  <div className="space-y-5">
                    <DocumentUpload label="Profile Photo" docType="photo" userId={profile.id} currentUrl={profile.photo_url}
                      onUpload={async (url) => { await supabase.from('profiles').update({ photo_url: url }).eq('id', profile.id); await refreshProfile(); }}
                      onRemove={async () => { await supabase.from('profiles').update({ photo_url: null }).eq('id', profile.id); await refreshProfile(); }} />
                    <DocumentUpload label="National ID" required docType="national_id" userId={profile.id} currentUrl={profile.national_id_doc_url}
                      onUpload={async (url) => { await supabase.from('profiles').update({ national_id_doc_url: url }).eq('id', profile.id); await refreshProfile(); }}
                      onRemove={async () => { await supabase.from('profiles').update({ national_id_doc_url: null }).eq('id', profile.id); await refreshProfile(); }} />
                    <DocumentUpload label="LC Letter" docType="lc_letter" userId={profile.id} currentUrl={profile.lc_letter_doc_url}
                      onUpload={async (url) => { await supabase.from('profiles').update({ lc_letter_doc_url: url }).eq('id', profile.id); await refreshProfile(); }}
                      onRemove={async () => { await supabase.from('profiles').update({ lc_letter_doc_url: null }).eq('id', profile.id); await refreshProfile(); }} />
                    <DocumentUpload label="Referral Letter" docType="referral_letter" userId={profile.id} currentUrl={profile.referral_letter_doc_url}
                      onUpload={async (url) => { await supabase.from('profiles').update({ referral_letter_doc_url: url }).eq('id', profile.id); await refreshProfile(); }}
                      onRemove={async () => { await supabase.from('profiles').update({ referral_letter_doc_url: null }).eq('id', profile.id); await refreshProfile(); }} />
                  </div>
                </div>
              </div>
            )}

            {/* ===== RATINGS ===== */}
            {activeSection === 'ratings' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-3xl border border-[#e6edf2] bg-white p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fef9e7]"><Star size={22} className="text-[#e6a700]" /></div>
                    <p className="text-3xl font-bold text-[#152238]">{(profile?.rating ?? 5).toFixed(1)}</p>
                    <p className="mt-1 text-sm text-[#718096]">Average Rating</p>
                  </div>
                  <div className="rounded-3xl border border-[#e6edf2] bg-white p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8fbf3]"><CheckCircle2 size={22} className="text-[#128663]" /></div>
                    <p className="text-3xl font-bold text-[#152238]">{profile?.total_deliveries ?? 0}</p>
                    <p className="mt-1 text-sm text-[#718096]">Total Deliveries</p>
                  </div>
                  <div className="rounded-3xl border border-[#e6edf2] bg-white p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff6ff]"><Award size={22} className="text-[#2563eb]" /></div>
                    <p className="text-3xl font-bold text-[#152238]">{stats.completed}</p>
                    <p className="mt-1 text-sm text-[#718096]">Completed This Period</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#e6edf2] bg-white p-6 shadow-sm">
                  <h3 className="text-[#152238] font-semibold mb-4 flex items-center gap-2"><Star size={18} className="text-[#e6a700]" /> Delivery History</h3>
                  {myLoads.filter(l => l.status === 'completed' || l.status === 'delivered').length === 0 ? (
                    <div className="text-center py-12">
                      <Star size={32} className="text-[#cbd5e0] mx-auto mb-3" />
                      <p className="text-[#718096]">No completed deliveries yet</p>
                      <p className="text-[#a0aec0] text-sm mt-1">Complete deliveries to build your rating.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myLoads.filter(l => l.status === 'completed' || l.status === 'delivered').map(load => (
                        <div key={load.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#f7fafc] border border-[#eef2f5]">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e8fbf3] flex-shrink-0"><Truck size={18} className="text-[#128663]" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[#152238] text-sm font-medium truncate">{load.title || CARGO_LABELS[load.cargo_type]}</p>
                            <p className="text-[#718096] text-xs truncate">{load.pickup_address} → {load.delivery_address}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[#128663] text-sm font-semibold">{formatUGX(load.offer_price_ugx)}</p>
                            <p className="text-[#a0aec0] text-xs">{STATUS_LABELS[load.status]}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== NOTIFICATIONS ===== */}
            {activeSection === 'notifications' && (
              <div className="max-w-2xl space-y-4">
                {activeHaul ? (
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#e8fbf3] border border-[#a7e3d0]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white flex-shrink-0"><Navigation size={16} className="text-[#128663]" /></div>
                    <div className="flex-1">
                      <p className="text-[#152238] text-sm font-medium">Active haul in progress</p>
                      <p className="text-[#718096] text-xs mt-0.5">{activeHaul.title || CARGO_LABELS[activeHaul.cargo_type]} → {activeHaul.delivery_address}</p>
                    </div>
                    <button onClick={() => navigate(`/haul/${activeHaul.id}`)} className="text-[#128663] text-sm font-medium hover:text-[#0f7355] flex-shrink-0">Open</button>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#f7fafc] border border-[#eef2f5]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white flex-shrink-0"><Navigation size={16} className="text-[#a0aec0]" /></div>
                    <div className="flex-1">
                      <p className="text-[#152238] text-sm font-medium">No active haul</p>
                      <p className="text-[#718096] text-xs mt-0.5">You have no delivery in progress right now.</p>
                    </div>
                  </div>
                )}
                {awardedLoads.length > 0 && awardedLoads.map(load => (
                  <div key={load.id} className="flex items-start gap-3 p-4 rounded-2xl bg-[#fef9e7] border border-[#f5d97e]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white flex-shrink-0"><Zap size={16} className="text-[#e6a700]" /></div>
                    <div className="flex-1">
                      <p className="text-[#152238] text-sm font-medium">Load awarded to you</p>
                      <p className="text-[#718096] text-xs mt-0.5">{load.title || CARGO_LABELS[load.cargo_type]} — {formatUGX(load.offer_price_ugx)}</p>
                    </div>
                    <button onClick={() => navigate(`/haul/${load.id}`)} className="text-[#e6a700] text-sm font-medium hover:text-[#d49900] flex-shrink-0">Start</button>
                  </div>
                ))}
                {openLoads.length > 0 && (
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#eff6ff] border border-[#bfdbfe]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white flex-shrink-0"><Package size={16} className="text-[#2563eb]" /></div>
                    <div className="flex-1">
                      <p className="text-[#152238] text-sm font-medium">{openLoads.length} new load{openLoads.length > 1 ? 's' : ''} available</p>
                      <p className="text-[#718096] text-xs mt-0.5">Check the Find Loads tab to bid.</p>
                    </div>
                    <button onClick={() => { setActiveSection('loads'); setActiveTab('available'); }} className="text-[#2563eb] text-sm font-medium hover:text-[#1d4ed8] flex-shrink-0">View</button>
                  </div>
                )}
                {activeHaul === null && awardedLoads.length === 0 && openLoads.length === 0 && (
                  <div className="text-center py-16">
                    <Bell size={32} className="text-[#cbd5e0] mx-auto mb-3" />
                    <p className="text-[#718096]">No notifications</p>
                    <p className="text-[#a0aec0] text-sm mt-1">You're all caught up.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Bid Modal */}
      {bidModal && (
        <Modal title={myBids[bidModal.load.id] ? 'Counter Your Offer' : 'Place Your Bid'} onClose={() => setBidModal(null)}>
          <div className="space-y-4">
            <div className="p-3 bg-[#e8fbf3] border border-[#a7e3d0] rounded-xl">
              <p className="text-[#152238] text-sm font-medium">{bidModal.load.title || CARGO_LABELS[bidModal.load.cargo_type]}</p>
              <p className="text-[#718096] text-xs mt-1">{bidModal.load.pickup_address} → {bidModal.load.delivery_address}</p>
              <p className="text-[#128663] text-xs mt-1">Offered: {formatUGX(bidModal.load.offer_price_ugx)}</p>
            </div>
            {myBids[bidModal.load.id] && (
              <div className="p-3 bg-[#fef9e7] border border-[#f5d97e] rounded-xl">
                <p className="text-[#8a6d00] text-xs font-medium">Your current bid: {formatUGX(myBids[bidModal.load.id].bid_amount_ugx)}</p>
                <p className="text-[#8a6d00] text-xs mt-0.5">Status: {myBids[bidModal.load.id].status}</p>
              </div>
            )}
            <div>
              <label className="block text-[#4e5d70] text-sm font-medium mb-1.5">Your {myBids[bidModal.load.id] ? 'Counter-Offer' : 'Bid'} (UGX)</label>
              <input type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)}
                className="w-full bg-white border border-[#e6edf2] text-[#152238] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#128663] transition-colors" min={1000} />
              <p className="text-[#a0aec0] text-xs mt-1">Shipper offered {formatUGX(bidModal.load.offer_price_ugx)}. You can bid above or below this amount.</p>
            </div>
            <div>
              <label className="block text-[#4e5d70] text-sm font-medium mb-1.5">ETA (minutes)</label>
              <input type="number" value={bidEta} onChange={e => setBidEta(e.target.value)} placeholder="e.g. 30"
                className="w-full bg-white border border-[#e6edf2] text-[#152238] placeholder-[#cbd5e0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#128663] transition-colors" />
            </div>
            <div>
              <label className="block text-[#4e5d70] text-sm font-medium mb-1.5">Message (optional)</label>
              <textarea value={bidMessage} onChange={e => setBidMessage(e.target.value)}
                placeholder="e.g. I'm 5 mins from pickup, can collect immediately" rows={2}
                className="w-full bg-white border border-[#e6edf2] text-[#152238] placeholder-[#cbd5e0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#128663] transition-colors resize-none" />
            </div>
            {bidError && <p className="text-[#e54848] text-sm">{bidError}</p>}
            <button onClick={submitBid} disabled={bidLoading}
              className="w-full py-3 bg-[#128663] hover:bg-[#0f7355] disabled:bg-[#128663]/50 text-white font-semibold rounded-xl transition-all">
              {bidLoading ? 'Submitting...' : myBids[bidModal.load.id] ? 'Update Bid' : 'Submit Bid'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
