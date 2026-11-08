import { useEffect, useState, useCallback } from 'react';
import {
  Users, Truck, Package, ShieldCheck, Clock, XCircle, Ban, CheckCircle2,
  Search, ChevronDown, Edit3, RefreshCw, User, Building2, Phone, MapPin,
  FileText, Star, AlertTriangle, Filter, Wallet, DollarSign, TrendingUp, ArrowDownRight, ArrowUpRight, RotateCcw,
  LifeBuoy, MessageCircle, Send, ArrowLeft, CreditCard, Wrench, HelpCircle, UserCog, Mail, Loader2, Hash, Home, FileCheck,
  Activity, MapPin as MapIcon, BarChart3, Radio, Navigation, Zap, Eye, ExternalLink,
  LayoutDashboard, Bell, Settings, FileBarChart, PackageCheck, UserPlus, Save, LogOut,
  Pencil, X, FileCheck2, ClipboardList, Smartphone,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import type { Profile, VerificationStatus, Transaction, SupportTicket, SupportMessage, SupportTicketStatus } from '../lib/types';
import { formatUGX } from '../lib/types';

type RoleFilter = 'all' | 'shipper' | 'driver' | 'dispatcher';
type StatusFilter = 'all' | VerificationStatus;
type AdminTab = 'overview' | 'deliveries' | 'drivers' | 'customers' | 'tracking' | 'payments' | 'reports' | 'notifications' | 'support' | 'settings' | 'admin_users' | 'documents';

const STATUS_CONFIG: Record<VerificationStatus, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Pending',   color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  approved:  { label: 'Approved',  color: 'bg-green-500/15 text-green-400 border-green-500/30', dot: 'bg-green-400' },
  rejected:  { label: 'Rejected',  color: 'bg-red-500/15 text-red-400 border-red-500/30',     dot: 'bg-red-400' },
  suspended: { label: 'Suspended', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' },
};

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  driver:     { label: 'Driver',     color: 'bg-blue-500/10 text-blue-400',     icon: Truck },
  shipper:    { label: 'Shipper',    color: 'bg-orange-500/10 text-orange-400', icon: Package },
  dispatcher: { label: 'Dispatcher', color: 'bg-purple-500/10 text-purple-400', icon: Radio },
  admin:      { label: 'Admin',      color: 'bg-blue-500/10 text-blue-400',    icon: ShieldCheck },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const { navigate } = useRouter();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportMessage[]>([]);
  const [adminReply, setAdminReply] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [ticketFilter, setTicketFilter] = useState<'all' | SupportTicketStatus>('all');
  const [userLoads, setUserLoads] = useState<any[]>([]);
  const [userBids, setUserBids] = useState<any[]>([]);
  const [overviewData, setOverviewData] = useState<{
    loads: any[];
    riderLocations: any[];
    earnings: any[];
    drivers: Profile[];
    shippers: Profile[];
  }>({ loads: [], riderLocations: [], earnings: [], drivers: [], shippers: [] });
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserRole, setAddUserRole] = useState<'shipper' | 'driver' | 'dispatcher'>('shipper');

  const fetchUsers = useCallback(async () => {
    const isInitial = users.length === 0 && loading;
    if (isInitial) setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  const fetchOverview = useCallback(async () => {
    const isInitial = overviewData.loads.length === 0 && overviewLoading;
    if (isInitial) setOverviewLoading(true);
    try {
      const [loadsRes, riderLocRes, earningsRes] = await Promise.all([
        supabase.from('loads').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('rider_locations').select('*, rider:rider_id(full_name, phone, vehicle_plate)').order('updated_at', { ascending: false }),
        supabase.from('earnings').select('*').order('created_at', { ascending: false }).limit(100),
      ]);
      setOverviewData({
        loads: loadsRes.data ?? [],
        riderLocations: riderLocRes.data ?? [],
        earnings: earningsRes.data ?? [],
        drivers: users.filter(u => u.role === 'driver'),
        shippers: users.filter(u => u.role === 'shipper'),
      });
    } catch (e: any) {
      console.error('Overview fetch error:', e.message);
    }
    setOverviewLoading(false);
  }, [users]);

  const fetchTickets = useCallback(async () => {
    setTicketLoading(true);
    let q = supabase.from('support_tickets').select('*, user:user_id(id, full_name, email, phone, role)').order('last_message_at', { ascending: false });
    if (ticketFilter !== 'all') q = q.eq('status', ticketFilter);
    const { data, error } = await q;
    if (error) setError(error.message);
    else setTickets((data as SupportTicket[]) ?? []);
    setTicketLoading(false);
  }, [ticketFilter]);

  const fetchTicketMessages = useCallback(async (ticketId: string) => {
    const { data, error } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    if (error) setError(error.message);
    else setTicketMessages((data as SupportMessage[]) ?? []);
  }, []);

  const fetchUserDetails = useCallback(async (userId: string, role: string) => {
    setUserDetailLoading(true);
    setUserLoads([]);
    setUserBids([]);
    try {
      if (role === 'shipper') {
        const { data } = await supabase
          .from('loads')
          .select('id, title, status, created_at, budget_ugx, is_paid')
          .eq('shipper_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);
        setUserLoads(data ?? []);
      } else if (role === 'driver') {
        const { data: loads } = await supabase
          .from('loads')
          .select('id, title, status, created_at, offer_price_ugx, shipper_id, shipper:shipper_id(full_name)')
          .eq('awarded_rider_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);
        setUserLoads(loads ?? []);
        const { data: bids } = await supabase
          .from('bids')
          .select('id, bid_amount_ugx, status, created_at, load_id, load:load_id(title)')
          .eq('rider_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);
        setUserBids(bids ?? []);
      }
    } catch (e: any) {
      console.error('Failed to fetch user details:', e);
    }
    setUserDetailLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'support' && !selectedTicket) fetchTickets();
  }, [activeTab, selectedTicket, fetchTickets]);

  useEffect(() => {
    if (selectedTicket) fetchTicketMessages(selectedTicket.id);
  }, [selectedTicket, fetchTicketMessages]);

  const fetchTransactions = useCallback(async () => {
    const isInitial = transactions.length === 0 && txnLoading;
    if (isInitial) setTxnLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*, shipper:shipper_id(full_name, phone), driver:driver_id(full_name, phone)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) setError(error.message);
    else setTransactions((data as Transaction[]) ?? []);
    setTxnLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchTransactions();
  }, [fetchUsers, fetchTransactions]);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
  }, [activeTab, fetchOverview]);

  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(t); }
  }, [successMsg]);

  const filtered = users.filter(u => {
    if (u.role === 'admin') return false;
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter !== 'all' && (u.verification_status ?? 'pending') !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${u.full_name} ${u.phone} ${u.business_name ?? ''} ${u.email ?? ''} ${u.vehicle_plate ?? ''} ${u.national_id_number ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const stats = {
    total: users.filter(u => u.role !== 'admin').length,
    drivers: users.filter(u => u.role === 'driver').length,
    shippers: users.filter(u => u.role === 'shipper').length,
    dispatchers: users.filter(u => u.role === 'dispatcher').length,
    pending: users.filter(u => (u.verification_status ?? 'pending') === 'pending' && u.role !== 'admin').length,
    approved: users.filter(u => u.verification_status === 'approved' && u.role !== 'admin').length,
    suspended: users.filter(u => u.verification_status === 'suspended' && u.role !== 'admin').length,
  };

  const txnStats = {
    totalCollected: transactions.filter(t => t.type === 'collection' && t.status === 'successful').reduce((s, t) => s + t.amount_ugx, 0),
    totalCommission: transactions.filter(t => t.type === 'commission' && t.status === 'successful').reduce((s, t) => s + t.marketplace_fee_ugx, 0),
    totalDisbursed: transactions.filter(t => t.type === 'disbursement' && t.status === 'successful').reduce((s, t) => s + t.driver_earnings_ugx, 0),
    failedPayouts: transactions.filter(t => t.type === 'disbursement' && t.status === 'failed').length,
    pendingPayments: transactions.filter(t => t.status === 'pending').length,
    refunds: transactions.filter(t => t.type === 'refund').length,
  };

  async function updateVerificationStatus(userId: string, status: VerificationStatus) {
    setActionLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ verification_status: status, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
      setSuccessMsg(`User ${status} successfully`);
      await fetchUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, verification_status: status } : null);
      }
    } catch (e: any) {
      setError(e?.message || `Failed to update status to ${status}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function saveEdit() {
    if (!selectedUser) return;
    setActionLoading(true);
    setError('');
    const updates: Record<string, unknown> = {
      full_name: editForm.full_name?.trim(),
      phone: editForm.phone?.trim(),
      email: editForm.email?.trim() || null,
      business_name: editForm.account_type === 'business' ? editForm.business_name?.trim() : null,
      vehicle_plate: editForm.vehicle_plate?.trim() || null,
      vehicle_model: editForm.vehicle_model?.trim() || null,
      address_village: editForm.address_village?.trim() || null,
      address_parish: editForm.address_parish?.trim() || null,
      address_subcounty: editForm.address_subcounty?.trim() || null,
      address_district: editForm.address_district?.trim() || null,
      national_id_number: editForm.national_id_number?.trim() || null,
      lc_letter_ref: editForm.lc_letter_ref?.trim() || null,
      referral_letter_ref: editForm.referral_letter_ref?.trim() || null,
      special_instructions: editForm.special_instructions?.trim() || null,
      admin_notes: editForm.admin_notes?.trim() || null,
      momo_phone: editForm.momo_phone?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    try {
      const { error } = await supabase.from('profiles').update(updates).eq('id', selectedUser.id);
      if (error) throw error;
      setSuccessMsg('Profile updated');
      setEditMode(false);
      await fetchUsers();
    } catch (e: any) {
      setError(e?.message || 'Failed to update profile');
    } finally {
      setActionLoading(false);
    }
  }

  function openEdit(u: Profile) {
    setEditForm({
      full_name: u.full_name,
      phone: u.phone,
      email: u.email ?? '',
      account_type: u.account_type ?? 'individual',
      business_name: u.business_name ?? '',
      vehicle_plate: u.vehicle_plate ?? '',
      vehicle_model: u.vehicle_model ?? '',
      address_village: u.address_village ?? '',
      address_parish: u.address_parish ?? '',
      address_subcounty: u.address_subcounty ?? '',
      address_district: u.address_district ?? '',
      national_id_number: u.national_id_number ?? '',
      lc_letter_ref: u.lc_letter_ref ?? '',
      referral_letter_ref: u.referral_letter_ref ?? '',
      special_instructions: u.special_instructions ?? '',
      admin_notes: u.admin_notes ?? '',
      momo_phone: u.momo_phone ?? '',
    });
    setEditMode(true);
  }

  function openUserDetail(u: Profile) {
    setSelectedUser(u);
    setEditMode(false);
    fetchUserDetails(u.id, u.role);
  }

  const sidebarItems: { key: AdminTab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'deliveries', label: 'Deliveries', icon: PackageCheck },
    { key: 'drivers', label: 'Drivers', icon: Truck },
    { key: 'customers', label: 'Customers', icon: Users },
    { key: 'tracking', label: 'Live Tracking', icon: MapIcon },
    { key: 'documents', label: 'Documents', icon: ClipboardList },
    { key: 'payments', label: 'Payments', icon: Wallet },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'support', label: 'Support', icon: LifeBuoy },
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'admin_users', label: 'Admin Users', icon: ShieldCheck },
  ];

  const activeLabel = sidebarItems.find(i => i.key === activeTab)?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-slate-700/50 bg-[#0d1320] flex flex-col h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <img src="/trucgo-logo-transparent.webp" alt="ZITRUCKGO LOGISTICS" className="w-9 h-9 rounded-full object-cover ring-1 ring-blue-500/30" />
            <div>
              <p className="text-white font-bold text-sm leading-tight">ZITRUCKGO Admin</p>
              <p className="text-slate-500 text-xs">Control Panel</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {sidebarItems.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button key={item.key} onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                }`}>
                <Icon size={17} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-slate-700/50 space-y-2">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {profile?.full_name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-medium truncate">{profile?.full_name ?? 'Admin'}</p>
              <p className="text-slate-500 text-xs truncate">{profile?.email ?? ''}</p>
            </div>
          </div>
          <button onClick={async () => { await signOut(); navigate('/'); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-xs font-medium transition-colors">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-white">{activeLabel}</h1>
              <p className="text-slate-400 text-sm mt-0.5">Manage drivers, shippers, dispatchers, verification, payments & support</p>
            </div>
            <button onClick={fetchUsers} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700/40 hover:bg-slate-600/50 text-blue-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
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

          {activeTab === 'overview' ? (
            <OverviewView data={overviewData} loading={overviewLoading} onRefresh={fetchOverview} />
          ) : activeTab === 'deliveries' ? (
            <DeliveriesView loads={overviewData.loads} loading={overviewLoading} onRefresh={fetchOverview} drivers={overviewData.drivers} />
          ) : activeTab === 'drivers' ? (
            <UsersView
              users={filtered.filter(u => u.role === 'driver')}
              loading={loading}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              stats={stats}
              onViewUser={openUserDetail}
              onUpdateStatus={updateVerificationStatus}
              actionLoading={actionLoading}
              roleLabel="Drivers"
              onAddUser={(role) => { setAddUserRole(role); setShowAddUser(true); }}
            />
          ) : activeTab === 'customers' ? (
            <UsersView
              users={filtered.filter(u => u.role === 'shipper')}
              loading={loading}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              stats={stats}
              onViewUser={openUserDetail}
              onUpdateStatus={updateVerificationStatus}
              actionLoading={actionLoading}
              roleLabel="Customers"
              onAddUser={(role) => { setAddUserRole(role); setShowAddUser(true); }}
            />
          ) : activeTab === 'documents' ? (
            <DocumentsView />
          ) : activeTab === 'tracking' ? (
            <LiveTrackingView riderLocations={overviewData.riderLocations} loads={overviewData.loads} loading={overviewLoading} onRefresh={fetchOverview} />
          ) : activeTab === 'payments' ? (
            <TransactionsView
              transactions={transactions}
              loading={txnLoading}
              txnStats={txnStats}
              onRefresh={fetchTransactions}
            />
          ) : activeTab === 'reports' ? (
            <ReportsView loads={overviewData.loads} earnings={overviewData.earnings} transactions={transactions} users={users} />
          ) : activeTab === 'notifications' ? (
            <NotificationsView loads={overviewData.loads} tickets={tickets} earnings={overviewData.earnings} loading={overviewLoading || ticketLoading} />
          ) : activeTab === 'support' ? (
            <SupportView
              tickets={tickets}
              loading={ticketLoading}
              filter={ticketFilter}
              setFilter={setTicketFilter}
              selectedTicket={selectedTicket}
              setSelectedTicket={setSelectedTicket}
              ticketMessages={ticketMessages}
              adminReply={adminReply}
              setAdminReply={setAdminReply}
              replyLoading={replyLoading}
              onSendReply={async () => {
                if (!selectedTicket || !adminReply.trim()) return;
                setReplyLoading(true);
                try {
                  const { error } = await supabase.from('support_messages').insert({
                    ticket_id: selectedTicket.id,
                    sender_id: profile!.id,
                    sender_role: 'admin',
                    body: adminReply.trim(),
                  });
                  if (error) throw error;
                  await supabase.from('support_tickets').update({
                    status: 'pending',
                    last_message_at: new Date().toISOString(),
                  }).eq('id', selectedTicket.id);
                  setAdminReply('');
                  await fetchTicketMessages(selectedTicket.id);
                  await fetchTickets();
                } catch (e: any) { setError(e.message); }
                setReplyLoading(false);
              }}
              onUpdateStatus={async (ticketId, status) => {
                try {
                  await supabase.from('support_tickets').update({ status }).eq('id', ticketId);
                  await fetchTickets();
                  if (selectedTicket) await fetchTicketMessages(selectedTicket.id);
                  setSuccessMsg(`Ticket marked as ${status}`);
                } catch (e: any) { setError(e.message); }
              }}
              onBack={() => { setSelectedTicket(null); setTicketMessages([]); fetchTickets(); }}
            />
          ) : activeTab === 'settings' ? (
            <SettingsView onSuccess={setSuccessMsg} onError={setError} />
          ) : activeTab === 'admin_users' ? (
            <UsersView
              users={users.filter(u => u.role === 'admin' || u.role === 'dispatcher')}
              loading={loading}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              stats={stats}
              onViewUser={openUserDetail}
              onUpdateStatus={updateVerificationStatus}
              actionLoading={actionLoading}
              roleLabel="Admin & Dispatch Users"
            />
          ) : null}
        </div>
      </div>

      {showAddUser && (
        <AddUserModal
          defaultRole={addUserRole}
          onClose={() => setShowAddUser(false)}
          onSuccess={() => { setShowAddUser(false); fetchUsers(); setSuccessMsg('User created successfully'); }}
          onError={setError}
        />
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setSelectedUser(null); setEditMode(false); }} />
          <div className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-[#0d1320] border border-slate-700/50 rounded-2xl shadow-2xl">
            {/* Modal header */}
            <div className="sticky top-0 bg-[#0d1320] border-b border-slate-700/50 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold overflow-hidden">
                  {selectedUser.photo_url ? (
                    <img src={selectedUser.photo_url} alt={selectedUser.full_name} className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.full_name[0]?.toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedUser.full_name}</h3>
                  <p className="text-slate-400 text-xs">
                    {(() => { const rc = ROLE_CONFIG[selectedUser.role] ?? ROLE_CONFIG.shipper; return rc.label; })()}
                    {' · '}
                    {selectedUser.account_type === 'business' ? 'Business' : 'Individual'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!editMode ? (
                  <button onClick={() => openEdit(selectedUser)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/60 text-blue-300 rounded-lg text-xs font-medium transition-colors">
                    <Edit3 size={14} /> Edit
                  </button>
                ) : (
                  <button onClick={saveEdit} disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors">
                    <CheckCircle2 size={14} /> Save
                  </button>
                )}
                <button onClick={() => { setSelectedUser(null); setEditMode(false); }}
                  className="p-1.5 rounded-lg hover:bg-slate-700/40 text-slate-400 hover:text-white transition-colors">
                  <XCircle size={20} />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-5">
              {/* Verification status banner */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#0a0e1a] border border-slate-700/40">
                <div className="flex items-center gap-3">
                  {(() => {
                    const s = selectedUser.verification_status ?? 'pending';
                    const sc = STATUS_CONFIG[s];
                    return (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${sc.color}`}>
                        <span className={`w-2 h-2 rounded-full ${sc.dot} mr-2`} />
                        {sc.label}
                      </span>
                    );
                  })()}
                  {selectedUser.is_available !== undefined && (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${selectedUser.is_available ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30'}`}>
                      {selectedUser.is_available ? 'Available' : 'Unavailable'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateVerificationStatus(selectedUser.id, 'approved')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                    Approve
                  </button>
                  <button onClick={() => updateVerificationStatus(selectedUser.id, 'rejected')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                    Reject
                  </button>
                  <button onClick={() => updateVerificationStatus(selectedUser.id, 'suspended')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-slate-500/15 hover:bg-slate-500/25 text-slate-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                    Suspend
                  </button>
                  <button onClick={() => updateVerificationStatus(selectedUser.id, 'pending')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                    Set Pending
                  </button>
                </div>
              </div>

              {/* Section: Contact Information */}
              <div>
                <SectionLabel icon={User} label="Contact Information" />
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <DetailField icon={User} label="Full Name" value={selectedUser.full_name}
                    editing={editMode} onChange={v => setEditForm(f => ({ ...f, full_name: v }))} />
                  <DetailField icon={Mail} label="Email" value={selectedUser.email ?? ''}
                    editing={editMode} onChange={v => setEditForm(f => ({ ...f, email: v }))} />
                  <DetailField icon={Phone} label="Phone" value={selectedUser.phone}
                    editing={editMode} onChange={v => setEditForm(f => ({ ...f, phone: v }))} />
                  {selectedUser.account_type === 'business' && (
                    <DetailField icon={Building2} label="Business Name" value={selectedUser.business_name ?? ''}
                      editing={editMode} onChange={v => setEditForm(f => ({ ...f, business_name: v }))} />
                  )}
                </div>
              </div>

              {/* Section: Driver Details */}
              {selectedUser.role === 'driver' && (
                <div>
                  <SectionLabel icon={Truck} label="Vehicle & Driver Details" />
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <DetailField icon={Truck} label="Vehicle Plate" value={selectedUser.vehicle_plate ?? ''}
                      editing={editMode} onChange={v => setEditForm(f => ({ ...f, vehicle_plate: v }))} />
                    <DetailField icon={Truck} label="Vehicle Model" value={selectedUser.vehicle_model ?? ''}
                      editing={editMode} onChange={v => setEditForm(f => ({ ...f, vehicle_model: v }))} />
                    <DetailField icon={Star} label="Rating" value={selectedUser.rating != null ? `${selectedUser.rating.toFixed(1)} / 5.0` : 'No ratings yet'} />
                    <DetailField icon={Package} label="Total Deliveries" value={String(selectedUser.total_deliveries ?? 0)} />
                  </div>
                </div>
              )}

              {/* Section: Address */}
              <div>
                <SectionLabel icon={Home} label="Home Address" />
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <DetailField icon={MapPin} label="Village / Zone" value={selectedUser.address_village ?? ''}
                    editing={editMode} onChange={v => setEditForm(f => ({ ...f, address_village: v }))} />
                  <DetailField icon={MapPin} label="Parish" value={selectedUser.address_parish ?? ''}
                    editing={editMode} onChange={v => setEditForm(f => ({ ...f, address_parish: v }))} />
                  <DetailField icon={MapPin} label="Sub-county / Division" value={selectedUser.address_subcounty ?? ''}
                    editing={editMode} onChange={v => setEditForm(f => ({ ...f, address_subcounty: v }))} />
                  <DetailField icon={MapPin} label="District" value={selectedUser.address_district ?? ''}
                    editing={editMode} onChange={v => setEditForm(f => ({ ...f, address_district: v }))} />
                </div>
              </div>

              {/* Section: MoMo Payout Account (drivers only) */}
              {selectedUser.role === 'driver' && (
                <div>
                  <SectionLabel icon={Smartphone} label="MoMo Payout Account" />
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <DetailField icon={Smartphone} label="MoMo Phone" value={selectedUser.momo_phone ?? ''}
                      editing={editMode} onChange={v => setEditForm(f => ({ ...f, momo_phone: v }))} />
                    <div>
                      <label className="flex items-center gap-1.5 text-slate-400 text-xs uppercase tracking-wider mb-1.5">
                        <ShieldCheck size={12} /> Account Verified
                      </label>
                      <p className="text-white text-sm">
                        {selectedUser.momo_account_verified ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Section: Verification Documents */}
              <div>
                <SectionLabel icon={FileCheck} label="Verification Documents" />
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <DetailField icon={FileText} label="National ID Number" value={selectedUser.national_id_number ?? ''}
                    editing={editMode} onChange={v => setEditForm(f => ({ ...f, national_id_number: v }))} />
                  <DetailField icon={FileText} label="LC Letter Reference" value={selectedUser.lc_letter_ref ?? ''}
                    editing={editMode} onChange={v => setEditForm(f => ({ ...f, lc_letter_ref: v }))} />
                  <DetailField icon={FileText} label="Referral Letter Ref" value={selectedUser.referral_letter_ref ?? ''}
                    editing={editMode} onChange={v => setEditForm(f => ({ ...f, referral_letter_ref: v }))} />
                </div>

                {/* Uploaded document files */}
                <div className="mt-4">
                  <label className="flex items-center gap-1.5 text-slate-400 text-xs uppercase tracking-wider mb-2">
                    <FileCheck size={12} /> Uploaded Documents
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <DocPreview label="National ID" url={selectedUser.national_id_doc_url} />
                    <DocPreview label="LC Letter" url={selectedUser.lc_letter_doc_url} />
                    <DocPreview label="Referral Letter" url={selectedUser.referral_letter_doc_url} />
                    <DocPreview label="Profile Photo" url={selectedUser.photo_url} />
                  </div>
                </div>

                {selectedUser.special_instructions && (
                  <div className="mt-3">
                    <label className="flex items-center gap-1.5 text-slate-400 text-xs uppercase tracking-wider mb-1.5">
                      <MessageCircle size={12} /> Special Instructions
                    </label>
                    {editMode ? (
                      <textarea value={editForm.special_instructions ?? ''} onChange={e => setEditForm(f => ({ ...f, special_instructions: e.target.value }))}
                        rows={3}
                        className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none" />
                    ) : (
                      <p className="text-slate-300 text-sm bg-[#0a0e1a] border border-slate-700/40 rounded-xl px-4 py-3">
                        {selectedUser.special_instructions}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Section: Activity - Loads & Bids */}
              {selectedUser.role !== 'admin' && (
                <div>
                  <SectionLabel icon={Package} label={selectedUser.role === 'shipper' ? 'Posted Loads' : 'Assigned Loads & Bids'} />
                  {userDetailLoading ? (
                    <div className="flex justify-center py-6"><Loader2 size={20} className="text-slate-500 animate-spin" /></div>
                  ) : userLoads.length === 0 && userBids.length === 0 ? (
                    <p className="text-slate-500 text-sm py-3">No activity yet.</p>
                  ) : (
                    <div className="space-y-2 mt-2">
                      {userLoads.map(l => (
                        <div key={l.id} className="flex items-center justify-between bg-[#0a0e1a] border border-slate-700/40 rounded-lg px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{l.title}</p>
                            <p className="text-slate-500 text-xs">{l.created_at ? formatDate(l.created_at) : '—'}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {l.budget_ugx && <span className="text-blue-400 text-sm font-medium">{formatUGX(l.budget_ugx)}</span>}
                            <span className="text-xs text-slate-400 capitalize">{l.status}</span>
                          </div>
                        </div>
                      ))}
                      {userBids.map(b => (
                        <div key={b.id} className="flex items-center justify-between bg-[#0a0e1a] border border-slate-700/40 rounded-lg px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{b.load?.title ?? 'Load'}</p>
                            <p className="text-slate-500 text-xs">Bid placed {b.created_at ? formatDate(b.created_at) : '—'}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-blue-400 text-sm font-medium">{formatUGX(b.bid_amount_ugx)}</span>
                            <span className="text-xs text-slate-400 capitalize">{b.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Admin notes */}
              <div>
                <SectionLabel icon={Edit3} label="Admin Notes" />
                {editMode ? (
                  <textarea value={editForm.admin_notes ?? ''} onChange={e => setEditForm(f => ({ ...f, admin_notes: e.target.value }))}
                    placeholder="Add internal notes about this user..."
                    rows={3}
                    className="w-full mt-2 bg-[#0a0e1a] border border-slate-700/60 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none" />
                ) : (
                  <p className="text-slate-300 text-sm bg-[#0a0e1a] border border-slate-700/40 rounded-xl px-4 py-3 min-h-[60px] mt-2">
                    {selectedUser.admin_notes || <span className="text-slate-500 italic">No notes</span>}
                  </p>
                )}
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-700/40 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Hash size={11} /> {selectedUser.id.slice(0, 8)}...</span>
                {selectedUser.created_at && <span>Joined {formatDateTime(selectedUser.created_at)}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Users View Component (reusable for Drivers, Customers, Admin Users) ---

function UsersView({ users, loading, search, setSearch, statusFilter, setStatusFilter, stats: _stats, onViewUser, onUpdateStatus, actionLoading, roleLabel, onAddUser }: {
  users: Profile[];
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  stats: { total: number; drivers: number; shippers: number; dispatchers: number; pending: number; approved: number; suspended: number };
  onViewUser: (u: Profile) => void;
  onUpdateStatus: (id: string, status: VerificationStatus) => Promise<void>;
  actionLoading: boolean;
  roleLabel: string;
  onAddUser?: (defaultRole: 'shipper' | 'driver' | 'dispatcher') => void;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const localFiltered = users.filter(u => {
    if (statusFilter !== 'all' && (u.verification_status ?? 'pending') !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${u.full_name} ${u.phone} ${u.business_name ?? ''} ${u.email ?? ''} ${u.vehicle_plate ?? ''} ${u.national_id_number ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Users} label="Total" value={localFiltered.length} color="text-blue-400" bg="bg-blue-500/10" />
        <StatCard icon={Clock} label="Pending" value={localFiltered.filter(u => (u.verification_status ?? 'pending') === 'pending').length} color="text-amber-400" bg="bg-amber-500/10" />
        <StatCard icon={CheckCircle2} label="Approved" value={localFiltered.filter(u => u.verification_status === 'approved').length} color="text-green-400" bg="bg-green-500/10" />
        <StatCard icon={Ban} label="Suspended" value={localFiltered.filter(u => u.verification_status === 'suspended').length} color="text-slate-400" bg="bg-slate-500/10" />
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${roleLabel.toLowerCase()}...`}
            className="w-full bg-[#0d1320] border border-slate-700/60 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
        </div>
        <FilterDropdown label="Status" value={statusFilter} onChange={v => setStatusFilter(v as StatusFilter)}
          options={[
            { key: 'all', label: 'All Statuses' },
            { key: 'pending', label: 'Pending' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
            { key: 'suspended', label: 'Suspended' },
          ]} />
        {onAddUser && (
          <button onClick={() => onAddUser(roleLabel.toLowerCase().includes('driver') ? 'driver' : roleLabel.toLowerCase().includes('customer') || roleLabel.toLowerCase().includes('shipper') ? 'shipper' : 'shipper')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-xl text-sm font-semibold transition-colors">
            <UserPlus size={16} /> Add {roleLabel.replace(/s$/, '')}
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading {roleLabel.toLowerCase()}...</div>
        ) : localFiltered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No {roleLabel.toLowerCase()} found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50 text-left">
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Role</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Email</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell">Contact</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Joined</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {localFiltered.map(u => {
                  const status = u.verification_status ?? 'pending';
                  const sc = STATUS_CONFIG[status];
                  const rc = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.shipper;
                  const RIcon = rc.icon;
                  return (
                    <tr key={u.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors cursor-pointer"
                      onClick={() => onViewUser(u)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-semibold shrink-0 overflow-hidden">
                            {u.photo_url ? (
                              <img src={u.photo_url} alt={u.full_name} className="w-full h-full object-cover" />
                            ) : (
                              u.full_name[0]?.toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{u.full_name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {u.account_type === 'business' ? (
                                <><Building2 size={11} className="text-slate-500" /><span className="text-slate-500 text-xs truncate">{u.business_name || 'Business'}</span></>
                              ) : (
                                <><User size={11} className="text-slate-500" /><span className="text-slate-500 text-xs">Individual</span></>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${rc.color}`}>
                          <RIcon size={11} /> {rc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-slate-400 text-sm truncate block max-w-[180px]">{u.email ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                          <Phone size={12} className="text-slate-500" /> {u.phone}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} mr-1.5`} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-sm">
                        {u.created_at ? formatDate(u.created_at) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => onViewUser(u)}
                            className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/60 text-blue-300 rounded-lg text-xs font-medium transition-colors">
                            View
                          </button>
                          <div className="relative">
                            <button onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                              className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                              Actions <ChevronDown size={12} />
                            </button>
                            {openMenuId === u.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                <div className="absolute right-0 top-full mt-1 w-44 bg-[#0d1320] border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden z-20">
                                  <button onClick={() => { onUpdateStatus(u.id, 'approved'); setOpenMenuId(null); }} disabled={actionLoading}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-green-400 hover:bg-green-500/10 text-xs transition-colors disabled:opacity-50">
                                    <CheckCircle2 size={14} /> Approve
                                  </button>
                                  <button onClick={() => { onUpdateStatus(u.id, 'rejected'); setOpenMenuId(null); }} disabled={actionLoading}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-red-400 hover:bg-red-500/10 text-xs transition-colors disabled:opacity-50">
                                    <XCircle size={14} /> Reject
                                  </button>
                                  <button onClick={() => { onUpdateStatus(u.id, 'suspended'); setOpenMenuId(null); }} disabled={actionLoading}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-slate-400 hover:bg-slate-600/30 text-xs transition-colors border-t border-slate-700/40 disabled:opacity-50">
                                    <Ban size={14} /> Suspend
                                  </button>
                                  <button onClick={() => { onUpdateStatus(u.id, 'pending'); setOpenMenuId(null); }} disabled={actionLoading}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-amber-400 hover:bg-amber-500/10 text-xs transition-colors disabled:opacity-50">
                                    <Clock size={14} /> Reset to Pending
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Deliveries View Component ---

function DeliveriesView({ loads, loading, onRefresh, drivers }: {
  loads: any[]; loading: boolean; onRefresh: () => void; drivers: Profile[];
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editingLoad, setEditingLoad] = useState<any | null>(null);
  const [reassigningLoad, setReassigningLoad] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusEditingId, setStatusEditingId] = useState<string | null>(null);

  const statusOptions = ['all', 'posted', 'awarded', 'active_haul', 'completed', 'delivered', 'cancelled'];

  const filtered = loads.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${l.title} ${l.cargo_description} ${l.pickup_address} ${l.delivery_address}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const approvedDrivers = drivers.filter(d => d.verification_status === 'approved');

  async function handleSaveLoad(updated: Record<string, any>) {
    if (!editingLoad) return;
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('loads')
        .update({
          title: updated.title,
          pickup_address: updated.pickup_address,
          delivery_address: updated.delivery_address,
          cargo_type: updated.cargo_type,
          cargo_description: updated.cargo_description,
          weight_kg: updated.weight_kg ? Number(updated.weight_kg) : null,
          urgency: updated.urgency,
          offer_price_ugx: Number(updated.offer_price_ugx),
          status: updated.status,
        })
        .eq('id', editingLoad.id);
      if (err) throw err;
      setEditingLoad(null);
      onRefresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to update load');
    } finally {
      setSaving(false);
    }
  }

  async function handleReassign(driverId: string | null) {
    if (!reassigningLoad) return;
    setSaving(true);
    setError('');
    try {
      const updates: Record<string, any> = { awarded_rider_id: driverId };
      if (!driverId) {
        updates.status = 'posted';
      } else if (reassigningLoad.status === 'posted') {
        updates.status = 'awarded';
      }
      const { error: err } = await supabase
        .from('loads')
        .update(updates)
        .eq('id', reassigningLoad.id);
      if (err) throw err;
      setReassigningLoad(null);
      onRefresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to reassign driver');
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickStatusChange(loadId: string, newStatus: string) {
    setSaving(true);
    setError('');
    try {
      const updates: Record<string, any> = { status: newStatus };
      if (newStatus === 'completed') updates.completed_at = new Date().toISOString();
      if (newStatus === 'delivered') updates.delivered_at = new Date().toISOString();
      const { error: err } = await supabase
        .from('loads')
        .update(updates)
        .eq('id', loadId);
      if (err) throw err;
      onRefresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard icon={Package} label="Total Loads" value={loads.length} color="text-blue-400" bg="bg-blue-500/10" />
        <StatCard icon={Clock} label="Posted" value={loads.filter(l => l.status === 'posted').length} color="text-amber-400" bg="bg-amber-500/10" />
        <StatCard icon={Truck} label="Active" value={loads.filter(l => l.status === 'active_haul' || l.status === 'awarded').length} color="text-blue-400" bg="bg-blue-500/10" />
        <StatCard icon={CheckCircle2} label="Completed" value={loads.filter(l => l.status === 'completed' || l.status === 'delivered').length} color="text-green-400" bg="bg-green-500/10" />
        <StatCard icon={XCircle} label="Cancelled" value={loads.filter(l => l.status === 'cancelled').length} color="text-red-400" bg="bg-red-500/10" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search deliveries..."
            className="w-full bg-[#0d1320] border border-slate-700/60 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
        </div>
        <FilterDropdown label="Status" value={statusFilter} onChange={v => setStatusFilter(v)}
          options={statusOptions.map(s => ({ key: s, label: s === 'all' ? 'All' : s.replace('_', ' ') }))} />
        <button onClick={onRefresh} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-700/40 hover:bg-slate-700/60 text-blue-300 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading deliveries...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No deliveries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50 text-left">
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Load</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Route</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Driver</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Created</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const isActive = l.status === 'active_haul' || l.status === 'awarded';
                  const isCompleted = l.status === 'completed' || l.status === 'delivered';
                  const isCancelled = l.status === 'cancelled';
                  const color = isCompleted ? 'text-green-400' : isCancelled ? 'text-red-400' : isActive ? 'text-blue-400' : 'text-amber-400';
                  return (
                    <tr key={l.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-white text-sm font-medium truncate max-w-[200px]">{l.title || l.cargo_description || 'Untitled'}</p>
                        <p className="text-slate-500 text-xs">{l.cargo_type ?? '—'} {l.weight_kg ? `· ${l.weight_kg}kg` : ''}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-slate-300 text-sm truncate max-w-[180px]">{l.pickup_address ?? '—'}</p>
                        <p className="text-slate-500 text-xs truncate max-w-[180px]">→ {l.delivery_address ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-blue-400 text-sm font-medium">{l.offer_price_ugx ? formatUGX(l.offer_price_ugx) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setStatusEditingId(statusEditingId === l.id ? null : l.id)}
                            className={`text-xs capitalize font-medium ${color} flex items-center gap-1 hover:underline`}
                          >
                            {l.status.replace('_', ' ')}
                            <ChevronDown size={11} />
                          </button>
                          {statusEditingId === l.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setStatusEditingId(null)} />
                              <div className="absolute left-0 top-full mt-1 w-40 bg-[#0d1320] border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden z-20">
                                {['posted', 'awarded', 'active_haul', 'delivered', 'completed', 'cancelled'].map(s => (
                                  <button
                                    key={s}
                                    onClick={() => { handleQuickStatusChange(l.id, s); setStatusEditingId(null); }}
                                    disabled={saving}
                                    className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors disabled:opacity-50 ${
                                      l.status === s ? 'bg-blue-500/15 text-blue-300' : 'text-slate-300 hover:bg-slate-700/40'
                                    }`}
                                  >
                                    {s.replace('_', ' ')}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {l.awarded_rider?.full_name ? (
                          <span className="text-slate-300 text-sm">{l.awarded_rider.full_name}</span>
                        ) : (
                          <span className="text-slate-600 text-xs italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-sm">{l.created_at ? formatDate(l.created_at) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => { setEditingLoad(l); setError(''); }}
                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors" title="Edit shipment">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => { setReassigningLoad(l); setError(''); }}
                            className="p-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 transition-colors" title="Reassign driver">
                            <UserCog size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingLoad && (
        <EditLoadModal
          load={editingLoad}
          saving={saving}
          error={error}
          onSave={handleSaveLoad}
          onClose={() => { setEditingLoad(null); setError(''); }}
        />
      )}

      {reassigningLoad && (
        <ReassignDriverModal
          load={reassigningLoad}
          drivers={approvedDrivers}
          saving={saving}
          error={error}
          onAssign={handleReassign}
          onClose={() => { setReassigningLoad(null); setError(''); }}
        />
      )}
    </div>
  );
}

// --- Documents View (POD + BOL) ---

function DocumentsView() {
  const [bols, setBols] = useState<any[]>([]);
  const [pods, setPods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [docFilter, setDocFilter] = useState<'all' | 'bol' | 'pod'>('all');
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  async function fetchDocs() {
    const isInitial = bols.length === 0 && pods.length === 0 && loading;
    if (isInitial) setLoading(true);
    try {
      const [bolRes, podRes] = await Promise.all([
        supabase
          .from('bills_of_lading')
          .select('*, load:load_id(id, title, status), shipper:shipper_id(full_name, phone), driver:driver_id(full_name, phone, vehicle_plate, vehicle_model)')
          .order('generated_at', { ascending: false })
          .limit(200),
        supabase
          .from('proof_of_delivery')
          .select('*, load:load_id(id, title, status, pickup_address, delivery_address, cargo_type, offer_price_ugx), rider:rider_id(full_name, phone, vehicle_plate)')
          .order('delivered_at', { ascending: false })
          .limit(200),
      ]);
      if (bolRes.error) throw bolRes.error;
      if (podRes.error) throw podRes.error;
      setBols(bolRes.data ?? []);
      setPods(podRes.data ?? []);
    } catch (e: any) {
      console.error('Failed to fetch documents:', e);
    }
    setLoading(false);
  }

  useEffect(() => { fetchDocs(); }, []);

  const filteredBols = bols.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${b.bol_number} ${b.title} ${b.pickup_address} ${b.delivery_address} ${b.shipper?.full_name ?? ''} ${b.driver?.full_name ?? ''}`.toLowerCase().includes(q);
  });

  const filteredPods = pods.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${p.recipient_name} ${p.notes ?? ''} ${p.load?.title ?? ''} ${p.rider?.full_name ?? ''}`.toLowerCase().includes(q);
  });

  const showBol = docFilter === 'all' || docFilter === 'bol';
  const showPod = docFilter === 'all' || docFilter === 'pod';

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={ClipboardList} label="Bills of Lading" value={bols.length} color="text-blue-400" bg="bg-blue-500/10" />
        <StatCard icon={FileCheck2} label="Proofs of Delivery" value={pods.length} color="text-green-400" bg="bg-green-500/10" />
        <StatCard icon={FileText} label="Active BOLs" value={bols.filter(b => b.status === 'active').length} color="text-amber-400" bg="bg-amber-500/10" />
        <StatCard icon={CheckCircle2} label="Completed BOLs" value={bols.filter(b => b.status === 'completed').length} color="text-green-400" bg="bg-green-500/10" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by BOL number, name, address..."
            className="w-full bg-[#0d1320] border border-slate-700/60 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
        </div>
        <div className="flex items-center gap-1 bg-[#0d1320] border border-slate-700/60 rounded-xl p-1">
          {(['all', 'bol', 'pod'] as const).map(f => (
            <button key={f} onClick={() => setDocFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${docFilter === f ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>
              {f === 'all' ? 'All Docs' : f.toUpperCase()}
            </button>
          ))}
        </div>
        <button onClick={fetchDocs} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-700/40 hover:bg-slate-700/60 text-blue-300 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Bills of Lading section */}
      {showBol && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList size={18} className="text-blue-400" />
            <h3 className="text-white font-semibold">Bills of Lading</h3>
            <span className="text-slate-500 text-sm">({filteredBols.length})</span>
          </div>
          <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Loading bills of lading...</div>
            ) : filteredBols.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">No bills of lading found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50 text-left">
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">BOL Number</th>
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Shipment</th>
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Shipper</th>
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Driver</th>
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Generated</th>
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBols.map(b => (
                      <tr key={b.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors cursor-pointer" onClick={() => setSelectedDoc({ type: 'bol', data: b })}>
                        <td className="px-4 py-3">
                          <p className="text-blue-400 text-sm font-mono font-medium">{b.bol_number}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-white text-sm truncate max-w-[180px]">{b.title || b.cargo_description || 'Untitled'}</p>
                          <p className="text-slate-500 text-xs truncate max-w-[180px]">{b.pickup_address} → {b.delivery_address}</p>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-slate-300 text-sm">{b.shipper?.full_name ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-slate-300 text-sm">{b.driver?.full_name ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs capitalize font-medium ${b.status === 'completed' ? 'text-green-400' : b.status === 'cancelled' ? 'text-red-400' : 'text-amber-400'}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-slate-400 text-sm">{formatDateTime(b.generated_at)}</td>
                        <td className="px-4 py-3">
                          <button onClick={(e) => { e.stopPropagation(); setSelectedDoc({ type: 'bol', data: b }); }}
                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors" title="View BOL">
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Proof of Delivery section */}
      {showPod && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileCheck2 size={18} className="text-green-400" />
            <h3 className="text-white font-semibold">Proofs of Delivery</h3>
            <span className="text-slate-500 text-sm">({filteredPods.length})</span>
          </div>
          <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Loading proofs of delivery...</div>
            ) : filteredPods.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">No proofs of delivery found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50 text-left">
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Recipient</th>
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Shipment</th>
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Driver</th>
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Notes</th>
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Delivered At</th>
                      <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPods.map(p => (
                      <tr key={p.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors cursor-pointer" onClick={() => setSelectedDoc({ type: 'pod', data: p })}>
                        <td className="px-4 py-3">
                          <p className="text-white text-sm font-medium">{p.recipient_name}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-slate-300 text-sm truncate max-w-[180px]">{p.load?.title ?? '—'}</p>
                          <p className="text-slate-500 text-xs">{p.load?.status ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-slate-300 text-sm">{p.rider?.full_name ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-slate-400 text-sm truncate max-w-[160px]">{p.notes ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-sm">{formatDateTime(p.delivered_at)}</td>
                        <td className="px-4 py-3">
                          <button onClick={(e) => { e.stopPropagation(); setSelectedDoc({ type: 'pod', data: p }); }}
                            className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors" title="View POD">
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Detail Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedDoc(null)} />
          <div className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-[#0d1320] border border-slate-700/50 rounded-2xl shadow-2xl">
            {selectedDoc.type === 'bol' ? <BOLDetail doc={selectedDoc.data} onClose={() => setSelectedDoc(null)} /> : <PODDetail doc={selectedDoc.data} onClose={() => setSelectedDoc(null)} />}
          </div>
        </div>
      )}
    </div>
  );
}

function BOLDetail({ doc, onClose }: { doc: any; onClose: () => void }) {
  return (
    <>
      <div className="sticky top-0 bg-[#0d1320] border-b border-slate-700/50 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
            <ClipboardList size={20} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Bill of Lading</h3>
            <p className="text-blue-400 text-xs font-mono">{doc.bol_number}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700/40 transition-colors">
          <X size={18} />
        </button>
      </div>
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${doc.status === 'completed' ? 'bg-green-500/15 text-green-400 border-green-500/30' : doc.status === 'cancelled' ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'}`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${doc.status === 'completed' ? 'bg-green-400' : doc.status === 'cancelled' ? 'bg-red-400' : 'bg-amber-400'}`} />
            {doc.status}
          </span>
          <span className="text-slate-500 text-sm">Generated {formatDateTime(doc.generated_at)}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-[#0a0e1a] border border-slate-700/40 rounded-xl">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Shipper</p>
            <p className="text-white text-sm font-medium">{doc.shipper?.full_name ?? '—'}</p>
            <p className="text-slate-400 text-xs">{doc.shipper?.phone ?? ''}</p>
          </div>
          <div className="p-4 bg-[#0a0e1a] border border-slate-700/40 rounded-xl">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Driver</p>
            <p className="text-white text-sm font-medium">{doc.driver?.full_name ?? '—'}</p>
            <p className="text-slate-400 text-xs">{doc.driver?.phone ?? ''}</p>
            {doc.driver?.vehicle_plate && <p className="text-slate-400 text-xs">{doc.driver.vehicle_plate}{doc.driver.vehicle_model ? ` · ${doc.driver.vehicle_model}` : ''}</p>}
          </div>
        </div>

        <div className="p-4 bg-[#0a0e1a] border border-slate-700/40 rounded-xl">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Shipment Details</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-400">Title</span><span className="text-white">{doc.title || '—'}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Cargo Type</span><span className="text-white capitalize">{doc.cargo_type}</span></div>
            {doc.cargo_description && <div className="flex justify-between text-sm gap-4"><span className="text-slate-400 flex-shrink-0">Description</span><span className="text-white text-right">{doc.cargo_description}</span></div>}
            <div className="flex justify-between text-sm"><span className="text-slate-400">Weight</span><span className="text-white">{doc.weight_kg ? `${doc.weight_kg} kg` : '—'}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Urgency</span><span className="text-white capitalize">{doc.urgency}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Price</span><span className="text-blue-400 font-medium">{doc.offer_price_ugx ? formatUGX(doc.offer_price_ugx) : '—'}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-[#0a0e1a] border border-slate-700/40 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <p className="text-slate-400 text-xs uppercase tracking-wider">Pickup</p>
            </div>
            <p className="text-white text-sm">{doc.pickup_address ?? '—'}</p>
          </div>
          <div className="p-4 bg-[#0a0e1a] border border-slate-700/40 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <p className="text-slate-400 text-xs uppercase tracking-wider">Delivery</p>
            </div>
            <p className="text-white text-sm">{doc.delivery_address ?? '—'}</p>
          </div>
        </div>

        {doc.load && (
          <div className="p-4 bg-[#0a0e1a] border border-slate-700/40 rounded-xl">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Linked Load</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">{doc.load.title || 'Untitled'}</p>
                <p className="text-slate-500 text-xs">#{doc.load.id?.slice(0, 8).toUpperCase()}</p>
              </div>
              <span className="text-slate-400 text-xs capitalize">{doc.load.status?.replace('_', ' ')}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function PODDetail({ doc, onClose }: { doc: any; onClose: () => void }) {
  return (
    <>
      <div className="sticky top-0 bg-[#0d1320] border-b border-slate-700/50 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/15 border border-green-500/30 flex items-center justify-center">
            <FileCheck2 size={20} className="text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Proof of Delivery</h3>
            <p className="text-green-400 text-xs">Delivered {formatDateTime(doc.delivered_at)}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700/40 transition-colors">
          <X size={18} />
        </button>
      </div>
      <div className="p-6 space-y-5">
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
          <CheckCircle2 size={24} className="text-green-400" />
          <div>
            <p className="text-green-300 font-medium">Delivery Confirmed</p>
            <p className="text-slate-400 text-xs">Received by {doc.recipient_name}</p>
          </div>
        </div>

        <div className="p-4 bg-[#0a0e1a] border border-slate-700/40 rounded-xl">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Delivery Details</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-400">Recipient</span><span className="text-white font-medium">{doc.recipient_name}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Delivered At</span><span className="text-white">{formatDateTime(doc.delivered_at)}</span></div>
            {doc.notes && (
              <div className="pt-2 border-t border-slate-700/40">
                <p className="text-slate-400 text-xs mb-1">Notes</p>
                <p className="text-white text-sm">{doc.notes}</p>
              </div>
            )}
          </div>
        </div>

        {doc.rider && (
          <div className="p-4 bg-[#0a0e1a] border border-slate-700/40 rounded-xl">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Driver</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                {doc.rider.full_name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{doc.rider.full_name}</p>
                <p className="text-slate-400 text-xs">{doc.rider.phone}</p>
                {doc.rider.vehicle_plate && <p className="text-slate-400 text-xs">{doc.rider.vehicle_plate}</p>}
              </div>
            </div>
          </div>
        )}

        {doc.load && (
          <div className="p-4 bg-[#0a0e1a] border border-slate-700/40 rounded-xl">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Linked Load</p>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-white text-sm font-medium">{doc.load.title || 'Untitled'}</p>
                <p className="text-slate-500 text-xs">#{doc.load.id?.slice(0, 8).toUpperCase()}</p>
              </div>
              <span className="text-slate-400 text-xs capitalize">{doc.load.status?.replace('_', ' ')}</span>
            </div>
            {doc.load.pickup_address && <p className="text-slate-400 text-xs">{doc.load.pickup_address} → {doc.load.delivery_address}</p>}
            {doc.load.offer_price_ugx != null && <p className="text-blue-400 text-sm font-medium mt-1">{formatUGX(doc.load.offer_price_ugx)}</p>}
          </div>
        )}
      </div>
    </>
  );
}

// --- Edit Load Modal ---

function EditLoadModal({ load, saving, error, onSave, onClose }: {
  load: any; saving: boolean; error: string; onSave: (updated: Record<string, any>) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: load.title ?? '',
    pickup_address: load.pickup_address ?? '',
    delivery_address: load.delivery_address ?? '',
    cargo_type: load.cargo_type ?? 'other',
    cargo_description: load.cargo_description ?? '',
    weight_kg: load.weight_kg ?? '',
    urgency: load.urgency ?? 'standard',
    offer_price_ugx: load.offer_price_ugx ?? 0,
    status: load.status ?? 'posted',
  });

  const cargoTypes = [
    { key: 'lab_specimen', label: 'Lab Specimen' },
    { key: 'medication', label: 'Medication' },
    { key: 'supplies', label: 'Medical Supplies' },
    { key: 'documents', label: 'Documents' },
    { key: 'other', label: 'General' },
  ];
  const urgencyLevels = [
    { key: 'standard', label: 'Standard' },
    { key: 'urgent', label: 'Urgent' },
    { key: 'critical', label: 'Critical' },
  ];
  const loadStatuses = [
    { key: 'posted', label: 'Available' },
    { key: 'awarded', label: 'Assigned' },
    { key: 'active_haul', label: 'Active Haul' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0d1320] border border-slate-700/60 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50 sticky top-0 bg-[#0d1320] z-10">
          <div className="flex items-center gap-2">
            <Pencil size={18} className="text-blue-400" />
            <h3 className="text-white font-semibold">Override Shipment Details</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/40 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Title</label>
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Pickup Address</label>
              <input type="text" value={form.pickup_address} onChange={e => setForm({ ...form, pickup_address: e.target.value })}
                className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Delivery Address</label>
              <input type="text" value={form.delivery_address} onChange={e => setForm({ ...form, delivery_address: e.target.value })}
                className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Cargo Type</label>
              <select value={form.cargo_type} onChange={e => setForm({ ...form, cargo_type: e.target.value })}
                className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors">
                {cargoTypes.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Weight (kg)</label>
              <input type="number" step="0.1" value={form.weight_kg} onChange={e => setForm({ ...form, weight_kg: e.target.value })}
                className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Cargo Description</label>
            <textarea value={form.cargo_description} onChange={e => setForm({ ...form, cargo_description: e.target.value })} rows={2}
              className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Urgency</label>
              <select value={form.urgency} onChange={e => setForm({ ...form, urgency: e.target.value })}
                className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors">
                {urgencyLevels.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Price (UGX)</label>
              <input type="number" value={form.offer_price_ugx} onChange={e => setForm({ ...form, offer_price_ugx: e.target.value })}
                className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors">
                {loadStatuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-700/50 sticky bottom-0 bg-[#0d1320]">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-700/40 hover:bg-slate-700/60 text-white font-medium rounded-xl text-sm transition-colors">
            Cancel
          </button>
          <button onClick={() => onSave(form)} disabled={saving}
            className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Reassign Driver Modal ---

function ReassignDriverModal({ load, drivers, saving, error, onAssign, onClose }: {
  load: any; drivers: Profile[]; saving: boolean; error: string; onAssign: (driverId: string | null) => void; onClose: () => void;
}) {
  const [selectedDriver, setSelectedDriver] = useState<string>(load.awarded_rider_id ?? '');
  const [search, setSearch] = useState('');

  const filteredDrivers = drivers.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.full_name?.toLowerCase().includes(q) || d.phone?.toLowerCase().includes(q) || d.vehicle_plate?.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0d1320] border border-slate-700/60 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50 sticky top-0 bg-[#0d1320] z-10">
          <div className="flex items-center gap-2">
            <UserCog size={18} className="text-orange-400" />
            <h3 className="text-white font-semibold">Reassign Driver</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/40 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
          <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
            <p className="text-slate-300 text-sm font-medium">{load.title || load.cargo_description || 'Untitled load'}</p>
            <p className="text-slate-500 text-xs mt-0.5">{load.pickup_address} → {load.delivery_address}</p>
            <p className="text-slate-500 text-xs mt-1">Current driver: {load.awarded_rider?.full_name || 'Unassigned'}</p>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search drivers by name, phone, or plate..."
              className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors" />
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {filteredDrivers.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No approved drivers found.</div>
            ) : (
              filteredDrivers.map(d => (
                <button key={d.id} onClick={() => setSelectedDriver(d.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    selectedDriver === d.id
                      ? 'bg-orange-500/15 border-orange-500 text-white'
                      : 'bg-[#0a0e1a] border-slate-700/40 text-slate-300 hover:border-slate-600'
                  }`}>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {d.full_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{d.phone} {d.vehicle_plate ? `· ${d.vehicle_plate}` : ''}</p>
                  </div>
                  {selectedDriver === d.id && <CheckCircle2 size={18} className="text-orange-400 flex-shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-700/50 sticky bottom-0 bg-[#0d1320]">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-700/40 hover:bg-slate-700/60 text-white font-medium rounded-xl text-sm transition-colors">
            Cancel
          </button>
          {load.awarded_rider_id && (
            <button onClick={() => onAssign(null)} disabled={saving}
              className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl text-sm transition-colors disabled:opacity-50">
              Unassign
            </button>
          )}
          <button onClick={() => onAssign(selectedDriver || null)} disabled={saving || !selectedDriver}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:bg-orange-500/50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Assigning...</> : <><UserCog size={16} /> Assign Driver</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Live Tracking View Component ---

function LiveTrackingView({ riderLocations, loads, loading, onRefresh }: {
  riderLocations: any[]; loads: any[]; loading: boolean; onRefresh: () => void;
}) {
  useEffect(() => {
    const channel = supabase
      .channel('admin-rider-locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_locations' }, () => onRefresh())
      .subscribe();
    const interval = setInterval(() => onRefresh(), 15000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [onRefresh]);

  const now = new Date();
  const onlineRiders = riderLocations.filter(rl => (now.getTime() - new Date(rl.updated_at).getTime()) < 10 * 60 * 1000);
  const activeLoads = loads.filter(l => l.status === 'active_haul' || l.status === 'awarded');

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Radio} label="Online Drivers" value={onlineRiders.length} color="text-emerald-400" bg="bg-emerald-500/10" />
        <StatCard icon={Truck} label="Active Deliveries" value={activeLoads.length} color="text-blue-400" bg="bg-blue-500/10" />
        <StatCard icon={Navigation} label="Tracking Pings" value={riderLocations.length} color="text-blue-400" bg="bg-blue-500/10" />
        <StatCard icon={MapIcon} label="Total Locations" value={riderLocations.length} color="text-orange-400" bg="bg-orange-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 bg-[#0d1320] border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <MapIcon size={16} className="text-blue-400" />
              </div>
              <h3 className="text-white font-semibold text-sm">Live Driver Locations</h3>
            </div>
            <button onClick={onRefresh} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/40 hover:bg-slate-700/60 text-blue-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          <LiveMap riders={riderLocations} loads={activeLoads} />
        </div>

        {/* Online drivers list */}
        <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Online Drivers</h3>
          {onlineRiders.length === 0 ? (
            <div className="text-center py-8">
              <Radio size={24} className="text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No drivers online</p>
            </div>
          ) : (
            <div className="space-y-2">
              {onlineRiders.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0e1a] border border-slate-700/40">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                      {r.rider?.full_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0a0e1a]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{r.rider?.full_name ?? 'Unknown'}</p>
                    <p className="text-slate-500 text-xs">{r.rider?.vehicle_plate ?? '—'} · {formatRelativeTime(r.updated_at)}</p>
                  </div>
                  {r.speed_kmh != null && Number(r.speed_kmh) > 0 && (
                    <span className="flex items-center gap-1 text-xs text-blue-400">
                      <Zap size={11} /> {Math.round(Number(r.speed_kmh))}km/h
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Reports View Component ---

function ReportsView({ loads, earnings, transactions: _transactions, users }: {
  loads: any[]; earnings: any[]; transactions: Transaction[]; users: Profile[];
}) {
  const now = new Date();
  const completedLoads = loads.filter(l => l.status === 'completed' || l.status === 'delivered');
  const cancelledLoads = loads.filter(l => l.status === 'cancelled');
  const totalRevenue = earnings.reduce((s, e) => s + (e.total_amount_ugx ?? 0), 0);
  const totalCommission = earnings.reduce((s, e) => s + (e.marketplace_fee_ugx ?? 0), 0);
  const totalDriverEarnings = earnings.reduce((s, e) => s + (e.driver_earnings_ugx ?? 0), 0);
  const completionRate = loads.length > 0 ? Math.round((completedLoads.length / loads.length) * 100) : 0;
  const cancellationRate = loads.length > 0 ? Math.round((cancelledLoads.length / loads.length) * 100) : 0;

  // Last 7 days data
  const days: { label: string; loads: number; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const next = new Date(d.getTime() + 86400000);
    const dayLoads = loads.filter(l => { const c = new Date(l.created_at); return c >= d && c < next; });
    const dayRevenue = earnings.filter(e => { const c = new Date(e.created_at); return c >= d && c < next; }).reduce((s, e) => s + (e.total_amount_ugx ?? 0), 0);
    days.push({ label: d.toLocaleDateString('en-GB', { weekday: 'short' }), loads: dayLoads.length, revenue: dayRevenue });
  }
  const maxLoads = Math.max(...days.map(d => d.loads), 1);

  // Status breakdown
  const statusBreakdown = [
    { label: 'Pending', count: loads.filter(l => l.status === 'pending').length, color: '#f59e0b' },
    { label: 'Active', count: loads.filter(l => l.status === 'active_haul' || l.status === 'awarded').length, color: '#3b82f6' },
    { label: 'Completed', count: completedLoads.length, color: '#22c55e' },
    { label: 'Cancelled', count: cancelledLoads.length, color: '#ef4444' },
  ];
  const totalForBreakdown = statusBreakdown.reduce((s, b) => s + b.count, 0) || 1;

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={DollarSign} label="Total Revenue" value={totalRevenue} color="text-amber-400" bg="bg-amber-500/10" />
        <StatCard icon={TrendingUp} label="Commission Earned" value={totalCommission} color="text-blue-400" bg="bg-blue-500/10" />
        <StatCard icon={CheckCircle2} label="Completion Rate" value={completionRate} suffix="%" color="text-green-400" bg="bg-green-500/10" />
        <StatCard icon={XCircle} label="Cancellation Rate" value={cancellationRate} suffix="%" color="text-red-400" bg="bg-red-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Loads over time */}
        <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BarChart3 size={16} className="text-blue-400" />
            </div>
            <h3 className="text-white font-semibold text-sm">Loads Created (7 days)</h3>
          </div>
          <BarChart data={days.map(d => ({ label: d.label, count: d.loads }))} maxVal={maxLoads} />
        </div>

        {/* Status breakdown */}
        <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileBarChart size={16} className="text-blue-400" />
            </div>
            <h3 className="text-white font-semibold text-sm">Delivery Status Breakdown</h3>
          </div>
          <div className="space-y-3">
            {statusBreakdown.map(s => {
              const pct = Math.round((s.count / totalForBreakdown) * 100);
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-300 text-sm">{s.label}</span>
                    <span className="text-slate-400 text-xs">{s.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#0a0e1a] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Revenue table */}
      <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Financial Summary</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0a0e1a] rounded-xl p-4 border border-slate-700/40">
            <p className="text-slate-400 text-xs mb-1">Total Revenue</p>
            <p className="text-white text-lg font-bold">{formatUGX(totalRevenue)}</p>
          </div>
          <div className="bg-[#0a0e1a] rounded-xl p-4 border border-slate-700/40">
            <p className="text-slate-400 text-xs mb-1">Commission</p>
            <p className="text-blue-400 text-lg font-bold">{formatUGX(totalCommission)}</p>
          </div>
          <div className="bg-[#0a0e1a] rounded-xl p-4 border border-slate-700/40">
            <p className="text-slate-400 text-xs mb-1">Driver Payouts</p>
            <p className="text-blue-400 text-lg font-bold">{formatUGX(totalDriverEarnings)}</p>
          </div>
          <div className="bg-[#0a0e1a] rounded-xl p-4 border border-slate-700/40">
            <p className="text-slate-400 text-xs mb-1">Total Users</p>
            <p className="text-orange-400 text-lg font-bold">{users.filter(u => u.role !== 'admin').length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Notifications View Component ---

function NotificationsView({ loads, tickets, earnings, loading }: {
  loads: any[]; tickets: SupportTicket[]; earnings: any[]; loading: boolean;
}) {
  type NotifItem = { id: string; icon: React.ElementType; title: string; desc: string; time: string; color: string; bg: string };

  const notifications: NotifItem[] = [];

  // Recent loads
  loads.slice(0, 5).forEach(l => {
    const isActive = l.status === 'active_haul' || l.status === 'awarded';
    const isCompleted = l.status === 'completed' || l.status === 'delivered';
    const isCancelled = l.status === 'cancelled';
    notifications.push({
      id: `load-${l.id}`,
      icon: isCompleted ? CheckCircle2 : isCancelled ? XCircle : isActive ? Truck : Package,
      title: l.title || l.cargo_description || 'New delivery',
      desc: `Status: ${l.status.replace('_', ' ')} · ${l.offer_price_ugx ? formatUGX(l.offer_price_ugx) : ''}`,
      time: l.created_at,
      color: isCompleted ? 'text-green-400' : isCancelled ? 'text-red-400' : isActive ? 'text-blue-400' : 'text-amber-400',
      bg: isCompleted ? 'bg-green-500/10' : isCancelled ? 'bg-red-500/10' : isActive ? 'bg-blue-500/10' : 'bg-amber-500/10',
    });
  });

  // Recent support tickets
  tickets.slice(0, 5).forEach(t => {
    notifications.push({
      id: `ticket-${t.id}`,
      icon: LifeBuoy,
      title: t.subject,
      desc: `Support ticket · ${t.status}`,
      time: t.last_message_at,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    });
  });

  // Recent earnings
  earnings.slice(0, 5).forEach(e => {
    notifications.push({
      id: `earning-${e.id}`,
      icon: DollarSign,
      title: `Payment of ${formatUGX(e.total_amount_ugx ?? 0)}`,
      desc: `Payout status: ${e.payout_status ?? '—'}`,
      time: e.created_at,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    });
  });

  notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Package} label="Load Updates" value={loads.length} color="text-blue-400" bg="bg-blue-500/10" />
        <StatCard icon={LifeBuoy} label="Support Tickets" value={tickets.length} color="text-purple-400" bg="bg-purple-500/10" />
        <StatCard icon={DollarSign} label="Payment Events" value={earnings.length} color="text-amber-400" bg="bg-amber-500/10" />
        <StatCard icon={Bell} label="Total Notifications" value={notifications.length} color="text-blue-400" bg="bg-blue-500/10" />
      </div>

      <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Recent Activity Feed</h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="text-slate-500 animate-spin" /></div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell size={24} className="text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No notifications</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => {
              const Icon = n.icon;
              return (
                <div key={n.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-700/30 transition-colors">
                  <div className={`w-9 h-9 rounded-lg ${n.bg} flex items-center justify-center shrink-0`}>
                    <Icon size={16} className={n.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{n.title}</p>
                    <p className="text-slate-500 text-xs truncate">{n.desc}</p>
                  </div>
                  <span className="text-slate-500 text-xs shrink-0">{formatRelativeTime(n.time)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Settings View Component ---

function SettingsView({ onSuccess, onError }: { onSuccess: (s: string) => void; onError: (s: string) => void }) {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('admin_settings').select('*').eq('id', 1).maybeSingle();
      if (error) onError(error.message);
      else if (data) setSettings(data);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('admin_settings').update({
      platform_name: settings.platform_name,
      commission_rate_pct: Number(settings.commission_rate_pct),
      min_bid_ugx: Number(settings.min_bid_ugx),
      max_load_weight_kg: Number(settings.max_load_weight_kg),
      support_email: settings.support_email,
      support_phone: settings.support_phone,
      maintenance_mode: settings.maintenance_mode,
      auto_approve_drivers: settings.auto_approve_drivers,
      auto_approve_shippers: settings.auto_approve_shippers,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    if (error) onError(error.message);
    else onSuccess('Settings saved successfully');
    setSaving(false);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={28} className="text-slate-500 animate-spin" /></div>;
  if (!settings) return <div className="text-center py-12 text-slate-400">Failed to load settings.</div>;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Platform */}
      <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <Settings size={16} className="text-blue-400" /> Platform Settings
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <SettingsField label="Platform Name" value={settings.platform_name} onChange={(v) => setSettings({ ...settings, platform_name: v })} />
          <SettingsField label="Commission Rate (%)" value={String(settings.commission_rate_pct)} type="number" onChange={(v) => setSettings({ ...settings, commission_rate_pct: v })} />
          <SettingsField label="Min Bid (UGX)" value={String(settings.min_bid_ugx)} type="number" onChange={(v) => setSettings({ ...settings, min_bid_ugx: v })} />
          <SettingsField label="Max Load Weight (kg)" value={String(settings.max_load_weight_kg)} type="number" onChange={(v) => setSettings({ ...settings, max_load_weight_kg: v })} />
        </div>
      </div>

      {/* Support Contact */}
      <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <LifeBuoy size={16} className="text-blue-400" /> Support Contact
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <SettingsField label="Support Email" value={settings.support_email} onChange={(v) => setSettings({ ...settings, support_email: v })} />
          <SettingsField label="Support Phone" value={settings.support_phone} onChange={(v) => setSettings({ ...settings, support_phone: v })} />
        </div>
      </div>

      {/* Automation Toggles */}
      <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <Zap size={16} className="text-blue-400" /> Automation
        </h3>
        <div className="space-y-3">
          <SettingsToggle label="Auto-approve Drivers" desc="Automatically approve new driver registrations" checked={settings.auto_approve_drivers} onChange={(v) => setSettings({ ...settings, auto_approve_drivers: v })} />
          <SettingsToggle label="Auto-approve Shippers" desc="Automatically approve new shipper registrations" checked={settings.auto_approve_shippers} onChange={(v) => setSettings({ ...settings, auto_approve_shippers: v })} />
          <SettingsToggle label="Maintenance Mode" desc="Temporarily disable user access to the platform" checked={settings.maintenance_mode} onChange={(v) => setSettings({ ...settings, maintenance_mode: v })} />
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Settings
      </button>
    </div>
  );
}

function SettingsField({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
    </div>
  );
}

function SettingsToggle({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[#0a0e1a] border border-slate-700/40">
      <div>
        <p className="text-white text-sm font-medium">{label}</p>
        <p className="text-slate-500 text-xs">{desc}</p>
      </div>
      <button onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-slate-600'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

// --- Overview View Component ---

function OverviewView({ data, loading, onRefresh }: {
  data: { loads: any[]; riderLocations: any[]; earnings: any[]; drivers: Profile[]; shippers: Profile[] };
  loading: boolean;
  onRefresh: () => void;
}) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const loads = data.loads;
  const todayLoads = loads.filter(l => l.created_at && new Date(l.created_at) >= new Date(todayStart));
  const activeLoads = loads.filter(l => l.status === 'active_haul' || l.status === 'awarded');
  const completedLoads = loads.filter(l => l.status === 'completed' || l.status === 'delivered');
  const completedToday = completedLoads.filter(l => l.completed_at && new Date(l.completed_at) >= new Date(todayStart));
  const cancelledLoads = loads.filter(l => l.status === 'cancelled');
  const cancelledToday = cancelledLoads.filter(l => l.created_at && new Date(l.created_at) >= new Date(todayStart));

  const onlineDrivers = data.riderLocations.filter(rl => {
    const updated = new Date(rl.updated_at);
    return (now.getTime() - updated.getTime()) < 10 * 60 * 1000;
  });

  const totalCustomers = data.shippers.length;

  const todayEarnings = data.earnings.filter(e => e.created_at && new Date(e.created_at) >= new Date(todayStart));
  const revenueToday = todayEarnings.reduce((s, e) => s + (e.total_amount_ugx ?? 0), 0);
  const pendingPayouts = data.earnings.filter(e => e.payout_status === 'pending' || e.payout_status === 'failed');
  const pendingPayoutsTotal = pendingPayouts.reduce((s, e) => s + (e.driver_earnings_ugx ?? 0), 0);

  // Deliveries over time (last 7 days)
  const days: { label: string; count: number; date: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    const count = loads.filter(l => {
      const c = new Date(l.created_at);
      return c >= d && c < next;
    }).length;
    days.push({ label: d.toLocaleDateString('en-GB', { weekday: 'short' }), count, date: d });
  }
  const maxDayCount = Math.max(...days.map(d => d.count), 1);

  // Recent activity (last 10 loads)
  const recentActivity = [...loads].slice(0, 10);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Dashboard Overview</h2>
          <p className="text-slate-400 text-sm mt-0.5">Real-time logistics metrics and delivery activity</p>
        </div>
        <button onClick={onRefresh} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700/40 hover:bg-slate-700/60 text-blue-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Row 1: 8 stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <OverviewStatCard icon={Package} label="Total Deliveries Today" value={String(todayLoads.length)} color="text-blue-400" bg="bg-blue-500/10" border="border-blue-500/20" />
        <OverviewStatCard icon={Truck} label="Active Deliveries" value={String(activeLoads.length)} color="text-blue-400" bg="bg-blue-500/10" border="border-blue-500/20" pulse={activeLoads.length > 0} />
        <OverviewStatCard icon={CheckCircle2} label="Completed Today" value={String(completedToday.length)} color="text-green-400" bg="bg-green-500/10" border="border-green-500/20" />
        <OverviewStatCard icon={XCircle} label="Cancelled Today" value={String(cancelledToday.length)} color="text-red-400" bg="bg-red-500/10" border="border-red-500/20" />
        <OverviewStatCard icon={Radio} label="Online Drivers" value={String(onlineDrivers.length)} color="text-emerald-400" bg="bg-emerald-500/10" border="border-emerald-500/20" pulse={onlineDrivers.length > 0} />
        <OverviewStatCard icon={Users} label="Total Customers" value={String(totalCustomers)} color="text-orange-400" bg="bg-orange-500/10" border="border-orange-500/20" />
        <OverviewStatCard icon={DollarSign} label="Revenue Today" value={formatUGX(revenueToday)} color="text-amber-400" bg="bg-amber-500/10" border="border-amber-500/20" />
        <OverviewStatCard icon={Clock} label="Pending Payouts" value={String(pendingPayouts.length)} subValue={formatUGX(pendingPayoutsTotal)} color="text-purple-400" bg="bg-purple-500/10" border="border-purple-500/20" />
      </div>

      {/* Row 2: Map + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Live Delivery Map */}
        <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <MapIcon size={16} className="text-blue-400" />
              </div>
              <h3 className="text-white font-semibold text-sm">Live Delivery Map</h3>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="relative flex h-2 w-2">
                {onlineDrivers.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${onlineDrivers.length > 0 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              </span>
              {onlineDrivers.length} live
            </span>
          </div>
          <LiveMap riders={data.riderLocations} loads={activeLoads} />
        </div>

        {/* Deliveries Over Time Chart */}
        <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BarChart3 size={16} className="text-blue-400" />
            </div>
            <h3 className="text-white font-semibold text-sm">Deliveries Over Time</h3>
          </div>
          <BarChart data={days} maxVal={maxDayCount} />
        </div>
      </div>

      {/* Row 3: Recent Activity */}
      <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Activity size={16} className="text-blue-400" />
          </div>
          <h3 className="text-white font-semibold text-sm">Recent Delivery Activity</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="text-slate-500 animate-spin" /></div>
        ) : recentActivity.length === 0 ? (
          <div className="text-center py-8">
            <Package size={28} className="text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No recent activity.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentActivity.map(load => {
              const status = load.status;
              const isActive = status === 'active_haul' || status === 'awarded';
              const isCompleted = status === 'completed' || status === 'delivered';
              const isCancelled = status === 'cancelled';
              const icon = isCompleted ? CheckCircle2 : isCancelled ? XCircle : isActive ? Truck : Package;
              const Icon = icon;
              const color = isCompleted ? 'text-green-400' : isCancelled ? 'text-red-400' : isActive ? 'text-blue-400' : 'text-slate-400';
              const bg = isCompleted ? 'bg-green-500/10' : isCancelled ? 'bg-red-500/10' : isActive ? 'bg-blue-500/10' : 'bg-slate-500/10';
              return (
                <div key={load.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-700/30 transition-colors">
                  <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon size={16} className={color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{load.title || load.cargo_description || 'Delivery'}</p>
                    <p className="text-slate-500 text-xs truncate">
                      {load.pickup_address ?? '—'} → {load.delivery_address ?? '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {load.offer_price_ugx && <span className="text-blue-400 text-sm font-medium">{formatUGX(load.offer_price_ugx)}</span>}
                    <span className={`text-xs capitalize ${color}`}>{status.replace('_', ' ')}</span>
                    <span className="text-slate-500 text-xs hidden sm:inline">{formatRelativeTime(load.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewStatCard({ icon: Icon, label, value, subValue, color, bg, border, pulse }: {
  icon: React.ElementType; label: string; value: string; subValue?: string; color: string; bg: string; border: string; pulse?: boolean;
}) {
  return (
    <div className={`bg-[#0d1320] ${border} border rounded-2xl p-4 transition-all hover:scale-[1.02] hover:bg-slate-700/30`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon size={18} className={color} />
        </div>
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color.replace('text-', 'bg-')} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${color.replace('text-', 'bg-')}`} />
          </span>
        )}
      </div>
      <p className="text-xl font-bold text-white truncate">{value}</p>
      {subValue && <p className="text-slate-400 text-xs mt-0.5 truncate">{subValue}</p>}
      <p className="text-slate-500 text-xs mt-1">{label}</p>
    </div>
  );
}

function BarChart({ data, maxVal }: { data: { label: string; count: number }[]; maxVal: number }) {
  const barWidth = 100 / data.length;
  const chartHeight = 160;
  const padding = { top: 10, bottom: 28, left: 30 };
  const plotHeight = chartHeight - padding.top - padding.bottom;

  return (
    <div>
      <svg viewBox={`0 0 300 ${chartHeight}`} className="w-full" style={{ height: chartHeight }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = padding.top + plotHeight * (1 - f);
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={300} y2={y} stroke="#0e2e2a" strokeWidth={1} />
              <text x={padding.left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#5a7a76">
                {Math.round(maxVal * f)}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const barH = maxVal > 0 ? (d.count / maxVal) * plotHeight : 0;
          const barW = barWidth * 0.6;
          const x = padding.left + i * barWidth + (barWidth - barW) / 2;
          const y = padding.top + plotHeight - barH;
          return (
            <g key={i}>
              <defs>
                <linearGradient id={`bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" />
                  <stop offset="100%" stopColor="#0d9488" />
                </linearGradient>
              </defs>
              <rect x={x} y={y} width={barW} height={Math.max(barH, 2)} rx={3} fill={`url(#bar-grad-${i})`} />
              {d.count > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#14b8a6">
                  {d.count}
                </text>
              )}
              <text x={x + barW / 2} y={chartHeight - 8} textAnchor="middle" fontSize={10} fill="#5a7a76">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-slate-500 text-xs text-center mt-1">Last 7 days</p>
    </div>
  );
}

function LiveMap({ riders, loads }: { riders: any[]; loads: any[] }) {
  // Uganda approximate bounds
  const ugBounds = { minLat: -1.5, maxLat: 4.5, minLng: 29.3, maxLng: 35.1 };
  const width = 300;
  const height = 200;

  function project(lat: number, lng: number) {
    const x = ((lng - ugBounds.minLng) / (ugBounds.maxLng - ugBounds.minLng)) * width;
    const y = height - ((lat - ugBounds.minLat) / (ugBounds.maxLat - ugBounds.minLat)) * height;
    return { x, y };
  }

  const now = new Date();
  const liveRiders = riders.filter(rl => (now.getTime() - new Date(rl.updated_at).getTime()) < 10 * 60 * 1000);
  const activeWithCoords = loads.filter(l => l.pickup_lat && l.pickup_lng);

  return (
    <div className="relative rounded-xl overflow-hidden bg-[#0a0e1a] border border-slate-700/40">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 200 }}>
        {/* Background */}
        <rect width={width} height={height} fill="#031412" />
        {/* Grid */}
        {[0.25, 0.5, 0.75].map(f => (
          <g key={f}>
            <line x1={width * f} y1={0} x2={width * f} y2={height} stroke="#0d1320" strokeWidth={0.5} />
            <line x1={0} y1={height * f} x2={width} y2={height * f} stroke="#0d1320" strokeWidth={0.5} />
          </g>
        ))}
        {/* Active load pickup markers */}
        {activeWithCoords.map((l, i) => {
          const { x, y } = project(l.pickup_lat, l.pickup_lng);
          return (
            <g key={`load-${i}`}>
              <circle cx={x} cy={y} r={4} fill="#f97316" opacity={0.8} />
              <circle cx={x} cy={y} r={8} fill="none" stroke="#f97316" strokeWidth={1} opacity={0.3} />
            </g>
          );
        })}
        {/* Live rider markers */}
        {liveRiders.map((r, i) => {
          const { x, y } = project(r.lat, r.lng);
          return (
            <g key={`rider-${i}`}>
              <circle cx={x} cy={y} r={5} fill="#14b8a6" />
              <circle cx={x} cy={y} r={10} fill="none" stroke="#14b8a6" strokeWidth={1.5} opacity={0.4}>
                <animate attributeName="r" values="5;14;5" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}
        {/* Empty state */}
        {liveRiders.length === 0 && activeWithCoords.length === 0 && (
          <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={11} fill="#4a6a66">
            No live deliveries
          </text>
        )}
      </svg>
      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex items-center gap-3 bg-[#0a0e1a]/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-slate-700/40">
        <span className="flex items-center gap-1.5 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-blue-400" /> Driver
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-orange-400" /> Pickup
        </span>
      </div>
      <div className="absolute top-2 right-2 text-xs text-slate-500 bg-[#0a0e1a]/80 backdrop-blur-sm rounded px-2 py-0.5 border border-slate-700/40">
        Uganda
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
        <Icon size={12} className="text-blue-400" />
      </div>
      <h4 className="text-slate-300 text-xs font-semibold uppercase tracking-wider">{label}</h4>
    </div>
  );
}

// --- Transactions View Component ---

function TransactionsView({ transactions, loading, txnStats, onRefresh }: {
  transactions: Transaction[];
  loading: boolean;
  txnStats: {
    totalCollected: number; totalCommission: number; totalDisbursed: number;
    failedPayouts: number; pendingPayments: number; refunds: number;
  };
  onRefresh: () => void;
}) {
  const TXN_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    collection:    { label: 'Collection',    color: 'text-blue-400',     icon: ArrowDownRight },
    disbursement:  { label: 'Payout',        color: 'text-blue-400',     icon: ArrowUpRight },
    commission:    { label: 'Commission',   color: 'text-amber-400',    icon: DollarSign },
    refund:        { label: 'Refund',       color: 'text-red-400',      icon: RotateCcw },
  };
  const TXN_STATUS_CONFIG: Record<string, string> = {
    pending:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
    successful: 'bg-green-500/15 text-green-400 border-green-500/30',
    failed:     'bg-red-500/15 text-red-400 border-red-500/30',
    refunded:   'bg-slate-500/15 text-slate-400 border-slate-500/30',
  };

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <TxnStatCard icon={ArrowDownRight} label="Collected" value={formatUGX(txnStats.totalCollected)} color="text-blue-400" bg="bg-blue-500/10" />
        <TxnStatCard icon={DollarSign} label="Commission" value={formatUGX(txnStats.totalCommission)} color="text-amber-400" bg="bg-amber-500/10" />
        <TxnStatCard icon={ArrowUpRight} label="Disbursed" value={formatUGX(txnStats.totalDisbursed)} color="text-blue-400" bg="bg-blue-500/10" />
        <TxnStatCard icon={Clock} label="Pending" value={String(txnStats.pendingPayments)} color="text-amber-400" bg="bg-amber-500/10" />
        <TxnStatCard icon={XCircle} label="Failed" value={String(txnStats.failedPayouts)} color="text-red-400" bg="bg-red-500/10" />
        <TxnStatCard icon={RotateCcw} label="Refunds" value={String(txnStats.refunds)} color="text-slate-400" bg="bg-slate-500/10" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Transaction History</h3>
        <button onClick={onRefresh} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/40 hover:bg-slate-700/60 text-blue-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="bg-[#0d1320] border border-slate-700/50 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No transactions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50 text-left">
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Shipper</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Driver</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell">Commission</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => {
                  const tc = TXN_TYPE_CONFIG[t.type] ?? { label: t.type, color: 'text-slate-400', icon: Wallet };
                  const sc = TXN_STATUS_CONFIG[t.status] ?? TXN_STATUS_CONFIG.pending;
                  return (
                    <tr key={t.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <tc.icon size={14} className={tc.color} />
                          <span className={`text-sm font-medium ${tc.color}`}>{tc.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-300 text-sm">{t.shipper?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-300 text-sm">{t.driver?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-white text-sm font-semibold">{formatUGX(t.amount_ugx)}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-amber-400 text-sm">{t.marketplace_fee_ugx ? formatUGX(t.marketplace_fee_ugx) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc}`}>
                          {t.status}
                        </span>
                        {t.failure_reason && (
                          <p className="text-red-400 text-xs mt-1 max-w-[200px] truncate" title={t.failure_reason}>{t.failure_reason}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-sm">{new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">—</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TxnStatCard({ icon: Icon, label, value, color, bg }: { icon: React.ElementType; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="bg-[#0d1320] border border-slate-700/50 rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <Icon size={16} className={color} />
      </div>
      <p className="text-lg font-bold text-white truncate">{value}</p>
      <p className="text-slate-400 text-xs mt-0.5">{label}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg, suffix }: { icon: React.ElementType; label: string; value: number; color: string; bg: string; suffix?: string }) {
  return (
    <div className="bg-[#0d1320] border border-slate-700/50 rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <Icon size={16} className={color} />
      </div>
      <p className="text-2xl font-bold text-white">{value}{suffix}</p>
      <p className="text-slate-400 text-xs mt-0.5">{label}</p>
    </div>
  );
}

function FilterDropdown({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <div className="relative">
      <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none bg-[#0d1320] border border-slate-700/60 text-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors cursor-pointer">
        {options.map(o => <option key={o.key} value={o.key}>{label}: {o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    </div>
  );
}

function DetailField({ icon: Icon, label, value, editing, onChange }: {
  icon: React.ElementType; label: string; value: string; editing?: boolean; onChange?: (v: string) => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-slate-400 text-xs uppercase tracking-wider mb-1.5">
        <Icon size={12} /> {label}
      </label>
      {editing && onChange ? (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
      ) : (
        <p className="text-white text-sm">{value || <span className="text-slate-500">—</span>}</p>
      )}
    </div>
  );
}

function DocPreview({ label, url }: { label: string; url?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!url) {
    return (
      <div className="bg-[#0a0e1a] border border-slate-700/40 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 min-h-[100px]">
        <FileText size={20} className="text-slate-600" />
        <p className="text-slate-600 text-xs">{label}</p>
        <p className="text-slate-700 text-[10px]">Not uploaded</p>
      </div>
    );
  }

  const isImage = url.match(/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i);

  return (
    <>
      <button onClick={() => setExpanded(true)}
        className="bg-[#0a0e1a] border border-slate-700/40 hover:border-blue-600/50 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 min-h-[100px] transition-all group">
        {isImage && !imgError ? (
          <div className="w-full h-16 rounded-lg overflow-hidden bg-slate-700/30">
            <img src={url} alt={label} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          </div>
        ) : (
          <FileText size={20} className="text-blue-400 group-hover:scale-110 transition-transform" />
        )}
        <p className="text-slate-300 text-xs font-medium">{label}</p>
        <p className="text-blue-400 text-[10px] flex items-center gap-1">
          <Eye size={10} /> Click to view
        </p>
      </button>

      {expanded && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setExpanded(false)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative max-w-2xl w-full max-h-[88vh] bg-[#0d1320] border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
              <h4 className="text-white font-semibold text-sm">{label}</h4>
              <div className="flex items-center gap-2">
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/60 text-blue-300 rounded-lg text-xs font-medium transition-colors">
                  <ExternalLink size={13} /> Open
                </a>
                <button onClick={() => setExpanded(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-700/40 text-slate-400 hover:text-white transition-colors">
                  <XCircle size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#0a0e1a]">
              {isImage ? (
                <img src={url} alt={label} className="max-w-full max-h-[70vh] rounded-lg object-contain" />
              ) : (
                <div className="text-center py-12">
                  <FileText size={40} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm mb-3">Document preview not available</p>
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors">
                    <ExternalLink size={14} /> Open in new tab
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const SUPPORT_CATEGORIES: Record<string, { label: string; icon: React.ElementType }> = {
  payment: { label: 'Payment', icon: CreditCard },
  delivery: { label: 'Delivery', icon: Package },
  account: { label: 'Account', icon: UserCog },
  technical: { label: 'Technical', icon: Wrench },
  other: { label: 'Other', icon: HelpCircle },
};

const SUPPORT_STATUS_CONFIG: Record<SupportTicketStatus, { label: string; color: string; dot: string }> = {
  open:     { label: 'Open',     color: 'bg-sky-500/15 text-sky-400 border-sky-500/30',       dot: 'bg-sky-400' },
  pending:  { label: 'Pending',  color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  resolved: { label: 'Resolved', color: 'bg-green-500/15 text-green-400 border-green-500/30', dot: 'bg-green-400' },
  closed:   { label: 'Closed',   color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' },
};

function formatSupportTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function SupportView({
  tickets, loading, filter, setFilter,
  selectedTicket, setSelectedTicket, ticketMessages,
  adminReply, setAdminReply, replyLoading, onSendReply,
  onUpdateStatus, onBack,
}: {
  tickets: SupportTicket[];
  loading: boolean;
  filter: 'all' | SupportTicketStatus;
  setFilter: (f: 'all' | SupportTicketStatus) => void;
  selectedTicket: SupportTicket | null;
  setSelectedTicket: (t: SupportTicket | null) => void;
  ticketMessages: SupportMessage[];
  adminReply: string;
  setAdminReply: (s: string) => void;
  replyLoading: boolean;
  onSendReply: () => void;
  onUpdateStatus: (ticketId: string, status: SupportTicketStatus) => void;
  onBack: () => void;
}) {
  const filterOptions = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'pending', label: 'Pending' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'closed', label: 'Closed' },
  ];

  if (selectedTicket) {
    const status = SUPPORT_STATUS_CONFIG[selectedTicket.status];
    return (
      <div className="flex flex-col h-[calc(100vh-12rem)]">
        <div className="px-1 pb-3 border-b border-slate-700/40">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-3 transition-colors">
            <ArrowLeft size={16} /> All Tickets
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-white font-semibold truncate">{selectedTicket.subject}</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                {selectedTicket.user?.full_name ?? 'Unknown'} · {selectedTicket.user?.email ?? ''} · {selectedTicket.user?.phone ?? ''}
              </p>
            </div>
            <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} /> {status.label}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {ticketMessages.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-8">No messages yet.</p>
          ) : ticketMessages.map(msg => {
            const isAdmin = msg.sender_role === 'admin';
            return (
              <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isAdmin
                    ? 'bg-blue-500 text-white rounded-br-md'
                    : 'bg-[#0d1320] border border-slate-700/50 text-slate-200 rounded-bl-md'
                }`}>
                  {!isAdmin && <p className="text-slate-400 text-xs font-semibold mb-1">{selectedTicket.user?.full_name ?? 'User'}</p>}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                  <p className={`text-xs mt-1 ${isAdmin ? 'text-blue-100/70' : 'text-slate-500'}`}>{formatSupportTime(msg.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-700/40 pt-3 space-y-3">
          {selectedTicket.status !== 'closed' && (
            <div className="flex items-end gap-2">
              <textarea
                value={adminReply}
                onChange={e => setAdminReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendReply(); } }}
                placeholder="Reply as support..."
                rows={1}
                className="flex-1 bg-[#0d1320] border border-slate-700/60 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none max-h-32"
              />
              <button onClick={onSendReply} disabled={replyLoading || !adminReply.trim()}
                className="shrink-0 w-11 h-11 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-xl transition-all flex items-center justify-center">
                {replyLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {selectedTicket.status !== 'resolved' && (
              <button onClick={() => onUpdateStatus(selectedTicket.id, 'resolved')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-medium rounded-lg border border-green-500/30 transition-colors">
                <CheckCircle2 size={13} /> Mark Resolved
              </button>
            )}
            {selectedTicket.status !== 'closed' && (
              <button onClick={() => onUpdateStatus(selectedTicket.id, 'closed')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 text-xs font-medium rounded-lg border border-slate-500/30 transition-colors">
                <XCircle size={13} /> Close Ticket
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {filterOptions.map(opt => (
          <button key={opt.key} onClick={() => setFilter(opt.key as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === opt.key ? 'bg-blue-500 text-white' : 'bg-[#0d1320] text-slate-400 hover:text-white border border-slate-700/50'
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="text-slate-500 animate-spin" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No support tickets found.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tickets.map(ticket => {
            const status = SUPPORT_STATUS_CONFIG[ticket.status];
            const cat = SUPPORT_CATEGORIES[ticket.category];
            const CatIcon = cat?.icon ?? HelpCircle;
            return (
              <button key={ticket.id} onClick={() => setSelectedTicket(ticket)}
                className="w-full text-left bg-[#0d1320] border border-slate-700/50 hover:border-blue-700/50 rounded-xl p-3.5 transition-all group">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <CatIcon size={14} className="text-blue-400" />
                    </div>
                    <h4 className="text-white font-medium text-sm truncate group-hover:text-blue-300 transition-colors">{ticket.subject}</h4>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} /> {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 pl-10">
                  <span>{ticket.user?.full_name ?? 'Unknown'}</span>
                  <span>·</span>
                  <span className="capitalize">{ticket.category}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {formatSupportTime(ticket.last_message_at)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Add User Modal ---

function AddUserModal({ defaultRole, onClose, onSuccess, onError }: {
  defaultRole: 'shipper' | 'driver' | 'dispatcher';
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: defaultRole,
    account_type: 'individual',
    business_name: '',
    vehicle_plate: '',
    vehicle_model: '',
    address_district: '',
    address_village: '',
    national_id_number: '',
    verification_status: 'approved',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isDriver = form.role === 'driver';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.full_name || !form.phone) {
      setError('Email, password, full name, and phone are required');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      onSuccess();
    } catch (e: any) {
      const msg = e?.message || 'Failed to create user';
      setError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0d1320] border border-slate-700/60 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between p-5 border-b border-slate-700/50 sticky top-0 bg-[#0d1320] z-10">
            <div className="flex items-center gap-2">
              <UserPlus size={18} className="text-blue-400" />
              <h3 className="text-white font-semibold">Add New User</h3>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/40 transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="p-5 space-y-4">
            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Email *</label>
                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Password *</label>
                <input type="text" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Full Name *</label>
                <input type="text" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                  className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Phone *</label>
                <input type="tel" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Role</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })}
                  className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors">
                  <option value="shipper">Shipper</option>
                  <option value="driver">Driver</option>
                  <option value="dispatcher">Dispatcher</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Verification Status</label>
                <select value={form.verification_status} onChange={e => setForm({ ...form, verification_status: e.target.value })}
                  className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors">
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Account Type</label>
                <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })}
                  className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors">
                  <option value="individual">Individual</option>
                  <option value="business">Business</option>
                </select>
              </div>
              {form.account_type === 'business' && (
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Business Name</label>
                  <input type="text" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })}
                    className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              )}
            </div>
            {isDriver && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Vehicle Plate</label>
                  <input type="text" value={form.vehicle_plate} onChange={e => setForm({ ...form, vehicle_plate: e.target.value })}
                    className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Vehicle Model</label>
                  <input type="text" value={form.vehicle_model} onChange={e => setForm({ ...form, vehicle_model: e.target.value })}
                    className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">District</label>
                <input type="text" value={form.address_district} onChange={e => setForm({ ...form, address_district: e.target.value })}
                  className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Village</label>
                <input type="text" value={form.address_village} onChange={e => setForm({ ...form, address_village: e.target.value })}
                  className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">National ID Number</label>
              <input type="text" value={form.national_id_number} onChange={e => setForm({ ...form, national_id_number: e.target.value })}
                className="w-full bg-[#0a0e1a] border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
          </div>
          <div className="flex gap-3 p-5 border-t border-slate-700/50 sticky bottom-0 bg-[#0d1320]">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-700/40 hover:bg-slate-700/60 text-white font-medium rounded-xl text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <><UserPlus size={16} /> Create User</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
