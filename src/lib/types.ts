export type ListingType = "SALE" | "RENT" | "REQUEST";
export type ListingStatus =
  "ACTIVE" | "COMPLETED" | "ARCHIVED" | "REMOVED_BY_ADMIN";
export interface Profile {
  id: string;
  campus_id: string;
  full_name: string;
  department: string;
  avatar_path: string | null;
  verified_at: string;
  created_at: string;
}
export interface Account {
  user_id: string;
  campus_id: string;
  email_domain: string;
  role: "STUDENT" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "REJECTED" | "DEACTIVATED";
  registration_number: string;
  graduation_year: number;
  status_reason: string | null;
  created_at: string;
}
export interface Listing {
  contact_mode: "CHAT" | "WHATSAPP" | "CALL" | "BOTH";
  deleted_at: string | null;
  deleted_by: string | null;
  deletion_reason: string | null;
  id: string;
  user_id: string;
  campus_id: string;
  type: ListingType;
  title: string;
  description: string;
  category: string;
  condition: string | null;
  price: number | null;
  rental_rate_daily: number | null;
  deposit: number | null;
  offered_budget: number | null;
  need_type: string | null;
  preferred_meetup_spot: string;
  image_paths: string[];
  status: ListingStatus;
  created_at: string;
  updated_at: string;
  amount: number;
  profiles?: Profile;
}
export interface ConfigRow {
  id: string;
  name?: string;
  short_name?: string;
  city?: string;
  domain?: string;
  campus_id?: string;
  university_id?: string;
  title?: string;
  description?: string;
  is_active: boolean;
}
export interface Report {
  id: string;
  reporter_user_id: string;
  reported_user_id: string | null;
  listing_id: string | null;
  reason: string;
  comments: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}
export interface Audit {
  id: string;
  action_type: string;
  target_user_id: string | null;
  target_listing_id: string | null;
  reason: string | null;
  metadata: unknown;
  created_at: string;
}
export interface Telemetry {
  id: string;
  listing_id: string;
  event_type: string;
  resolution_reason: string;
  created_at: string;
}
