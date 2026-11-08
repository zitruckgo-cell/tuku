import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-notifications`;

export async function sendWelcomeEmail(userId: string, email: string, fullName: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ type: 'welcome', userId, email, fullName }),
    });
    if (!res.ok) console.error('Welcome email failed:', await res.text());
  } catch (e) {
    console.error('Welcome email error:', e);
  }
}

export async function sendDeliveryEmail(loadId: string, loadTitle: string, recipientName?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ type: 'delivery_completed', loadId, loadTitle, recipientName }),
    });
    if (!res.ok) console.error('Delivery email failed:', await res.text());
  } catch (e) {
    console.error('Delivery email error:', e);
  }
}
