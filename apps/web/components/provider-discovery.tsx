"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./provider-discovery.module.css";
import { normalizeProviderRow, type MilkType, type PublicProvider } from "@/lib/providers/normalize";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

type DiscoveryStatus = "loading" | "ready" | "error" | "not-configured";
type MilkFilter = "all" | "cow" | "buffalo" | "a2";
type SortMode = "closest" | "rating" | "price";

interface Coordinates {
  latitude: number;
  longitude: number;
}

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function minPrice(provider: PublicProvider): number | null {
  const prices = provider.products
    .map((product) => product.pricePerLitre)
    .filter((price): price is number => price !== null);
  return prices.length ? Math.min(...prices) : null;
}

function formatDistance(distance: number | null): string {
  if (distance === null) return "Set location to check distance";
  if (distance < 1) return `${Math.max(100, Math.round(distance * 1000))} m away`;
  return `${distance.toFixed(distance < 10 ? 1 : 0)} km away`;
}

function matchesMilk(provider: PublicProvider, filter: MilkFilter): boolean {
  if (filter === "all") return true;
  return provider.milkType === filter || provider.products.some((product) => product.milkType === filter);
}

export default function ProviderDiscovery() {
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [status, setStatus] = useState<DiscoveryStatus>("loading");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [milkFilter, setMilkFilter] = useState<MilkFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("closest");
  const [locationLabel, setLocationLabel] = useState("Location not shared");
  const requestId = useRef(0);

  const loadProviders = useCallback(async (coordinates: Coordinates | null) => {
    const currentRequest = ++requestId.current;
    setStatus("loading");
    setMessage("");

    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      setStatus("not-configured");
      setMessage("Live discovery is not connected in this environment yet. Add the two public Supabase environment variables in the app setup guide.");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("find_nearby_providers_v2", {
        p_latitude: coordinates?.latitude ?? null,
        p_longitude: coordinates?.longitude ?? null,
        p_max_km: 20,
      });

      if (currentRequest !== requestId.current) return;
      if (error) throw error;

      const normalized = (Array.isArray(data) ? data : [])
        .map(normalizeProviderRow)
        .filter((provider): provider is PublicProvider => provider !== null);

      setProviders(normalized);
      setStatus("ready");
      setMessage(normalized.length ? "" : "No public providers were returned for this search. Try again later or change your delivery location.");
    } catch {
      if (currentRequest !== requestId.current) return;
      setStatus("error");
      setMessage("We couldn’t load nearby providers. Check your connection and try again.");
    }
  }, []);

  useEffect(() => {
    void loadProviders(null);
    return () => {
      requestId.current += 1;
    };
  }, [loadProviders]);

  useEffect(() => {
    const requestedMilk = new URLSearchParams(window.location.search).get("milk");
    if (requestedMilk === "cow" || requestedMilk === "buffalo" || requestedMilk === "a2") {
      setMilkFilter(requestedMilk);
    }
  }, []);

  const visibleProviders = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const list = providers.filter((provider) => {
      const searchable = [
        provider.name,
        provider.area,
        provider.city,
        ...provider.products.map((product) => product.name),
      ].join(" ").toLocaleLowerCase();

      return searchable.includes(normalizedSearch) && matchesMilk(provider, milkFilter);
    });

    return list.sort((a, b) => {
      if (sortMode === "rating") return (b.rating ?? -1) - (a.rating ?? -1);
      if (sortMode === "price") return (minPrice(a) ?? Number.POSITIVE_INFINITY) - (minPrice(b) ?? Number.POSITIVE_INFINITY);
      return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
    });
  }, [providers, search, milkFilter, sortMode]);

  const shareLocation = () => {
    if (!navigator.geolocation) {
      setMessage("This browser does not provide location access. You can still browse providers without sharing your location.");
      return;
    }

    setMessage("Requesting location permission…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationLabel("Location used for this search");
        void loadProviders({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setLocationLabel("Location not shared");
        setMessage("Location wasn’t shared. You can still browse without it; your choice is respected.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const clearLocation = () => {
    setLocationLabel("Location not shared");
    void loadProviders(null);
  };

  const providerCountLabel = visibleProviders.length === 1 ? "1 local seller" : `${visibleProviders.length} local sellers`;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Doodhwala home">
          <span className={styles.brandMark} aria-hidden="true">D</span>
          <span><strong>Doodhwala</strong><small>Local milk, nearby.</small></span>
        </a>
        <a className={styles.backLink} href="/">← Home</a>
      </header>

      <section className={styles.intro} aria-labelledby="providers-title">
        <p className={styles.eyebrow}>INDEPENDENT MILK SELLERS</p>
        <h1 id="providers-title">Find milk close to home.</h1>
        <p>Explore real local providers from Doodhwala’s existing catalogue. No demo sellers, and no order or payment actions on this migration route.</p>
        <div className={styles.locationBar}>
          <div>
            <strong>Delivery location</strong>
            <span>{locationLabel}</span>
          </div>
          <div className={styles.locationActions}>
            <button className={styles.secondaryButton} type="button" onClick={shareLocation}>Use my location</button>
            {locationLabel !== "Location not shared" && <button className={styles.textButton} type="button" onClick={clearLocation}>Clear</button>}
          </div>
        </div>
        <p className={styles.privacyNote}>Your precise location is requested only after you tap the button. It is used for this nearby-provider search and is not saved by this page.</p>
        {message && status === "ready" && providers.length > 0 && <p className={styles.inlineMessage} role="status">{message}</p>}
      </section>

      <section className={styles.catalogue} aria-labelledby="catalogue-title">
        <div className={styles.catalogueHead}>
          <div>
            <p className={styles.eyebrow}>THE LOCAL CATALOGUE</p>
            <h2 id="catalogue-title">Browse providers</h2>
          </div>
          <span className={styles.count}>{status === "ready" ? providerCountLabel : "Live catalogue"}</span>
        </div>

        <div className={styles.controls}>
          <label className={styles.searchLabel}>
            <span className={styles.srOnly}>Search sellers, areas or milk</span>
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sellers, area or milk…" />
          </label>
          <label className={styles.selectLabel}>
            <span>Milk type</span>
            <select value={milkFilter} onChange={(event) => setMilkFilter(event.target.value as MilkFilter)}>
              <option value="all">All types</option>
              <option value="cow">Cow milk</option>
              <option value="buffalo">Buffalo milk</option>
              <option value="a2">A2 milk</option>
            </select>
          </label>
          <label className={styles.selectLabel}>
            <span>Sort by</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="closest">Closest first</option>
              <option value="rating">Highest rated</option>
              <option value="price">Lowest listed price</option>
            </select>
          </label>
        </div>

        {status === "loading" && (
          <div className={styles.statePanel} role="status" aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            <strong>Loading the live catalogue…</strong>
            <span>Connecting to Doodhwala’s public provider discovery.</span>
          </div>
        )}

        {(status === "error" || status === "not-configured") && (
          <div className={styles.statePanel} role="status" aria-live="polite">
            <span className={styles.stateIcon} aria-hidden="true">!</span>
            <strong>{status === "not-configured" ? "Live catalogue not configured" : "The catalogue is temporarily unavailable"}</strong>
            <span>{message}</span>
            {status === "error" && <button className={styles.primaryButton} type="button" onClick={() => void loadProviders(null)}>Try again</button>}
          </div>
        )}

        {status === "ready" && visibleProviders.length === 0 && (
          <div className={styles.statePanel}>
            <span className={styles.stateIcon} aria-hidden="true">⌕</span>
            <strong>{providers.length ? "No matching sellers" : "No sellers returned"}</strong>
            <span>{providers.length ? "Try another search or milk type." : message || "There are no public providers to show right now."}</span>
            {providers.length > 0 && <button className={styles.textButton} type="button" onClick={() => { setSearch(""); setMilkFilter("all"); }}>Clear filters</button>}
          </div>
        )}

        {status === "ready" && visibleProviders.length > 0 && (
          <div className={styles.grid}>
            {visibleProviders.map((provider) => {
              const products = milkFilter === "all"
                ? provider.products
                : provider.products.filter((product) => product.milkType === milkFilter);
              const displayedProducts = products;

              return (
                <article className={styles.card} key={provider.id}>
                  <div className={styles.cardTop}>
                    <span className={styles.milkMark} aria-hidden="true">{provider.milkType === "a2" ? "A2" : provider.milkType === "buffalo" ? "B" : provider.milkType === "cow" ? "C" : "✳"}</span>
                    <div className={styles.sellerMeta}>
                      <h3>{provider.name}</h3>
                      <p>{[provider.area, provider.city].filter(Boolean).join(" · ") || "Local area"}</p>
                    </div>
                    {provider.rating !== null && <span className={styles.rating} aria-label={`Rated ${provider.rating.toFixed(1)} out of 5`}>★ {provider.rating.toFixed(1)}</span>}
                  </div>

                  <div className={styles.deliveryRow}>
                    <span className={styles.distance}>{formatDistance(provider.distanceKm)}</span>
                    <span className={provider.isServiceable === true ? styles.available : provider.isServiceable === false ? styles.unavailable : styles.unknown}>
                      {provider.isServiceable === true ? "Can deliver here" : provider.isServiceable === false ? "Outside delivery area" : "Delivery area not checked"}
                    </span>
                  </div>

                  <div className={styles.products}>
                    {displayedProducts.length ? displayedProducts.slice(0, 3).map((product) => (
                      <div className={styles.product} key={product.id}>
                        <div><strong>{product.name}</strong><small>{product.dailyAvailable ? "Daily availability listed" : "Availability varies"}</small></div>
                        <span className={styles.price}>{product.pricePerLitre === null ? "Price not listed" : `${money.format(product.pricePerLitre)} / L`}</span>
                      </div>
                    )) : <p className={styles.noProducts}>{milkFilter === "all" ? "No active products listed." : "No products listed for this milk type."}</p>}
                    {displayedProducts.length > 3 && <small className={styles.moreProducts}>+ {displayedProducts.length - 3} more products</small>}
                  </div>
                  <div className={styles.cardActions}><a className={styles.storeLink} href={"/stores/" + encodeURIComponent(provider.id)}>View seller and products <span aria-hidden="true">→</span></a></div><p className={styles.cardFoot}>Read-only catalogue · Ordering will be connected after store and checkout parity testing.</p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        <a className={styles.brand} href="/"><span className={styles.brandMark} aria-hidden="true">D</span><span><strong>Doodhwala</strong><small>Built around local sellers.</small></span></a>
        <span>© {new Date().getFullYear()} Doodhwala</span>
      </footer>
    </main>
  );
}
