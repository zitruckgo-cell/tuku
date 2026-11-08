import type { LoadStatus, Urgency } from '../lib/types';
import { STATUS_LABELS, URGENCY_LABELS } from '../lib/types';

const STATUS_COLORS: Record<LoadStatus, string> = {
  posted: 'bg-[#fef9e7] text-[#8a6d00] border-[#f5d97e]',
  awarded: 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]',
  active_haul: 'bg-[#fff7ed] text-[#ea580c] border-[#fed7aa]',
  delivered: 'bg-[#e8fbf3] text-[#128663] border-[#a7e3d0]',
  completed: 'bg-[#f1f6fa] text-[#4e5d70] border-[#e6edf2]',
  cancelled: 'bg-[#fef2f2] text-[#e54848] border-[#f5b3b3]',
};

const URGENCY_COLORS: Record<Urgency, string> = {
  standard: 'bg-[#f1f6fa] text-[#718096] border-[#e6edf2]',
  urgent: 'bg-[#fef9e7] text-[#8a6d00] border-[#f5d97e]',
  critical: 'bg-[#fef2f2] text-[#e54848] border-[#f5b3b3]',
};

export function StatusBadge({ status }: { status: LoadStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${URGENCY_COLORS[urgency]}`}>
      {urgency === 'critical' && '⚡ '}
      {urgency === 'urgent' && '🔥 '}
      {URGENCY_LABELS[urgency]}
    </span>
  );
}
