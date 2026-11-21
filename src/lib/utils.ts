import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Listing, ListingType } from "./types";
export function cn(...v: ClassValue[]) {
  return twMerge(clsx(v));
}
export const money = (n: number | null | undefined) =>
  `Rs. ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(Number(n || 0))}`;
export const label = (s: string) =>
  s
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (x) => x.toUpperCase());
export function amountLabel(l: Listing) {
  return `${l.type === "REQUEST" ? "Budget " : ""}${money(l.amount)}${l.type === "RENT" ? " / day" : ""}`;
}
export function relativeTime(value: string) {
  const n = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 3600000),
  );
  return n < 1
    ? "Just posted"
    : n < 24
      ? `${n}h ago`
      : `${Math.floor(n / 24)}d ago`;
}
export const resolutions: Record<ListingType, string[]> = {
  SALE: [
    "SOLD_ON_CAMPUSXCHANGE",
    "SOLD_OUTSIDE_PLATFORM",
    "NO_LONGER_NEEDED",
    "CHANGED_MIND",
    "OTHER",
  ],
  RENT: [
    "RENTED_THROUGH_CAMPUSXCHANGE",
    "RENTED_OUTSIDE_PLATFORM",
    "NO_LONGER_AVAILABLE",
    "CHANGED_MIND",
    "OTHER",
  ],
  REQUEST: [
    "RECEIVED_ITEM_THROUGH_CAMPUSXCHANGE",
    "FOUND_ALTERNATIVE",
    "NO_LONGER_NEEDED",
    "OTHER",
  ],
};
export const reportReasons = [
  "SCAM_OR_SUSPICIOUS",
  "INCORRECT_INFORMATION",
  "PROHIBITED_ITEM",
  "SPAM",
  "HARASSMENT",
  "DUPLICATE_LISTING",
  "OTHER",
];
export function contactLinks(phone: string, title: string) {
  return {
    whatsapp: `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi! I'm interested in your listing '${title}' on CampusXchange.`)}`,
    call: `tel:${phone}`,
  };
}

/** Accept only app-owned destinations, never absolute or protocol-relative URLs. */
export function safeReturnPath(value: string | null) {
  if (!value || /[\\\u0000-\u0020]/.test(value)) return "/dashboard";
  return /^\/(?:dashboard|saved|post|settings|admin|marketplace|messages(?:\/[0-9a-f-]+)?|listing\/[0-9a-f-]+(?:\/edit)?)$/i.test(
    value,
  )
    ? value
    : "/dashboard";
}
