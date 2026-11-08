import { useState, useEffect, useRef } from 'react';
import { Smartphone, Loader2, CheckCircle2, XCircle, AlertTriangle, Wallet } from 'lucide-react';
import { Modal } from './Modal';
import { requestPayment, pollPaymentStatus } from '../lib/momo';
import { formatUGX } from '../lib/types';
import type { Load } from '../lib/types';

interface PaymentModalProps {
  load: Load;
  onClose: () => void;
  onSuccess: () => void;
}

type PaymentState = 'idle' | 'requesting' | 'waiting' | 'success' | 'failed';

export function PaymentModal({ load, onClose, onSuccess }: PaymentModalProps) {
  const { profile } = useAuthLite();
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [state, setState] = useState<PaymentState>('idle');
  const [error, setError] = useState('');
  const stopPollRef = useRef<(() => void) | null>(null);

  const marketplaceFee = Math.round(load.offer_price_ugx * 0.10);
  const driverEarnings = load.offer_price_ugx - marketplaceFee;

  useEffect(() => {
    return () => { stopPollRef.current?.(); };
  }, []);

  async function handlePay() {
    if (!phone.trim()) { setError('Enter your MTN MoMo phone number'); return; }
    if (!profile) { setError('Not authenticated'); return; }
    setState('requesting');
    setError('');
    try {
      const result = await requestPayment(load.id, profile.id, load.offer_price_ugx, phone.trim());
      setState('waiting');
      stopPollRef.current = pollPaymentStatus(
        result.transactionId,
        (status) => {
          if (status === 'successful') { setState('success'); }
          else if (status === 'failed') { setState('failed'); }
        },
        () => {
          if (state !== 'success' && state !== 'failed') {
            // timeout — stay in waiting
          }
        }
      );
    } catch (e: any) {
      setError(e.message);
      setState('failed');
    }
  }

  function handleClose() {
    stopPollRef.current?.();
    if (state === 'success') onSuccess();
    onClose();
  }

  return (
    <Modal title="MTN MoMo Payment" onClose={handleClose}>
      {state === 'success' ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h3 className="text-white text-lg font-semibold mb-2">Payment Successful!</h3>
          <p className="text-slate-400 text-sm mb-4">
            UGX {formatUGX(load.offer_price_ugx)} has been collected. Your load is now active.
          </p>
          <button onClick={handleClose} className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-colors">
            Continue
          </button>
        </div>
      ) : state === 'failed' ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} className="text-red-400" />
          </div>
          <h3 className="text-white text-lg font-semibold mb-2">Payment Failed</h3>
          <p className="text-slate-400 text-sm mb-4">{error || 'The payment could not be processed. Please try again.'}</p>
          <button onClick={() => { setState('idle'); setError(''); }}
            className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-colors">
            Try Again
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Payment summary */}
          <div className="bg-[#030F0D] border border-teal-900/30 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Load</span>
              <span className="text-white font-medium">{load.title ?? 'Freight load'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total Amount</span>
              <span className="text-white font-bold">{formatUGX(load.offer_price_ugx)}</span>
            </div>
            <div className="border-t border-teal-900/30 pt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Platform Fee (10%)</span>
                <span className="text-amber-400">{formatUGX(marketplaceFee)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Driver Earnings (90%)</span>
                <span className="text-teal-400">{formatUGX(driverEarnings)}</span>
              </div>
            </div>
          </div>

          {/* Phone input */}
          <div>
            <label className="flex items-center gap-1.5 text-slate-300 text-sm font-medium mb-1.5">
              <Smartphone size={14} /> MTN MoMo Phone Number
            </label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 256772123456"
              disabled={state !== 'idle'}
              className="w-full bg-[#030F0D] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-50" />
            <p className="text-slate-500 text-xs mt-1.5">You'll receive a payment prompt on this phone number.</p>
          </div>

          {state === 'waiting' && (
            <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <Loader2 size={18} className="text-amber-400 animate-spin" />
              <div>
                <p className="text-amber-300 text-sm font-medium">Waiting for payment approval...</p>
                <p className="text-slate-500 text-xs">Check your phone for the MTN MoMo prompt.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <button onClick={handlePay} disabled={state !== 'idle'}
            className="w-full py-3.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 disabled:opacity-50 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2">
            {state === 'requesting' ? (
              <><Loader2 size={18} className="animate-spin" /> Sending Request...</>
            ) : state === 'waiting' ? (
              <><Loader2 size={18} className="animate-spin" /> Waiting...</>
            ) : (
              <><Wallet size={18} /> Pay {formatUGX(load.offer_price_ugx)} via MoMo</>
            )}
          </button>
        </div>
      )}
    </Modal>
  );
}

// Avoid circular import — just use the hook directly
import { useAuth } from '../contexts/AuthContext';
function useAuthLite() { return useAuth(); }
