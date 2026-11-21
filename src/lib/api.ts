import { supabase } from "./supabase";
import type { Listing, ListingType, ConfigRow } from "./types";
export async function rpc<T = void>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}
export async function config(table: string): Promise<ConfigRow[]> {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw error;
  return data as ConfigRow[];
}
export interface Filters {
  type: ListingType;
  search: string;
  category: string;
  condition: string;
  min: string;
  max: string;
  sort: string;
  campus: string;
  page: number;
}
export async function listings(filters: Filters) {
  let q = supabase
    .from("listings")
    .select("*, profiles(*)", { count: "exact" })
    .eq("status", "ACTIVE")
    .eq("type", filters.type);
  if (filters.search.trim())
    q = q.textSearch("search_document", filters.search.trim(), {
      type: "websearch",
      config: "english",
    });
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.condition && filters.type !== "REQUEST")
    q = q.eq("condition", filters.condition);
  if (filters.campus) q = q.eq("campus_id", filters.campus);
  if (filters.min) q = q.gte("amount", Number(filters.min));
  if (filters.max) q = q.lte("amount", Number(filters.max));
  q = q
    .order(filters.sort === "newest" ? "created_at" : "amount", {
      ascending: filters.sort === "low",
    })
    .order("id")
    .range(filters.page * 12, filters.page * 12 + 11);
  const { data, error, count } = await q;
  if (error) throw error;
  return { items: data as Listing[], count: count || 0 };
}
export async function getListing(id: string): Promise<Listing> {
  const { data, error } = await supabase
    .from("listings")
    .select("*,profiles(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Listing;
}
