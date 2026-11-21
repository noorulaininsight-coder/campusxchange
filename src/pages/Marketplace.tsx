import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { config, listings, type Filters } from "../lib/api";
import { configured } from "../lib/supabase";
import { useDebounce } from "../hooks/useDebounce";
import { ListingCard } from "../components/ListingCard";
import { Empty, ErrorBox, Loading } from "../components/Common";
import { Button } from "../components/ui/button";
import type { ListingType } from "../lib/types";
export function Marketplace() {
  const [params, setParams] = useSearchParams();
  const type = (
    ["SALE", "RENT", "REQUEST"].includes(params.get("type") || "")
      ? params.get("type")
      : "SALE"
  ) as ListingType;
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const [filters, setFilters] = useState<Omit<Filters, "type" | "search">>({
    category: params.get("category") || "",
    condition: "",
    min: "",
    max: "",
    sort: "newest",
    campus: "",
    page: 0,
  });
  const [show, setShow] = useState(false);
  useEffect(() => {
    setFilters((v) => ({ ...v, page: 0 }));
  }, [debounced, type]);
  const cats = useQuery({
    queryKey: ["config", "categories"],
    queryFn: () => config("categories"),
    enabled: configured,
  });
  const campuses = useQuery({
    queryKey: ["config", "campuses"],
    queryFn: () => config("campuses"),
    enabled: configured,
  });
  const q = useQuery({
    queryKey: ["feed", type, debounced, filters],
    queryFn: () => listings({ ...filters, type, search: debounced }),
    enabled: configured,
  });
  function change(key: string, value: string) {
    setFilters((v) => ({ ...v, [key]: value, page: 0 }));
  }
  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="eyebrow">THE CAMPUS MARKETPLACE</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Find your next good thing.
          </h1>
          <p className="mt-3 text-stone-500">
            Useful things. Fair prices. Students like you.
          </p>
        </div>
        <div className="self-end rounded-full border bg-white px-4 py-2 text-xs text-brand">
          University-email verified community
        </div>
      </div>
      <div className="mt-8 rounded-2xl border bg-white p-2 flex items-center gap-3">
        <Search className="ml-3 text-stone-400" size={20} />
        <input
          aria-label="Search marketplace"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search books, calculators, room essentials…"
          className="flex-1 min-w-0 border-none bg-transparent focus:ring-0"
        />
        <Button
          variant="outline"
          onClick={() => setShow(!show)}
          aria-expanded={show}
        >
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">Filters</span>
        </Button>
      </div>
      <div className="mt-7 mb-6 flex flex-wrap justify-between gap-3 border-b">
        <div
          className="flex gap-6"
          role="tablist"
          aria-label="Marketplace type"
        >
          {(["SALE", "RENT", "REQUEST"] as ListingType[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={type === t}
              onClick={() => {
                params.set("type", t);
                setParams(params);
              }}
              className={`pb-4 text-sm font-semibold border-b-2 ${t === type ? "border-brand text-brand" : "border-transparent text-stone-500"}`}
            >
              {t === "SALE"
                ? "Buy & Sell"
                : t === "RENT"
                  ? "Rentals"
                  : "Requests"}
            </button>
          ))}
        </div>
        <select
          aria-label="Sort listings"
          className="mb-2 w-auto border-none bg-transparent text-sm"
          value={filters.sort}
          onChange={(e) => change("sort", e.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="low">Price: low to high</option>
          <option value="high">Price: high to low</option>
        </select>
      </div>
      <div className="grid gap-7 lg:grid-cols-[210px_1fr]">
        <aside className={`${show ? "block" : "hidden"} lg:block space-y-6`}>
          <div>
            <h2 className="text-sm font-semibold mb-3">Categories</h2>
            <div className="flex flex-col gap-1">
              {[{ id: "", name: "All categories" }, ...(cats.data || [])].map(
                (c) => (
                  <button
                    key={c.id}
                    className={`text-left rounded-lg px-3 py-2.5 text-sm ${filters.category === c.id ? "bg-brand/10 text-brand font-semibold" : "text-stone-600 hover:bg-white"}`}
                    onClick={() => change("category", c.id)}
                  >
                    {c.name}
                  </button>
                ),
              )}
            </div>
          </div>
          <label className="block text-sm">
            Campus
            <select
              value={filters.campus}
              onChange={(e) => change("campus", e.target.value)}
              className="mt-2"
            >
              <option value="">All active campuses</option>
              {campuses.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {type !== "REQUEST" && (
            <label className="block text-sm">
              Condition
              <select
                className="mt-2"
                value={filters.condition}
                onChange={(e) => change("condition", e.target.value)}
              >
                <option value="">Any condition</option>
                {["NEW", "LIKE_NEW", "USED", "FAIR"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          )}
          <div>
            <p className="text-sm mb-2">Price / budget (Rs.)</p>
            <div className="flex gap-2">
              <input
                aria-label="Minimum price"
                placeholder="Min"
                type="number"
                min="0"
                value={filters.min}
                onChange={(e) => change("min", e.target.value)}
              />
              <input
                aria-label="Maximum price"
                placeholder="Max"
                type="number"
                min="0"
                value={filters.max}
                onChange={(e) => change("max", e.target.value)}
              />
            </div>
          </div>
          <button
            className="text-sm text-brand underline"
            onClick={() => {
              setSearch("");
              setFilters({
                category: "",
                condition: "",
                min: "",
                max: "",
                sort: "newest",
                campus: "",
                page: 0,
              });
            }}
          >
            Clear filters
          </button>
        </aside>
        <section>
          {!configured ? (
            <Empty
              title="Your marketplace is ready to connect"
              text="Set the Supabase environment variables and apply the migrations to load real campus listings."
            />
          ) : q.isPending ? (
            <Loading />
          ) : q.error ? (
            <ErrorBox error={q.error} retry={() => void q.refetch()} />
          ) : (
            <>
              <p className="mb-4 text-xs text-stone-500">
                {q.data?.count} finds for your campus life
              </p>
              {q.data?.items.length ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {q.data.items.map((l) => (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      campus={
                        campuses.data?.find((c) => c.id === l.campus_id)?.name
                      }
                      category={
                        cats.data?.find((c) => c.id === l.category)?.name
                      }
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  title="No finds just yet"
                  text="Try a different search or clear your filters."
                />
              )}
              <div className="mt-8 flex justify-between">
                <Button
                  variant="outline"
                  disabled={!filters.page}
                  onClick={() =>
                    setFilters((v) => ({ ...v, page: v.page - 1 }))
                  }
                >
                  Previous
                </Button>
                <span className="text-sm p-3">Page {filters.page + 1}</span>
                <Button
                  variant="outline"
                  disabled={(filters.page + 1) * 12 >= (q.data?.count || 0)}
                  onClick={() =>
                    setFilters((v) => ({ ...v, page: v.page + 1 }))
                  }
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
