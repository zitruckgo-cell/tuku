import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LifeBuoy, Plus, ArrowLeft, Send, MessageCircle, Clock, CheckCircle2,
  AlertTriangle, Loader2, Package, CreditCard, UserCog, Wrench, HelpCircle, Phone,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { SupportTicket, SupportMessage, SupportCategory, SupportTicketStatus } from '../lib/types';

const CATEGORIES: { value: SupportCategory; label: string; icon: typeof Package }[] = [
  { value: 'payment', label: 'Payment', icon: CreditCard },
  { value: 'delivery', label: 'Delivery', icon: Package },
  { value: 'account', label: 'Account', icon: UserCog },
  { value: 'technical', label: 'Technical', icon: Wrench },
  { value: 'other', label: 'Other', icon: HelpCircle },
];

const STATUS_CONFIG: Record<SupportTicketStatus, { label: string; color: string; dot: string }> = {
  open:     { label: 'Open',       color: 'bg-sky-500/15 text-sky-400 border-sky-500/30',       dot: 'bg-sky-400' },
  pending:  { label: 'Pending',    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  resolved: { label: 'Resolved',   color: 'bg-green-500/15 text-green-400 border-green-500/30', dot: 'bg-green-400' },
  closed:   { label: 'Closed',     color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' },
};

function formatTime(iso: string) {
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

export function SupportPage() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState<SupportCategory>('other');
  const [newBody, setNewBody] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTickets = useCallback(async () => {
    const isInitial = tickets.length === 0 && loading;
    if (isInitial) setLoading(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', profile!.id)
      .order('last_message_at', { ascending: false });
    if (error) setError(error.message);
    else setTickets((data as SupportTicket[]) ?? []);
    setLoading(false);
  }, [profile?.id]);

  const fetchMessages = useCallback(async (ticketId: string) => {
    setMsgLoading(true);
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (error) setError(error.message);
    else setMessages((data as SupportMessage[]) ?? []);
    setMsgLoading(false);
  }, []);

  useEffect(() => {
    if (profile) fetchTickets();
  }, [profile?.id, fetchTickets]);

  useEffect(() => {
    if (selectedTicket) fetchMessages(selectedTicket.id);
  }, [selectedTicket, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages when viewing a ticket
  useEffect(() => {
    if (!selectedTicket) return;
    const interval = setInterval(() => fetchMessages(selectedTicket.id), 8000);
    return () => clearInterval(interval);
  }, [selectedTicket, fetchMessages]);

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubject.trim() || !newBody.trim()) return;
    setCreating(true);
    setError('');
    try {
      const { data: ticket, error: ticketErr } = await supabase
        .from('support_tickets')
        .insert({
          user_id: profile!.id,
          subject: newSubject.trim(),
          category: newCategory,
          priority: 'normal',
          status: 'open',
        })
        .select()
        .single();
      if (ticketErr) throw ticketErr;

      const { error: msgErr } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          sender_id: profile!.id,
          sender_role: 'user',
          body: newBody.trim(),
        });
      if (msgErr) throw msgErr;

      setShowNew(false);
      setNewSubject('');
      setNewCategory('other');
      setNewBody('');
      await fetchTickets();
      setSelectedTicket(ticket as SupportTicket);
    } catch (err: any) {
      setError(err.message);
    }
    setCreating(false);
  }

  async function handleSendReply() {
    if (!reply.trim() || !selectedTicket) return;
    setSending(true);
    setError('');
    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: profile!.id,
          sender_role: 'user',
          body: reply.trim(),
        });
      if (error) throw error;

      // Reopen if was pending
      if (selectedTicket.status === 'pending') {
        await supabase
          .from('support_tickets')
          .update({ status: 'open', last_message_at: new Date().toISOString() })
          .eq('id', selectedTicket.id);
      } else {
        await supabase
          .from('support_tickets')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', selectedTicket.id);
      }

      setReply('');
      await fetchMessages(selectedTicket.id);
      await fetchTickets();
    } catch (err: any) {
      setError(err.message);
    }
    setSending(false);
  }

  // New ticket form
  if (showNew) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 px-4 py-6 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        <button onClick={() => setShowNew(false)} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Support
        </button>
        <div className="mb-6">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mb-3">
            <LifeBuoy size={24} className="text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">New Support Ticket</h1>
          <p className="text-slate-400 text-sm mt-1">Tell us what's going on and our team will get back to you.</p>
        </div>

        <form onSubmit={handleCreateTicket} className="space-y-5">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setNewCategory(cat.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    newCategory === cat.value
                      ? 'bg-teal-500/15 border-teal-500/50 text-teal-300'
                      : 'bg-[#0a2420] border-teal-900/40 text-slate-400 hover:text-white hover:border-teal-700/40'
                  }`}
                >
                  <Icon size={15} /> {cat.label}
                </button>
              );
              })}
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Subject *</label>
            <input
              type="text"
              value={newSubject}
              onChange={e => setNewSubject(e.target.value)}
              placeholder="Brief summary of your issue"
              maxLength={120}
              className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Message *</label>
            <textarea
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              placeholder="Describe your issue in detail..."
              rows={5}
              className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={creating || !newSubject.trim() || !newBody.trim()}
            className="w-full py-3.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {creating ? <><Loader2 size={18} className="animate-spin" /> Creating...</> : <><Plus size={18} /> Create Ticket</>}
          </button>
        </form>
      </div>
    );
  }

  // Ticket conversation view
  if (selectedTicket) {
    const status = STATUS_CONFIG[selectedTicket.status];
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 max-w-2xl mx-auto flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-teal-900/30">
          <button onClick={() => { setSelectedTicket(null); setMessages([]); fetchTickets(); }} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-3 transition-colors">
            <ArrowLeft size={16} /> All Tickets
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white truncate">{selectedTicket.subject}</h1>
              <p className="text-slate-500 text-xs mt-0.5">Created {formatTime(selectedTicket.created_at)}</p>
            </div>
            <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} /> {status.label}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
          {msgLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="text-slate-500 animate-spin" /></div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">No messages yet.</div>
          ) : (
            messages.map(msg => {
              const isUser = msg.sender_role === 'user';
              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    isUser
                      ? 'bg-teal-500 text-white rounded-br-md'
                      : 'bg-[#0a2420] border border-teal-900/40 text-slate-200 rounded-bl-md'
                  }`}>
                    {!isUser && <p className="text-teal-400 text-xs font-semibold mb-1">ZITRUCKGO Support</p>}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                    <p className={`text-xs mt-1 ${isUser ? 'text-teal-100/70' : 'text-slate-500'}`}>{formatTime(msg.created_at)}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply box */}
        {selectedTicket.status !== 'closed' ? (
          <div className="px-4 sm:px-6 py-4 border-t border-teal-900/30">
            {error && <div className="flex items-center gap-2 text-red-400 text-sm mb-2"><AlertTriangle size={14} /> {error}</div>}
            <div className="flex items-end gap-2">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                placeholder="Type your reply..."
                rows={1}
                className="flex-1 bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors resize-none max-h-32"
              />
              <button
                onClick={handleSendReply}
                disabled={sending || !reply.trim()}
                className="shrink-0 w-11 h-11 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all flex items-center justify-center"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 sm:px-6 py-4 border-t border-teal-900/30">
            <div className="flex items-center gap-2 text-slate-500 text-sm justify-center">
              <CheckCircle2 size={16} /> This ticket is closed. Create a new one if you need more help.
            </div>
          </div>
        )}
      </div>
    );
  }

  // Ticket list
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
              <LifeBuoy size={20} className="text-teal-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Customer Support</h1>
          </div>
          <p className="text-slate-400 text-sm">Get help with payments, deliveries, and more.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold rounded-xl transition-all"
        >
          <Plus size={16} /> New Ticket
        </button>
      </div>

      {/* Contact card */}
      <div className="mb-6 bg-[#0a2420] border border-teal-900/40 rounded-xl p-4 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0">
          <Phone size={20} className="text-teal-400" />
        </div>
        <div className="min-w-0">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-medium">Call Support</p>
          <a href="tel:+256772123417" className="text-white text-lg font-bold hover:text-teal-300 transition-colors">
            +256 772 123417
          </a>
          <p className="text-slate-500 text-xs mt-0.5">Available Mon–Sat, 8am–8pm EAT</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="text-slate-500 animate-spin" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-4">
            <MessageCircle size={28} className="text-teal-400/60" />
          </div>
          <h3 className="text-white font-semibold mb-1">No support tickets yet</h3>
          <p className="text-slate-400 text-sm">Need help? Create a ticket and our team will assist you.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => {
            const status = STATUS_CONFIG[ticket.status];
            const cat = CATEGORIES.find(c => c.value === ticket.category);
            const CatIcon = cat?.icon ?? HelpCircle;
            return (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className="w-full text-left bg-[#0a2420] border border-teal-900/40 hover:border-teal-700/50 rounded-xl p-4 transition-all group"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                      <CatIcon size={15} className="text-teal-400" />
                    </div>
                    <h3 className="text-white font-medium text-sm truncate group-hover:text-teal-300 transition-colors">{ticket.subject}</h3>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} /> {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 pl-10">
                  <span className="capitalize">{ticket.category}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {formatTime(ticket.last_message_at)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
