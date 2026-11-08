import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, Plus, Trash2, MapPin, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import type { CargoType, Urgency } from '../lib/types';

type Step = 1 | 2 | 3 | 4;

const CARGO_OPTIONS: { value: CargoType; label: string; icon: string; desc: string }[] = [
  { value: 'lab_specimen', label: 'Lab Specimen', icon: '🧪', desc: 'Blood, urine, tissue samples' },
  { value: 'medication', label: 'Medication', icon: '💊', desc: 'Prescriptions, pharmacy items' },
  { value: 'supplies', label: 'Medical Supplies', icon: '🏥', desc: 'Equipment, dressings, PPE' },
  { value: 'documents', label: 'Documents', icon: '📄', desc: 'Papers, contracts, files' },
  { value: 'other', label: 'General Cargo', icon: '📦', desc: 'Small general items' },
];

const URGENCY_OPTIONS: { value: Urgency; label: string; desc: string; color: string }[] = [
  { value: 'standard', label: 'Standard', desc: 'Deliver today', color: 'border-teal-800/60 bg-teal-900/20 text-slate-300' },
  { value: 'urgent', label: 'Urgent', desc: 'Within 2 hours', color: 'border-amber-500 bg-amber-500/10 text-amber-300' },
  { value: 'critical', label: 'Critical', desc: 'Within 1 hour — life-sensitive', color: 'border-red-500 bg-red-500/10 text-red-300' },
];

// Kampala neighborhood coordinates for quick fill
const KAMPALA_LOCATIONS = [
  { name: 'Mulago Hospital', lat: 0.3455, lng: 32.5735 },
  { name: 'Old Taxi Park', lat: 0.3163, lng: 32.5819 },
  { name: 'Nakasero Market', lat: 0.3134, lng: 32.5811 },
  { name: 'Makerere University', lat: 0.3357, lng: 32.5711 },
  { name: 'Ntinda', lat: 0.3404, lng: 32.6128 },
  { name: 'Wandegeya', lat: 0.3342, lng: 32.5710 },
];

export function CreateLoadPage() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    title: '',
    cargo_type: 'documents' as CargoType,
    cargo_description: '',
    weight_kg: '',
    urgency: 'standard' as Urgency,
    pickup_address: '',
    pickup_lat: '',
    pickup_lng: '',
    delivery_address: '',
    delivery_lat: '',
    delivery_lng: '',
    offer_price_ugx: '',
    special_instructions: '',
  });

  const [stops, setStops] = useState<{ stop_type: 'intermediate' | 'return'; address: string; lat: string; lng: string; contact_name: string; contact_phone: string; note: string; ticket_label: string }[]>([]);

  function addStop(type: 'intermediate' | 'return' = 'intermediate') {
    setStops(s => [...s, { stop_type: type, address: '', lat: '', lng: '', contact_name: '', contact_phone: '', note: '', ticket_label: '' }]);
  }

  function updateStop(idx: number, field: string, value: string) {
    setStops(s => s.map((st, i) => i === idx ? { ...st, [field]: value } : st));
  }

  function removeStop(idx: number) {
    setStops(s => s.filter((_, i) => i !== idx));
  }

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setError('');
  }

  function validateStep(): string | null {
    if (step === 1 && !form.cargo_description.trim()) return 'Please describe what you need delivered.';
    if (step === 2) {
      if (!form.pickup_address.trim()) return 'Pickup address is required.';
      if (!form.delivery_address.trim()) return 'Delivery address is required.';
    }
    if (step === 3 && (!form.offer_price_ugx || parseInt(form.offer_price_ugx) < 1000)) return 'Offer price must be at least UGX 1,000.';
    return null;
  }

  function nextStep() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setStep((step + 1) as Step);
    setError('');
  }

  async function submit() {
    if (!profile) return;
    setSubmitting(true);
    setError('');

    const cargo = CARGO_OPTIONS.find(c => c.value === form.cargo_type);
    const autoTitle = form.title.trim() || `${cargo?.label ?? 'Cargo'} – ${form.pickup_address.split(',')[0]} → ${form.delivery_address.split(',')[0]}`;

    const payload: any = {
      shipper_id: profile.id,
      title: autoTitle,
      cargo_type: form.cargo_type,
      cargo_description: form.cargo_description.trim(),
      urgency: form.urgency,
      pickup_address: form.pickup_address.trim(),
      delivery_address: form.delivery_address.trim(),
      offer_price_ugx: parseInt(form.offer_price_ugx),
      status: 'posted',
    };
    if (form.pickup_lat) payload.pickup_lat = parseFloat(form.pickup_lat);
    if (form.pickup_lng) payload.pickup_lng = parseFloat(form.pickup_lng);
    if (form.delivery_lat) payload.delivery_lat = parseFloat(form.delivery_lat);
    if (form.delivery_lng) payload.delivery_lng = parseFloat(form.delivery_lng);
    if (form.weight_kg) payload.weight_kg = parseFloat(form.weight_kg);

    const { data, error } = await supabase.from('loads').insert(payload).select('id').single();
    if (error) { setSubmitting(false); setError(error.message); return; }

    // Insert stops (intermediate + return)
    const validStops = stops.filter(s => s.address.trim());
    if (validStops.length > 0 && data?.id) {
      const stopRows = validStops.map((s, i) => ({
        load_id: data.id,
        stop_order: i + 1,
        stop_type: s.stop_type,
        address: s.address.trim(),
        lat: s.lat ? parseFloat(s.lat) : null,
        lng: s.lng ? parseFloat(s.lng) : null,
        contact_name: s.contact_name.trim() || null,
        contact_phone: s.contact_phone.trim() || null,
        note: s.note.trim() || null,
        ticket_label: s.ticket_label.trim() || null,
      }));
      const { error: stopErr } = await supabase.from('load_stops').insert(stopRows);
      if (stopErr) { console.error('Failed to insert stops:', stopErr.message); }
    }

    setSubmitting(false);
    setSuccess(true);
    setTimeout(() => navigate('/shipper'), 2000);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={36} className="text-teal-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Load Posted!</h2>
          <p className="text-slate-400 text-sm">Your load is now visible to drivers. We'll notify you when a driver is assigned.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030F0D]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => step === 1 ? navigate('/shipper') : setStep((step - 1) as Step)}
            className="p-2 rounded-xl bg-[#0a2420] border border-teal-900/40 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Post a New Load</h1>
            <p className="text-slate-400 text-sm">Step {step} of 4</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${s <= step ? 'bg-teal-500' : 'bg-teal-900/40'}`}
            />
          ))}
        </div>

        {/* Step 1: Cargo */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">What needs delivering?</h2>
              <p className="text-slate-400 text-sm">Select the cargo type and describe the item.</p>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-3">Cargo Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CARGO_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => set('cargo_type', opt.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.cargo_type === opt.value
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-teal-900/40 bg-[#0a2420] hover:border-teal-700/60'
                    }`}
                  >
                    <span className="text-2xl block mb-2">{opt.icon}</span>
                    <p className={`text-sm font-semibold ${form.cargo_type === opt.value ? 'text-teal-400' : 'text-white'}`}>
                      {opt.label}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Description *</label>
              <textarea
                value={form.cargo_description}
                onChange={e => set('cargo_description', e.target.value)}
                placeholder="Describe the item, quantity, handling instructions..."
                rows={3}
                className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Load Title (optional)</label>
              <input
                type="text"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. Blood sample to Mulago Lab"
                className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Weight (kg, optional)</label>
              <input
                type="number"
                value={form.weight_kg}
                onChange={e => set('weight_kg', e.target.value)}
                placeholder="e.g. 0.5"
                step="0.1"
                min="0"
                className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Step 2: Locations */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Pickup & Delivery Locations</h2>
              <p className="text-slate-400 text-sm">Where does the delivery start and end?</p>
            </div>

            {/* Quick Location Buttons */}
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Quick-fill Kampala Locations</p>
              <div className="flex flex-wrap gap-2">
                {KAMPALA_LOCATIONS.map(loc => (
                  <button
                    key={loc.name}
                    onClick={() => {
                      if (!form.pickup_address) {
                        setForm(f => ({ ...f, pickup_address: loc.name + ', Kampala', pickup_lat: String(loc.lat), pickup_lng: String(loc.lng) }));
                      } else {
                        setForm(f => ({ ...f, delivery_address: loc.name + ', Kampala', delivery_lat: String(loc.lat), delivery_lng: String(loc.lng) }));
                      }
                    }}
                    className="px-3 py-1.5 text-xs bg-[#0a2420] border border-teal-900/40 text-slate-400 hover:text-white hover:border-teal-700/60 rounded-lg transition-colors"
                  >
                    📍 {loc.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Pickup Address *</span>
              </label>
              <input
                type="text"
                value={form.pickup_address}
                onChange={e => set('pickup_address', e.target.value)}
                placeholder="e.g. Mulago Hospital, Kampala"
                className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors"
              />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <input type="number" value={form.pickup_lat} onChange={e => set('pickup_lat', e.target.value)} placeholder="Latitude (e.g. 0.3455)" step="0.00001" className="bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-colors" />
                <input type="number" value={form.pickup_lng} onChange={e => set('pickup_lng', e.target.value)} placeholder="Longitude (e.g. 32.5735)" step="0.00001" className="bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" /> Delivery Address *</span>
              </label>
              <input
                type="text"
                value={form.delivery_address}
                onChange={e => set('delivery_address', e.target.value)}
                placeholder="e.g. Nakasero Hospital, Kampala"
                className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors"
              />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <input type="number" value={form.delivery_lat} onChange={e => set('delivery_lat', e.target.value)} placeholder="Latitude (e.g. 0.3134)" step="0.00001" className="bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-colors" />
                <input type="number" value={form.delivery_lng} onChange={e => set('delivery_lng', e.target.value)} placeholder="Longitude (e.g. 32.5811)" step="0.00001" className="bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-colors" />
              </div>
            </div>

            {/* Stops */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="block text-slate-300 text-sm font-medium">Stops & Return Tickets</label>
                  <p className="text-slate-500 text-xs mt-0.5">Add intermediate stops or return tickets for the driver to collect on the way back.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => addStop('intermediate')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-teal-500/10 border border-teal-500/30 text-teal-400 rounded-lg hover:bg-teal-500/20 transition-colors"
                  >
                    <Plus size={14} /> Stop
                  </button>
                  <button
                    onClick={() => addStop('return')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors"
                  >
                    <Plus size={14} /> Return Ticket
                  </button>
                </div>
              </div>
              {stops.length === 0 && (
                <p className="text-slate-500 text-xs italic py-3 text-center border border-dashed border-teal-900/40 rounded-xl">
                  No extra stops. The driver will go directly from pickup to delivery.
                </p>
              )}
              <div className="space-y-3">
                {stops.map((stop, idx) => (
                  <div key={idx} className={`p-4 rounded-xl space-y-3 border ${stop.stop_type === 'return' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-[#0a2420] border-teal-900/40'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`flex items-center gap-2 text-xs font-semibold ${stop.stop_type === 'return' ? 'text-amber-400' : 'text-teal-400'}`}>
                        {stop.stop_type === 'return' ? <><RotateCcw size={14} /> Return Ticket {idx + 1}</> : <><MapPin size={14} /> Stop {idx + 1}</>}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateStop(idx, 'stop_type', stop.stop_type === 'return' ? 'intermediate' : 'return')}
                          className="text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors"
                        >
                          {stop.stop_type === 'return' ? 'Make Intermediate' : 'Make Return'}
                        </button>
                        <button onClick={() => removeStop(idx)} className="text-slate-500 hover:text-red-400 transition-colors" aria-label="Remove stop">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={stop.address}
                      onChange={e => updateStop(idx, 'address', e.target.value)}
                      placeholder={stop.stop_type === 'return' ? 'Return stop address, e.g. Nakasero Lab reception' : 'Stop address, e.g. Wandegeya Pharmacy, Kampala'}
                      className="w-full bg-[#0d2e29] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                    />
                    {stop.stop_type === 'return' && (
                      <input
                        type="text"
                        value={stop.ticket_label}
                        onChange={e => updateStop(idx, 'ticket_label', e.target.value)}
                        placeholder="What to collect, e.g. Signed delivery receipt, lab sample container"
                        className="w-full bg-[#0d2e29] border border-amber-500/30 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={stop.contact_name} onChange={e => updateStop(idx, 'contact_name', e.target.value)} placeholder="Contact name (optional)" className="bg-[#0d2e29] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-colors" />
                      <input type="text" value={stop.contact_phone} onChange={e => updateStop(idx, 'contact_phone', e.target.value)} placeholder="Contact phone (optional)" className="bg-[#0d2e29] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-colors" />
                    </div>
                    <input type="text" value={stop.note} onChange={e => updateStop(idx, 'note', e.target.value)} placeholder="Note for this stop (optional)" className="w-full bg-[#0d2e29] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Pricing & Urgency */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Pricing & Urgency</h2>
              <p className="text-slate-400 text-sm">Set your offer price — riders can bid lower or accept it directly.</p>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Offer Price (UGX) *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">UGX</span>
                <input
                  type="number"
                  value={form.offer_price_ugx}
                  onChange={e => set('offer_price_ugx', e.target.value)}
                  placeholder="e.g. 15000"
                  min="1000"
                  className="w-full bg-[#0a2420] border border-teal-900/50 text-white pl-14 pr-4 py-3 text-sm rounded-xl focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>
              <p className="text-slate-500 text-xs mt-1.5">Typical Kampala tukutuku delivery: UGX 5,000 – 30,000</p>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-3">Urgency Level</label>
              <div className="space-y-3">
                {URGENCY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => set('urgency', opt.value)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                      form.urgency === opt.value ? opt.color.replace('text-', 'border-') + ' ' + opt.color.replace('text-', 'bg-').replace('300', '500/10') : 'border-teal-900/40 bg-[#0a2420] hover:border-teal-700/60'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.urgency === opt.value ? 'border-current' : 'border-slate-600'}`}>
                      {form.urgency === opt.value && <div className="w-2 h-2 rounded-full bg-current" />}
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${form.urgency === opt.value ? '' : 'text-white'}`}>{opt.label}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{opt.desc}</p>
                    </div>
                    {opt.value === 'critical' && <AlertTriangle size={16} className="ml-auto text-red-400" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Special Instructions (optional)</label>
              <textarea
                value={form.special_instructions}
                onChange={e => set('special_instructions', e.target.value)}
                placeholder="e.g. Handle with care, keep upright, call upon arrival"
                rows={2}
                className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Review Your Load</h2>
              <p className="text-slate-400 text-sm">Check the details before posting.</p>
            </div>

            <div className="card rounded-2xl divide-y divide-teal-900/40">
              {[
                { label: 'Cargo Type', value: CARGO_OPTIONS.find(c => c.value === form.cargo_type)?.label },
                { label: 'Description', value: form.cargo_description },
                { label: 'Pickup', value: form.pickup_address },
                ...stops.filter(s => s.address.trim()).map((s, i) => ({ label: s.stop_type === 'return' ? `Return ${i + 1}` : `Stop ${i + 1}`, value: s.stop_type === 'return' && s.ticket_label ? `${s.address} (${s.ticket_label})` : s.address })),
                { label: 'Delivery', value: form.delivery_address },
                { label: 'Urgency', value: URGENCY_OPTIONS.find(u => u.value === form.urgency)?.label },
                { label: 'Offered Price', value: `UGX ${parseInt(form.offer_price_ugx).toLocaleString()}` },
              ].map(row => (
                <div key={row.label} className="flex items-start gap-4 px-5 py-3">
                  <p className="text-slate-400 text-sm w-28 flex-shrink-0">{row.label}</p>
                  <p className="text-white text-sm">{row.value}</p>
                </div>
              ))}
            </div>

            <div className="p-4 bg-teal-500/5 border border-teal-500/20 rounded-xl text-sm text-slate-400">
              Your load will be visible to all verified riders in Kampala immediately after posting.
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button
              onClick={() => setStep((step - 1) as Step)}
              className="px-6 py-3 bg-[#0a2420] border border-teal-900/40 text-white font-medium rounded-xl hover:border-teal-700/60 transition-colors"
            >
              Back
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={nextStep}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all"
            >
              Continue <ArrowRight size={18} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 py-3 bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/50 text-white font-semibold rounded-xl transition-all"
            >
              {submitting ? 'Posting...' : 'Post Load Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
