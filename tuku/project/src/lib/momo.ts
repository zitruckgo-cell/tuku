import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/momo-payments`;

async function callMomoFunction(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'MoMo request failed');
  return data;
}

export async function requestPayment(loadId: string, shipperId: string, amount: number, phone: string) {
  return callMomoFunction({ action: 'request_payment', loadId, shipperId, amount, phone });
}

export async function checkPaymentStatus(transactionId: string) {
  return callMomoFunction({ action: 'check_status', transactionId });
}

export async function processPayout(loadId: string) {
  return callMomoFunction({ action: 'process_payout', loadId });
}

export async function refundPayment(loadId: string, reason?: string) {
  return callMomoFunction({ action: 'refund', loadId, reason });
}

export function pollPaymentStatus(
  transactionId: string,
  onUpdate: (status: string) => void,
  onComplete: () => void,
  maxAttempts = 30
): () => void {
  let attempts = 0;
  const interval = setInterval(async () => {
    attempts++;
    try {
      const result = await checkPaymentStatus(transactionId);
      onUpdate(result.status);
      if (result.status === 'successful' || result.status === 'failed') {
        clearInterval(interval);
        onComplete();
      }
    } catch {
      // ignore transient errors
    }
    if (attempts >= maxAttempts) {
      clearInterval(interval);
      onComplete();
    }
  }, 5000);
  return () => clearInterval(interval);
}
