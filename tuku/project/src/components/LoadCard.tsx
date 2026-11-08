import { Package, Clock, ChevronRight, Zap, CheckCircle, X, RefreshCw, MapPin, RotateCcw } from 'lucide-react';
import type { Load } from '../lib/types';
import { CARGO_LABELS, formatUGX } from '../lib/types';
import { StatusBadge, UrgencyBadge } from './StatusBadge';
import { useRouter } from '../contexts/RouterContext';

const CARGO_ICONS: Record<string, string> = {
  lab_specimen: '🧪',
  medication: '💊',
  supplies: '🏥',
  documents: '📄',
  other: '📦',
};

interface LoadCardProps {
  load: Load;
  showActions?: boolean;
  onAccept?: () => void;
  onBid?: () => void;
  onCounterOffer?: () => void;
  bidStatus?: { status: string; bid_amount_ugx: number };
}

export function LoadCard({ load, onAccept, onBid, onCounterOffer, bidStatus }: LoadCardProps) {
  const { navigate } = useRouter();

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div
      className="group rounded-3xl border border-[#e6edf2] bg-white p-5 hover:border-[#128663]/50 hover:shadow-lg transition-all duration-200 cursor-pointer"
      onClick={() => navigate(`/load/${load.id}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#f1f6fa] flex items-center justify-center text-lg flex-shrink-0">
            {CARGO_ICONS[load.cargo_type] ?? '📦'}
          </div>
          <div className="min-w-0">
            <p className="text-[#152238] font-semibold truncate">{load.title || CARGO_LABELS[load.cargo_type]}</p>
            <p className="text-[#718096] text-sm truncate">{CARGO_LABELS[load.cargo_type]}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <StatusBadge status={load.status} />
          {load.urgency !== 'standard' && <UrgencyBadge urgency={load.urgency} />}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-[#128663] mt-1.5 flex-shrink-0" />
          <p className="text-[#4e5d70] text-sm leading-snug line-clamp-1">{load.pickup_address}</p>
        </div>
        {load.stops && load.stops.length > 0 && (() => {
          const inter = load.stops.filter(s => s.stop_type === 'intermediate').length;
          const ret = load.stops.filter(s => s.stop_type === 'return').length;
          return (
            <div className="flex flex-col gap-1 pl-1">
              {inter > 0 && (
                <div className="flex items-center gap-2">
                  <MapPin size={11} className="text-[#718096] flex-shrink-0" />
                  <p className="text-[#718096] text-xs font-medium">{inter} stop{inter > 1 ? 's' : ''} along the way</p>
                </div>
              )}
              {ret > 0 && (
                <div className="flex items-center gap-2">
                  <RotateCcw size={11} className="text-[#e6a700] flex-shrink-0" />
                  <p className="text-[#e6a700] text-xs font-medium">{ret} return ticket{ret > 1 ? 's' : ''} on the way back</p>
                </div>
              )}
            </div>
          );
        })()}
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-[#ea580c] mt-1.5 flex-shrink-0" />
          <p className="text-[#4e5d70] text-sm leading-snug line-clamp-1">{load.delivery_address}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[#eef2f5]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[#128663] font-semibold">
            <Package size={14} />
            <span className="text-sm">{formatUGX(load.offer_price_ugx)}</span>
          </div>
          <div className="flex items-center gap-1 text-[#a0aec0] text-xs">
            <Clock size={12} />
            {timeAgo(load.created_at)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bidStatus ? (
            <>
              <span className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 ${
                bidStatus.status === 'accepted' ? 'bg-[#e8fbf3] text-[#128663] border-[#a7e3d0]' :
                bidStatus.status === 'rejected' ? 'bg-[#fef2f2] text-[#e54848] border-[#f5b3b3]' :
                'bg-[#fef9e7] text-[#8a6d00] border-[#f5d97e]'
              }`}>
                {bidStatus.status === 'accepted' ? <CheckCircle size={12} /> : bidStatus.status === 'rejected' ? <X size={12} /> : <Clock size={12} />}
                {bidStatus.status === 'accepted' ? 'Awarded' : bidStatus.status === 'rejected' ? 'Rejected' : 'Bid Placed'}
              </span>
              {onCounterOffer && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCounterOffer(); }}
                  className="px-3 py-1.5 text-xs font-medium bg-[#128663] hover:bg-[#0f7355] text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Counter
                </button>
              )}
            </>
          ) : (
            <>
              {onBid && (
                <button
                  onClick={(e) => { e.stopPropagation(); onBid(); }}
                  className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-[#f1f6fa] border border-[#e6edf2] text-[#128663] rounded-lg transition-colors"
                >
                  Place Bid
                </button>
              )}
              {onAccept && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAccept(); }}
                  className="px-3 py-1.5 text-xs font-medium bg-[#128663] hover:bg-[#0f7355] text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  <Zap size={12} /> Accept
                </button>
              )}
            </>
          )}
          <ChevronRight size={16} className="text-[#cbd5e0] group-hover:text-[#128663] transition-colors" />
        </div>
      </div>
    </div>
  );
}
