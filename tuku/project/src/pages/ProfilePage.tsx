import { useState, useEffect } from 'react';
import { Truck, Save, ArrowLeft, CheckCircle, ToggleLeft, ToggleRight, MapPin, CreditCard, FileText, MessageSquare, Wallet, User, Building2, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import { DocumentUpload } from '../components/DocumentUpload';
import { formatUGX } from '../lib/types';

const UGANDA_DISTRICTS = [
  'Kampala', 'Wakiso', 'Mukono', 'Entebbe', 'Luwero', 'Mpigi', 'Butebo',
  'Gulu', 'Mbarara', 'Jinja', 'Mbale', 'Masaka', 'Fort Portal', 'Kabale',
  'Lira', 'Soroti', 'Arua', 'Hoima', 'Masindi', 'Tororo', 'Other',
];

export function ProfilePage() {
  const { profile, refreshProfile, signOut } = useAuth();
  const { navigate } = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [totalEarnings, setTotalEarnings] = useState<number | null>(null);

  const p = profile as any;

  const [form, setForm] = useState({
    full_name: p?.full_name ?? '',
    phone: p?.phone ?? '',
    account_type: p?.account_type ?? 'individual',
    business_name: p?.business_name ?? '',
    vehicle_plate: p?.vehicle_plate ?? '',
    vehicle_model: p?.vehicle_model ?? '',
    address_village: p?.address_village ?? '',
    address_parish: p?.address_parish ?? '',
    address_subcounty: p?.address_subcounty ?? '',
    address_district: p?.address_district ?? '',
    national_id_number: p?.national_id_number ?? '',
    lc_letter_ref: p?.lc_letter_ref ?? '',
    referral_letter_ref: p?.referral_letter_ref ?? '',
    special_instructions: p?.special_instructions ?? '',
  });

  const [docUrls, setDocUrls] = useState({
    national_id_doc_url: p?.national_id_doc_url ?? '',
    lc_letter_doc_url: p?.lc_letter_doc_url ?? '',
    referral_letter_doc_url: p?.referral_letter_doc_url ?? '',
  });

  useEffect(() => {
    if (profile?.role !== 'driver') return;
    supabase
      .from('earnings')
      .select('driver_earnings_ugx')
      .eq('driver_id', profile.id)
      .then(({ data }) => {
        const total = (data ?? []).reduce((sum, e) => sum + (e as any).driver_earnings_ugx, 0);
        setTotalEarnings(total);
      });
  }, [profile?.id]);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setError('');
  }

  async function saveDocUrl(field: string, url: string) {
    if (!profile) return;
    setDocUrls(d => ({ ...d, [field]: url }));
    await supabase.from('profiles').update({ [field]: url }).eq('id', profile.id);
    await refreshProfile();
  }

  async function removeDocUrl(field: string) {
    if (!profile) return;
    setDocUrls(d => ({ ...d, [field]: '' }));
    await supabase.from('profiles').update({ [field]: null }).eq('id', profile.id);
    await refreshProfile();
  }

  async function saveProfile() {
    if (!profile) return;
    if (!form.full_name.trim()) { setError('Full name is required.'); return; }
    setSaving(true);
    const updates: any = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      account_type: form.account_type,
      business_name: form.account_type === 'business' ? form.business_name.trim() : null,
      updated_at: new Date().toISOString(),
    };
    if (profile.role === 'driver') {
      updates.vehicle_plate = form.vehicle_plate.trim() || null;
      updates.vehicle_model = form.vehicle_model.trim() || null;
      updates.address_village = form.address_village.trim() || null;
      updates.address_parish = form.address_parish.trim() || null;
      updates.address_subcounty = form.address_subcounty.trim() || null;
      updates.address_district = form.address_district || null;
      updates.national_id_number = form.national_id_number.trim() || null;
      updates.lc_letter_ref = form.lc_letter_ref.trim() || null;
      updates.referral_letter_ref = form.referral_letter_ref.trim() || null;
      updates.special_instructions = form.special_instructions.trim() || null;
    }
    const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    await refreshProfile();
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function toggleAvailability() {
    if (!profile) return;
    await supabase.from('profiles').update({ is_available: !profile.is_available }).eq('id', profile.id);
    await refreshProfile();
  }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  if (!profile) return null;
  const isDriver = profile.role === 'driver';

  const hasAddress = p?.address_village || p?.address_district;
  const hasDocs = p?.national_id_number || p?.lc_letter_ref;

  return (
    <div className="min-h-screen bg-[#f7fafc] text-[#152238]">
      {/* Portal header */}
      <header className="border-b border-[#e6edf2] bg-white px-4 py-4 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-5">
          <button onClick={() => navigate(isDriver ? '/driver' : '/shipper')} className="flex min-w-0 items-center gap-3 text-left">
            <img src="/trucgo-logo-transparent.webp" alt="ZITRUCKGO LOGISTICS" className="h-12 w-12 rounded-full object-cover ring-1 ring-[#128663]/30" />
            <div className="min-w-0">
              <p className="truncate text-xl font-bold leading-tight text-[#152238]">{isDriver ? 'Driver Portal' : 'Shipper Portal'}</p>
              <p className="text-base text-[#718096]">{profile.full_name.split(' ')[0]}</p>
            </div>
          </button>
          <button onClick={() => navigate('/')} className="rounded-xl p-3 text-[#718096] transition-colors hover:bg-[#f1f6fa] hover:text-[#128663]" aria-label="Home"><Home size={25} /></button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Section label */}
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => navigate(isDriver ? '/driver' : '/shipper')}
            className="p-2 rounded-xl bg-white border border-[#e6edf2] text-[#718096] hover:text-[#128663] hover:border-[#128663] transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-[#152238]">My Profile</h1>
        </div>

        {/* Avatar & Summary */}
        <div className="rounded-3xl border border-[#e6edf2] bg-white p-6 mb-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#128663] to-[#0f7355] flex items-center justify-center text-white text-2xl font-bold">
                {profile.full_name[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#152238]">{profile.full_name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-[#e8fbf3] text-[#128663] border-[#a7e3d0]">
                    {isDriver ? '🛺 Driver' : '📦 Shipper'}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-[#f1f6fa] text-[#4e5d70] border-[#e6edf2]">
                    {profile.account_type === 'business' ? <><Building2 size={11} /> Business</> : <><User size={11} /> Individual</>}
                  </span>
                  {profile.account_type === 'business' && profile.business_name && (
                    <span className="text-[#718096] text-xs">· {profile.business_name}</span>
                  )}
                </div>
                {isDriver && p?.special_instructions && (
                  <p className="text-[#718096] text-xs mt-1.5 italic max-w-xs">"{p.special_instructions}"</p>
                )}
              </div>
            </div>
            <button
              onClick={() => { setEditing(!editing); setError(''); }}
              className={`p-2.5 rounded-xl border transition-colors text-sm font-medium px-3 ${
                editing ? 'bg-[#e8fbf3] border-[#a7e3d0] text-[#128663]' : 'bg-white border-[#e6edf2] text-[#718096] hover:text-[#128663] hover:border-[#128663]'
              }`}
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>
        </div>

        {saved && (
          <div className="mb-4 p-3 bg-[#e8fbf3] border border-[#a7e3d0] rounded-xl text-[#128663] text-sm flex items-center gap-2">
            <CheckCircle size={14} /> Profile saved successfully.
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="rounded-3xl border border-[#e6edf2] bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-[#152238]">{profile.total_deliveries ?? 0}</p>
            <p className="text-[#718096] text-sm mt-0.5">{isDriver ? 'Deliveries' : 'Loads Posted'}</p>
          </div>
          <div className="rounded-3xl border border-[#e6edf2] bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-[#128663]">{(profile.rating ?? 5).toFixed(1)} ★</p>
            <p className="text-[#718096] text-sm mt-0.5">Rating</p>
          </div>
        </div>

        {/* Earnings — driver only */}
        {isDriver && totalEarnings !== null && (
          <div className="rounded-3xl border border-[#a7e3d0] bg-gradient-to-br from-[#e8fbf3] to-white p-5 mb-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={18} className="text-[#128663]" />
              <h3 className="text-[#718096] text-xs uppercase tracking-widest">Total Earnings</h3>
            </div>
            <p className="text-3xl font-bold text-[#128663]">{formatUGX(totalEarnings)}</p>
            <p className="text-[#a0aec0] text-xs mt-1">After 10% marketplace fee · from completed hauls</p>
          </div>
        )}

        {/* Account type — shown for both roles when editing */}
        {editing && (
          <div className="rounded-3xl border border-[#e6edf2] bg-white p-5 mb-5 shadow-sm">
            <h3 className="text-[#718096] text-xs uppercase tracking-widest mb-3">Account Type</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button type="button" onClick={() => set('account_type', 'individual')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${form.account_type === 'individual' ? 'bg-[#e8fbf3] border-[#128663] text-[#128663]' : 'bg-white border-[#e6edf2] text-[#718096] hover:border-[#128663]'}`}>
                <User size={16} /> Individual
              </button>
              <button type="button" onClick={() => set('account_type', 'business')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${form.account_type === 'business' ? 'bg-[#e8fbf3] border-[#128663] text-[#128663]' : 'bg-white border-[#e6edf2] text-[#718096] hover:border-[#128663]'}`}>
                <Building2 size={16} /> Business
              </button>
            </div>
            {form.account_type === 'business' && (
              <Field label="Business Name" value={form.business_name} editing={true} onChange={v => set('business_name', v)} placeholder="e.g. Maama Sarah Logistics Ltd" />
            )}
          </div>
        )}

        {/* Driver availability */}
        {isDriver && (
          <div className="mb-5 rounded-3xl border border-[#e6edf2] bg-white p-5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[#152238] font-medium">Availability</p>
              <p className="text-[#718096] text-sm mt-0.5">
                {profile.is_available ? 'You appear as available to receive loads' : 'You are offline — shippers cannot assign you'}
              </p>
            </div>
            <button onClick={toggleAvailability}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                profile.is_available
                  ? 'bg-[#e8fbf3] border-[#a7e3d0] text-[#128663] hover:bg-[#d5f5e8]'
                  : 'bg-white border-[#e6edf2] text-[#718096] hover:text-[#128663] hover:border-[#128663]'
              }`}>
              {profile.is_available ? <><ToggleRight size={16} /> Online</> : <><ToggleLeft size={16} /> Offline</>}
            </button>
          </div>
        )}

        {/* Personal Details */}
        <div className="rounded-3xl border border-[#e6edf2] bg-white p-5 space-y-4 mb-5 shadow-sm">
          <h3 className="text-[#128663] text-xs uppercase tracking-widest">Personal Details</h3>
          <Field label="Full Name" value={form.full_name} editing={editing} onChange={v => set('full_name', v)} placeholder="Your full name" />
          <Field label="Phone" value={form.phone} editing={editing} onChange={v => set('phone', v)} placeholder="+256 700 000000" type="tel" />
        </div>

        {/* Driver: Vehicle */}
        {isDriver && (
          <div className="rounded-3xl border border-[#e6edf2] bg-white p-5 space-y-4 mb-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Truck size={15} className="text-[#128663]" />
              <h3 className="text-[#128663] text-xs uppercase tracking-widest">Tukutuku</h3>
            </div>
            <Field label="Number Plate" value={form.vehicle_plate} editing={editing} onChange={v => set('vehicle_plate', v.toUpperCase())} placeholder="UAX 123A" mono />
            <Field label="Model" value={form.vehicle_model} editing={editing} onChange={v => set('vehicle_model', v)} placeholder="e.g. Bajaj RE" />
          </div>
        )}

        {/* Driver: Special Instructions */}
        {isDriver && (
          <div className="rounded-3xl border border-[#e6edf2] bg-white p-5 mb-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={15} className="text-[#128663]" />
              <h3 className="text-[#128663] text-xs uppercase tracking-widest">Short Message / Special Instructions</h3>
            </div>
            {editing ? (
              <textarea value={form.special_instructions} onChange={e => set('special_instructions', e.target.value)} rows={3}
                placeholder="e.g. Available weekdays 7am–6pm. Experienced with hospital deliveries. Handle fragile items with care."
                className="w-full bg-white border border-[#e6edf2] text-[#152238] placeholder-[#cbd5e0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#128663] transition-colors resize-none" />
            ) : (
              <p className="text-[#152238] text-sm py-1">
                {p?.special_instructions || <span className="text-[#cbd5e0] italic">No message set</span>}
              </p>
            )}
            {!editing && <p className="text-[#a0aec0] text-xs mt-2">This message is shown to shippers on your driver profile.</p>}
          </div>
        )}


        {/* Driver: Address */}
        {isDriver && (
          <div className="rounded-3xl border border-[#e6edf2] bg-white p-5 space-y-4 mb-5 shadow-sm">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-[#128663]" />
              <h3 className="text-[#128663] text-xs uppercase tracking-widest">Home Address (Ugandan Format)</h3>
            </div>
            {!editing && !hasAddress && (
              <p className="text-[#cbd5e0] text-sm italic">No address on file. Click Edit to add.</p>
            )}
            <Field label="Village / Zone / Estate" value={form.address_village} editing={editing} onChange={v => set('address_village', v)} placeholder="e.g. Kyanja Zone A" />
            <Field label="Parish" value={form.address_parish} editing={editing} onChange={v => set('address_parish', v)} placeholder="e.g. Bukoto Parish" />
            <Field label="Sub-county / Division" value={form.address_subcounty} editing={editing} onChange={v => set('address_subcounty', v)} placeholder="e.g. Kawempe Division" />
            <div>
              <label className="block text-[#4e5d70] text-sm font-medium mb-1.5">District</label>
              {editing ? (
                <select value={form.address_district} onChange={e => set('address_district', e.target.value)}
                  className="w-full bg-white border border-[#e6edf2] text-[#152238] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#128663] transition-colors">
                  <option value="">Select district...</option>
                  {UGANDA_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              ) : (
                <p className="text-[#152238] text-sm py-2">{form.address_district || <span className="text-[#cbd5e0]">—</span>}</p>
              )}
            </div>
          </div>
        )}

        {/* Driver: Document References */}
        {isDriver && (
          <div className="rounded-3xl border border-[#e6edf2] bg-white p-5 space-y-4 mb-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-[#128663]" />
              <h3 className="text-[#128663] text-xs uppercase tracking-widest">Document References</h3>
            </div>
            {!editing && !hasDocs && (
              <p className="text-[#cbd5e0] text-sm italic">No document references on file. Click Edit to add.</p>
            )}
            <Field label="National ID Number" value={form.national_id_number} editing={editing} onChange={v => set('national_id_number', v.toUpperCase())} placeholder="e.g. CM90004876ZTWE" mono />
            <div>
              <label className="block text-[#4e5d70] text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <FileText size={13} className="text-[#128663]" /> LC1 Letter Reference
              </label>
              {editing ? (
                <input type="text" value={form.lc_letter_ref} onChange={e => set('lc_letter_ref', e.target.value)}
                  placeholder="e.g. Nalwoga Christine — LC1 Kyanja Zone A"
                  className="w-full bg-white border border-[#e6edf2] text-[#152238] placeholder-[#cbd5e0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#128663] transition-colors" />
              ) : (
                <p className="text-[#152238] text-sm py-2">{form.lc_letter_ref || <span className="text-[#cbd5e0]">—</span>}</p>
              )}
            </div>
            <div>
              <label className="block text-[#4e5d70] text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <FileText size={13} className="text-[#718096]" /> Referral Letter Reference (optional)
              </label>
              {editing ? (
                <input type="text" value={form.referral_letter_ref} onChange={e => set('referral_letter_ref', e.target.value)}
                  placeholder="e.g. Pastor Robert Ssekandi — Watoto Church Ntinda"
                  className="w-full bg-white border border-[#e6edf2] text-[#152238] placeholder-[#cbd5e0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#128663] transition-colors" />
              ) : (
                <p className="text-[#152238] text-sm py-2">{form.referral_letter_ref || <span className="text-[#cbd5e0]">—</span>}</p>
              )}
            </div>
            <div className="p-3 bg-[#fef9e7] border border-[#f5d97e] rounded-xl text-[#8a6d00] text-xs">
              Physical documents must be verified at the ZITRUCKGO LOGISTICS office. WhatsApp copies to +256 800 100 200.
            </div>
          </div>
        )}

        {/* Driver: Document Uploads */}
        {isDriver && (
          <div className="rounded-3xl border border-[#e6edf2] bg-white p-5 space-y-6 mb-5 shadow-sm">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-[#128663]" />
              <h3 className="text-[#128663] text-xs uppercase tracking-widest">Document Files</h3>
            </div>
            <DocumentUpload
              label="National ID"
              description="Upload a clear photo or scan of your National ID card (both sides)."
              required
              docType="national_id"
              userId={profile.id}
              currentUrl={docUrls.national_id_doc_url}
              onUpload={url => saveDocUrl('national_id_doc_url', url)}
              onRemove={() => removeDocUrl('national_id_doc_url')}
            />
            <DocumentUpload
              label="LC Letter"
              description="Upload the signed and stamped letter from your LC1 Chairperson."
              required
              docType="lc_letter"
              userId={profile.id}
              currentUrl={docUrls.lc_letter_doc_url}
              onUpload={url => saveDocUrl('lc_letter_doc_url', url)}
              onRemove={() => removeDocUrl('lc_letter_doc_url')}
            />
            <DocumentUpload
              label="Referral Letter"
              description="Optional letter from an employer, church leader, or community organisation."
              docType="referral_letter"
              userId={profile.id}
              currentUrl={docUrls.referral_letter_doc_url}
              onUpload={url => saveDocUrl('referral_letter_doc_url', url)}
              onRemove={() => removeDocUrl('referral_letter_doc_url')}
            />
          </div>
        )}

        {error && <div className="mb-4 p-3 bg-[#fef2f2] border border-[#f5b3b3] rounded-xl text-[#e54848] text-sm">{error}</div>}

        {editing && (
          <button onClick={saveProfile} disabled={saving}
            className="w-full mb-5 py-3 bg-[#128663] hover:bg-[#0f7355] disabled:bg-[#128663]/50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}

        {/* Sign out */}
        <div className="rounded-3xl border border-[#e6edf2] bg-white p-5 shadow-sm">
          <h3 className="text-[#128663] text-xs uppercase tracking-widest mb-4">Account</h3>
          <button onClick={handleSignOut}
            className="w-full py-3 border border-[#f5b3b3] hover:bg-[#fef2f2] text-[#e54848] hover:text-[#d63a3a] font-medium rounded-xl transition-all text-sm">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, editing, onChange, placeholder, type = 'text', mono = false }: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-[#4e5d70] text-sm font-medium mb-1.5">{label}</label>
      {editing ? (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className={`w-full bg-white border border-[#e6edf2] text-[#152238] placeholder-[#cbd5e0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#128663] transition-colors ${mono ? 'font-mono tracking-wider' : ''}`} />
      ) : (
        <p className={`text-[#152238] text-sm py-2 ${mono ? 'font-mono tracking-wider' : ''}`}>{value || <span className="text-[#cbd5e0]">—</span>}</p>
      )}
    </div>
  );
}
