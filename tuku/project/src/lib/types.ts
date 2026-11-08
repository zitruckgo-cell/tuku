export type UserRole = 'shipper' | 'driver' | 'admin' | 'dispatcher';
export type AccountType = 'individual' | 'business';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type LoadStatus = 'posted' | 'awarded' | 'active_haul' | 'delivered' | 'completed' | 'cancelled';
export type CargoType = 'lab_specimen' | 'medication' | 'supplies' | 'documents' | 'other';
export type Urgency = 'standard' | 'urgent' | 'critical';
export type BidStatus = 'pending' | 'accepted' | 'rejected';
export type HaulStatus = 'en_route_to_pickup' | 'picked_up' | 'en_route_to_delivery' | 'delivered';

export interface Profile {
  id: string;
  email?: string;
  full_name: string;
  phone: string;
  role: UserRole;
  account_type?: AccountType;
  business_name?: string;
  vehicle_plate?: string;
  vehicle_model?: string;
  rating?: number;
  total_deliveries?: number;
  is_available?: boolean;
  // Ugandan address
  address_village?: string;
  address_parish?: string;
  address_subcounty?: string;
  address_district?: string;
  // Document references
  national_id_number?: string;
  lc_letter_ref?: string;
  referral_letter_ref?: string;
  // Document file URLs (uploaded files)
  national_id_doc_url?: string;
  lc_letter_doc_url?: string;
  referral_letter_doc_url?: string;
  photo_url?: string;
  // Short messages / special instructions
  special_instructions?: string;
  // Admin verification
  verification_status?: VerificationStatus;
  admin_notes?: string;
  // MoMo payout account
  momo_phone?: string;
  momo_account_verified?: boolean;
  created_at: string;
}

export type StopType = 'intermediate' | 'return';

export interface LoadStop {
  id: string;
  load_id: string;
  stop_order: number;
  stop_type: StopType;
  address: string;
  lat?: number;
  lng?: number;
  contact_name?: string;
  contact_phone?: string;
  note?: string;
  ticket_label?: string;
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
}

export interface Load {
  id: string;
  shipper_id: string;
  awarded_rider_id?: string;
  title: string;
  pickup_address: string;
  pickup_lat?: number;
  pickup_lng?: number;
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  cargo_type: CargoType;
  cargo_description: string;
  weight_kg?: number;
  urgency: Urgency;
  offer_price_ugx: number;
  status: LoadStatus;
  is_paid?: boolean;
  pickup_at?: string;
  delivered_at?: string;
  completed_at?: string;
  created_at: string;
  shipper?: Profile;
  awarded_rider?: Profile;
  stops?: LoadStop[];
}

export interface Bid {
  id: string;
  load_id: string;
  rider_id: string;
  bid_amount_ugx: number;
  eta_minutes?: number;
  message?: string;
  status: BidStatus;
  created_at: string;
  rider?: Profile;
}

export interface StatusUpdate {
  id: string;
  load_id: string;
  by_user_id: string;
  status: HaulStatus;
  lat?: number;
  lng?: number;
  note?: string;
  created_at: string;
  by_user?: Profile;
}

export interface RiderLocation {
  id: string;
  rider_id: string;
  load_id?: string;
  lat: number;
  lng: number;
  heading?: number;
  speed_kmh?: number;
  updated_at: string;
}

export interface Earning {
  id: string;
  load_id: string;
  driver_id: string;
  total_amount_ugx: number;
  marketplace_fee_ugx: number;
  driver_earnings_ugx: number;
  status: string;
  payout_status?: 'pending' | 'paid' | 'failed' | 'refunded';
  transaction_id?: string;
  paid_at?: string;
  failure_reason?: string;
  created_at: string;
}

export type TransactionType = 'collection' | 'disbursement' | 'commission' | 'refund';
export type TransactionStatus = 'pending' | 'successful' | 'failed' | 'refunded';

export interface Transaction {
  id: string;
  load_id: string;
  shipper_id: string;
  driver_id?: string;
  amount_ugx: number;
  marketplace_fee_ugx: number;
  driver_earnings_ugx: number;
  type: TransactionType;
  status: TransactionStatus;
  momo_reference?: string;
  momo_financial_id?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
  shipper?: Profile;
  driver?: Profile;
  load?: Load;
}

export interface ProofOfDelivery {
  id: string;
  load_id: string;
  rider_id?: string;
  photo_url?: string;
  recipient_name: string;
  delivered_at: string;
  notes?: string;
  created_at: string;
}

export type SupportCategory = 'payment' | 'delivery' | 'account' | 'technical' | 'other';
export type SupportPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SupportTicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type SupportSenderRole = 'user' | 'admin';

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportTicketStatus;
  load_id?: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  user?: Profile;
  messages?: SupportMessage[];
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: SupportSenderRole;
  body: string;
  created_at: string;
}

export const CARGO_LABELS: Record<CargoType, string> = {
  lab_specimen: 'Lab Specimen',
  medication: 'Medication',
  supplies: 'Medical Supplies',
  documents: 'Documents',
  other: 'General',
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  standard: 'Standard',
  urgent: 'Urgent',
  critical: 'Critical',
};

export const STATUS_LABELS: Record<LoadStatus, string> = {
  posted: 'Available',
  awarded: 'Assigned',
  active_haul: 'Active Haul',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const HAUL_STATUS_LABELS: Record<HaulStatus, string> = {
  en_route_to_pickup: 'En Route to Pickup',
  picked_up: 'Picked Up',
  en_route_to_delivery: 'En Route to Delivery',
  delivered: 'Delivered',
};

export function formatUGX(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}
