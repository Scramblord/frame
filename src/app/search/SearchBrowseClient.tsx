"use client";

import Image from "next/image";
import Link from "next/link";
import { formatGbp } from "@/lib/experts-marketplace";
import { FoundingSenseiBadge } from "@/components/FoundingSenseiBadge";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import type { SearchExpertSerialized } from "@/app/search/search-types";

type SortKey = "relevance" | "rating" | "reviews" | "price_asc" | "price_desc";

const SORT_VALUES: SortKey[] = [
  "relevance",
  "rating",
  "reviews",
  "price_asc",
  "price_desc",
];

function parseFormatsParam(formatsRaw: string | null): Set<"video" | "audio" | "messaging"> {
  const s = formatsRaw ?? "";
  const parts = s
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const out = new Set<"video" | "audio" | "messaging">();
  for (const p of parts) {
    if (p === "video" || p === "audio" || p === "messaging") out.add(p);
  }
  return out;
}

function serializeFormats(set: Set<"video" | "audio" | "messaging">): string | null {
  if (set.size === 0) return null;
  return [...set].sort().join(",");
}

function resolvedSort(sortParam: string | null, filtersActive: boolean): SortKey {
  if (sortParam && SORT_VALUES.includes(sortParam as SortKey)) return sortParam as SortKey;
  return filtersActive ? "rating" : "relevance";
}

function filtersActiveExceptSort(p: URLSearchParams): boolean {
  if (serializeFormats(parseFormatsParam(p.get("formats")))) return true;
  const pmin = (p.get("pmin") ?? "").trim();
  const pmax = (p.get("pmax") ?? "").trim();
  if (pmin !== "" || pmax !== "") return true;
  if (p.get("avail") === "1") return true;
  if (p.get("founding") === "1") return true;
  return false;
}

function countActiveFilterCategories(sp: URLSearchParams): number {
  let n = 0;
  const fmt = serializeFormats(parseFormatsParam(sp.get("formats")));
  if (fmt != null && fmt.length > 0) n++;
  const pmin = (sp.get("pmin") ?? "").trim();
  const pmax = (sp.get("pmax") ?? "").trim();
  if (pmin !== "" || pmax !== "") n++;
  if (sp.get("avail") === "1") n++;
  if (sp.get("founding") === "1") n++;
  return n;
}

function filterExperts(items: SearchExpertSerialized[], sp: URLSearchParams): SearchExpertSerialized[] {
  const formats = parseFormatsParam(sp.get("formats"));
  const pminRaw = (sp.get("pmin") ?? "").trim();
  const pmaxRaw = (sp.get("pmax") ?? "").trim();
  const pmin = pminRaw === "" ? null : Number(pminRaw);
  const pmax = pmaxRaw === "" ? null : Number(pmaxRaw);
  const priceFilterOn = pminRaw !== "" || pmaxRaw !== "";
  const needAvail = sp.get("avail") === "1";
  const needFounding = sp.get("founding") === "1";

  return items.filter((e) => {
    if (formats.size > 0) {
      let ok = false;
      if (formats.has("video") && e.offersVideo) ok = true;
      if (formats.has("audio") && e.offersAudio) ok = true;
      if (formats.has("messaging") && e.offersMessaging) ok = true;
      if (!ok) return false;
    }
    if (priceFilterOn) {
      if (e.fromPrice == null || !Number.isFinite(e.fromPrice)) return false;
      if (pmin != null && Number.isFinite(pmin) && e.fromPrice < pmin) return false;
      if (pmax != null && Number.isFinite(pmax) && e.fromPrice > pmax) return false;
    }
    if (needAvail && !e.hasAvailabilitySlots) return false;
    if (needFounding && !e.isFounding) return false;
    return true;
  });
}

function sortExperts(
  filtered: SearchExpertSerialized[],
  sortMode: SortKey,
): SearchExpertSerialized[] {
  const list = [...filtered];
  switch (sortMode) {
    case "relevance":
      return list.sort((a, b) => a.relevanceOrder - b.relevanceOrder);
    case "rating":
      return list.sort((a, b) => {
        const ar = a.avgRating;
        const br = b.avgRating;
        const ah = ar != null && Number.isFinite(ar);
        const bh = br != null && Number.isFinite(br);
        if (ah !== bh) return ah ? -1 : 1;
        if (!ah) return (b.reviewCount || 0) - (a.reviewCount || 0);
        if ((br ?? 0) !== (ar ?? 0)) return (br ?? 0) - (ar ?? 0);
        return b.reviewCount - a.reviewCount;
      });
    case "reviews":
      return list.sort((a, b) => {
        const d = (b.reviewCount || 0) - (a.reviewCount || 0);
        if (d !== 0) return d;
        return (b.avgRating ?? -1) - (a.avgRating ?? -1);
      });
    case "price_asc":
      return list.sort((a, b) => {
        const pa = a.fromPrice ?? Number.POSITIVE_INFINITY;
        const pb = b.fromPrice ?? Number.POSITIVE_INFINITY;
        return pa - pb;
      });
    case "price_desc":
      return list.sort((a, b) => {
        const pa = a.fromPrice ?? Number.NEGATIVE_INFINITY;
        const pb = b.fromPrice ?? Number.NEGATIVE_INFINITY;
        return pb - pa;
      });
    default:
      return list;
  }
}

type Props = {
  experts: SearchExpertSerialized[];
  discountExpertIds: string[];
};

export default function SearchBrowseClient({
  experts,
  discountExpertIds,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [localPmin, setLocalPmin] = useState("");
  const [localPmax, setLocalPmax] = useState("");
  const lastSyncKeyRef = useRef<string>("");

  const discountSet = useMemo(
    () => new Set(discountExpertIds.map((id) => id.trim())),
    [discountExpertIds],
  );

  const syncLocalsFromParams = useCallback(() => {
    const k = searchParams.toString();
    if (lastSyncKeyRef.current === k) return;
    lastSyncKeyRef.current = k;
    setLocalPmin(searchParams.get("pmin") ?? "");
    setLocalPmax(searchParams.get("pmax") ?? "");
  }, [searchParams]);

  useEffect(() => {
    syncLocalsFromParams();
  }, [syncLocalsFromParams]);

  useEffect(() => {
    if (!mobileFiltersOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileFiltersOpen]);

  const filtered = useMemo(() => filterExperts(experts, searchParams), [experts, searchParams]);

  const filtersActiveBool = filtersActiveExceptSort(searchParams);
  const sortMode = resolvedSort(searchParams.get("sort"), filtersActiveBool);
  const sorted = useMemo(
    () => sortExperts(filtered, sortMode),
    [filtered, sortMode],
  );

  const filterBadgeCount = countActiveFilterCategories(searchParams);

  function pushSearchParams(mutate: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(searchParams.toString());
    mutate(p);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function setSort(value: SortKey) {
    pushSearchParams((p) => {
      const fb = filtersActiveExceptSort(p);
      const fallback = fb ? "rating" : "relevance";
      if (value === fallback) {
        p.delete("sort");
      } else {
        p.set("sort", value);
      }
    });
  }

  function toggleFormat(f: "video" | "audio" | "messaging") {
    pushSearchParams((p) => {
      const cur = parseFormatsParam(p.get("formats"));
      if (cur.has(f)) cur.delete(f);
      else cur.add(f);
      const ser = serializeFormats(cur);
      if (ser) p.set("formats", ser);
      else p.delete("formats");
    });
  }

  function setAvail(active: boolean) {
    pushSearchParams((p) => {
      if (active) p.set("avail", "1");
      else p.delete("avail");
    });
  }

  function setFounding(active: boolean) {
    pushSearchParams((p) => {
      if (active) p.set("founding", "1");
      else p.delete("founding");
    });
  }

  function applyPriceRange(pmin?: string, pmax?: string) {
    pushSearchParams((p) => {
      const mn = (pmin ?? "").trim();
      const mx = (pmax ?? "").trim();
      if (mn !== "") p.set("pmin", mn);
      else p.delete("pmin");
      if (mx !== "") p.set("pmax", mx);
      else p.delete("pmax");
    });
    setMobileFiltersOpen(false);
  }

  function clearFilters() {
    const q = (searchParams.get("q") ?? "").trim();
    router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
    setMobileFiltersOpen(false);
  }

  function formatCheckboxProps(f: "video" | "audio" | "messaging"): {
    checked: boolean;
    label: string;
  } {
    const cur = parseFormatsParam(searchParams.get("formats"));
    const labels = { video: "Video", audio: "Audio", messaging: "Messaging" };
    return { checked: cur.has(f), label: labels[f] };
  }

  const filterPanelJsx = (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Session type
        </p>
        <div className="mt-2 space-y-2">
          {(["video", "audio", "messaging"] as const).map((f) => (
            <label key={f} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--color-border)]"
                checked={formatCheckboxProps(f).checked}
                onChange={() => toggleFormat(f)}
              />
              {formatCheckboxProps(f).label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Starting price (£)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            placeholder="Min"
            value={localPmin}
            onChange={(ev) => setLocalPmin(ev.target.value)}
            className="w-full min-w-[100px] flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none placeholder:text-[var(--color-text-placeholder)]"
          />
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            placeholder="Max"
            value={localPmax}
            onChange={(ev) => setLocalPmax(ev.target.value)}
            className="w-full min-w-[100px] flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none placeholder:text-[var(--color-text-placeholder)]"
          />
          <button
            type="button"
            className="w-full shrink-0 rounded-lg border border-[var(--color-border-strong)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-zinc-50 sm:w-auto"
            onClick={() => applyPriceRange(localPmin, localPmax)}
          >
            Apply prices
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text)]">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[var(--color-border)]"
          checked={searchParams.get("avail") === "1"}
          onChange={(ev) => setAvail(ev.target.checked)}
        />
        Has weekly availability set
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text)]">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[var(--color-border)]"
          checked={searchParams.get("founding") === "1"}
          onChange={(ev) => setFounding(ev.target.checked)}
        />
        Founding Sensei only
      </label>

      {filterBadgeCount > 0 ? (
        <button
          type="button"
          className="w-full rounded-lg text-sm font-medium text-[var(--color-accent)] hover:underline"
          onClick={() => clearFilters()}
        >
          Clear filters
        </button>
      ) : null}

      <button
        type="button"
        className="mt-4 w-full rounded-xl bg-[var(--color-accent)] py-3 text-sm font-semibold text-white lg:hidden"
        onClick={() => setMobileFiltersOpen(false)}
      >
            Done
      </button>
    </div>
  );

  function submitSearch(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const qRaw = String(fd.get("q") ?? "").trim();
    const p = new URLSearchParams(searchParams.toString());
    if (qRaw) p.set("q", qRaw);
    else p.delete("q");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <>
      <form
        onSubmit={submitSearch}
        className="mb-6 flex h-14 items-center rounded-xl border border-[var(--color-border)] bg-white px-2 shadow-[var(--shadow-sm)]"
      >
        <label htmlFor="search-q" className="sr-only">
          Search
        </label>
        <input
          id="search-q"
          name="q"
          type="search"
          defaultValue={(searchParams.get("q") ?? "").trim()}
          key={searchParams.get("q") ?? ""}
          placeholder="e.g. jiujitsu, physiotherapy, strength and conditioning…"
          className="h-full w-full border-0 bg-transparent px-3 text-base text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-placeholder)]"
          autoComplete="off"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          Search
        </button>
      </form>

      <div className="lg:grid lg:grid-cols-[minmax(240px,280px)_1fr] lg:items-start lg:gap-8 xl:gap-10">
        <aside className="mb-6 hidden lg:block lg:sticky lg:top-24 lg:rounded-[var(--radius-md)] lg:border lg:border-[var(--color-border)] lg:bg-[var(--color-surface)] lg:p-5 lg:shadow-[var(--shadow-sm)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Filters</h2>
          <div className="mt-4">{filterPanelJsx}</div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="relative inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] shadow-[var(--shadow-sm)] lg:hidden"
              >
                Filters
                {filterBadgeCount > 0 ? (
                  <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-accent)] px-1.5 text-[10px] font-bold text-white">
                    {filterBadgeCount}
                  </span>
                ) : null}
              </button>
            </div>
            <label className="flex w-full shrink-0 items-center gap-2 text-xs text-[var(--color-text-muted)] sm:w-auto sm:max-w-none sm:text-sm">
              <span className="shrink-0">Sort</span>
              <select
                aria-label="Sort results"
                className="w-full min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none sm:min-w-[200px]"
                value={sortMode}
                onChange={(ev) => setSort(ev.target.value as SortKey)}
              >
                <option value="relevance">Relevance</option>
                <option value="rating">Highest rated</option>
                <option value="reviews">Most reviewed</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </label>
          </div>

          <p className="mb-4 text-sm text-[var(--color-text-muted)]">
            {sorted.length} Sensei{sorted.length === 1 ? "" : "s"} found
            {sorted.length !== experts.length ? (
              <span className="text-[var(--color-text-muted)]">
                {" "}
                (filtered from {experts.length})
              </span>
            ) : null}
          </p>

          {sorted.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] py-14 text-center text-sm text-[var(--color-text-muted)] shadow-[var(--shadow-sm)]">
              No Senseis match your filters. Try clearing filters or broadening your search.
            </div>
          ) : (
            <ul className="grid gap-4">
              {sorted.map((item) => (
                <li key={item.userId}>
                  <ExpertResultCard
                    item={item}
                    hasDiscount={discountSet.has(item.userId)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-[120] lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-[min(100%,360px)] max-w-[100vw] translate-x-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-[var(--color-text)]">Filters</h2>
                {filterBadgeCount > 0 ? (
                  <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-accent)] px-1.5 text-[10px] font-bold text-white">
                    {filterBadgeCount}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm font-medium text-[var(--color-text-muted)] hover:bg-zinc-100"
                onClick={() => setMobileFiltersOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{filterPanelJsx}</div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function ExpertResultCard({
  item,
  hasDiscount,
}: {
  item: SearchExpertSerialized;
  hasDiscount: boolean;
}) {
  const tags = item.keywords.slice(0, 4);
  const consultLabels: string[] = [];
  if (item.offersMessaging) consultLabels.push("Messaging");
  if (item.offersAudio) consultLabels.push("Audio");
  if (item.offersVideo) consultLabels.push("Video");

  return (
    <Link
      href={`/experts/${item.profileId}`}
      className="block rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] transition hover:border-[var(--color-border-strong)]"
    >
      <div className="flex gap-4">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-zinc-900">
          {item.avatarUrl ? (
            <Image src={item.avatarUrl} alt="" fill className="object-cover" sizes="44px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
              {item.initials}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="text-sm font-semibold text-[var(--color-text)]">
                  {item.displayName}
                </h2>
                {item.isFounding ? (
                  <FoundingSenseiBadge size="sm" className="shrink-0" />
                ) : null}
              </div>
              {item.matchedServiceName ? (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  <span className="font-medium text-[var(--color-text)]">Offers:</span>{" "}
                  {item.matchedServiceName}
                </p>
              ) : null}
            </div>
            {item.fromPrice != null ? (
              <span className="shrink-0 text-sm font-semibold text-[var(--color-text)]">
                From {formatGbp(item.fromPrice)}
              </span>
            ) : (
              <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                Pricing on profile
              </span>
            )}
          </div>
          {tags.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag: string) => (
                <li
                  key={tag}
                  className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                >
                  {tag}
                </li>
              ))}
              {item.keywords.length > 4 ? (
                <li className="px-1 text-xs text-[var(--color-text-muted)]">
                  +{item.keywords.length - 4} more
                </li>
              ) : null}
            </ul>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {consultLabels.length > 0 ? (
              consultLabels.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                >
                  {t}
                </span>
              ))
            ) : (
              <span className="text-xs text-[var(--color-text-muted)]">
                Consultation types on profile
              </span>
            )}
          </div>
          {hasDiscount ? (
            <p className="mt-2 inline-flex rounded-full border border-[var(--color-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
              Discount available
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
