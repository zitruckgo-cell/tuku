import { useState } from 'react';
import { Smartphone, CheckCircle2, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface MomoSetupProps {
  onSaved?: () => void;
  compact?: boolean;
}

export function MomoSetup({ onSaved, compact }: MomoSetupProps) {
  const { profile, refreshProfile } = useAuth();
  const [phone, setPhone] = useState(profile?.momo_phone ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    if (!phone.trim()) { setError('Enter your MTN MoMo phone number'); return; }
    if (!phone.match(/^256\d{9}$/)) { setError('Use format 256XXXXXXXXX (12 digits)'); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.from('profiles').update({
      momo_phone: phone.trim(),
      momo_account_verified: true,
    }).eq('id', profile!.id);
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess(true);
    await refreshProfile();
    onSaved?.();
    setTimeout(() => setSuccess(false), 3000);
  }

  const isVerified = profile?.momo_account_verified && profile?.momo_phone;

  if (compact && isVerified) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[#e8fbf3] border border-[#a7e3d0] rounded-lg text-sm">
        <ShieldCheck size={14} className="text-[#128663]" />
        <span className="text-[#128663]">MoMo payouts: {profile?.momo_phone}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border border-[#e6edf2] bg-white ${compact ? 'p-4' : 'p-6'} mb-5 shadow-sm`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#fef9e7] flex items-center justify-center">
          <Smartphone size={18} className="text-[#e6a700]" />
        </div>
        <div>
          <h3 className="text-[#152238] font-semibold text-sm">MTN MoMo Payout Account</h3>
          <p className="text-[#718096] text-xs">Required to receive automatic payouts</p>
        </div>
      </div>

      {isVerified ? (
        <div className="flex items-center gap-2 p-3 bg-[#e8fbf3] border border-[#a7e3d0] rounded-xl mb-3">
          <CheckCircle2 size={16} className="text-[#128663]" />
          <span className="text-[#128663] text-sm">Connected: {profile?.momo_phone}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-[#fef9e7] border border-[#f5d97e] rounded-xl mb-3">
          <AlertTriangle size={16} className="text-[#e6a700]" />
          <span className="text-[#8a6d00] text-sm">No MoMo account connected — payouts will fail</span>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-[#718096] text-xs mb-1.5">MTN MoMo Phone Number</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="256772123456"
            className="w-full bg-white border border-[#e6edf2] text-[#152238] placeholder-[#cbd5e0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#128663] transition-colors" />
          <p className="text-[#a0aec0] text-xs mt-1">Format: 256XXXXXXXXX (country code + 9 digits)</p>
        </div>
        {error && <p className="text-[#e54848] text-xs flex items-center gap-1"><AlertTriangle size={12} /> {error}</p>}
        {success && <p className="text-[#128663] text-xs flex items-center gap-1"><CheckCircle2 size={12} /> MoMo account saved!</p>}
        <button onClick={handleSave} disabled={loading}
          className="w-full py-2.5 bg-[#e6a700] hover:bg-[#d49900] disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
          {isVerified ? 'Update' : 'Connect'} MoMo Account
        </button>
      </div>
    </div>
  );
}
