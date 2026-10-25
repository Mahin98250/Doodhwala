"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./public-catalogue-detail.module.css";
import { normalizeProviderRow, type PublicProvider } from "@/lib/providers/normalize";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

interface Props {
  providerId: string;
  productId?: string;
}
interface Coordinates { latitude: number; longitude: number; }
type Status = "loading" | "ready" | "error" | "not-found" | "not-configured";

const idPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

function priceLabel(provider: PublicProvider): string {
  const prices = provider.products.map((product) => product.pricePerLitre).filter((price): price is number => price !== null);
  if (!prices.length) return "Prices not listed";
  return `From ${money.format(Math.min(...prices))} / L`;
}

function deliveryWindow(provider: PublicProvider): string {
  if (provider.deliveryFrom && provider.deliveryTo) return `${provider.deliveryFrom}–${provider.deliveryTo}`;
  return "Local delivery schedule";
}

export default function PublicCatalogueDetail({ providerId, productId }: Props) {
  const [provider, setProvider] = useState<PublicProvider | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [locationLabel, setLocationLabel] = useState("Location not shared");
  const requestId = useRef(0);
  const locationAttempt = useRef(0);

  const load = useCallback(async (coordinates: Coordinates | null) => {
    const currentRequest = ++requestId.current;
    setStatus("loading");
    setMessage("");

    if (!idPattern.test(providerId) || (productId !== undefined && !idPattern.test(productId))) {
      setProvider(null);
      setStatus("not-found");
      setMessage("This seller or product link is incomplete or invalid.");
      return;
    }

    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      setStatus("not-configured");
      setMessage("Live seller details are not configured in this environment yet.");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_provider_storefront", {
        p_provider_id: providerId,
        p_latitude: coordinates?.latitude ?? null,
        p_longitude: coordinates?.longitude ?? null,
      });
      if (currentRequest !== requestId.current) return;
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const normalized = normalizeProviderRow(row);
      if (!normalized) {
        setProvider(null);
        setStatus("not-found");
        setMessage("This seller is not currently available in the public catalogue.");
        return;
      }

      setProvider(normalized);
      setStatus("ready");
    } catch {
      if (currentRequest !== requestId.current) return;
      setProvider(null);
      setStatus("error");
      setMessage("We couldn’t load this live catalogue item. Check your connection and try again.");
    }
  }, [providerId, productId]);

  useEffect(() => {
    void load(null);
    return () => { requestId.current += 1; locationAttempt.current += 1; };
  }, [load]);

  const product = useMemo(
    () => productId && provider ? provider.products.find((item) => item.id === productId) ?? null : null,
    [productId, provider],
  );

  const useLocation = () => {
    if (!navigator.geolocation) {
      setMessage("This browser does not provide location access. You can still browse this catalogue without it.");
      return;
    }
    const attempt = ++locationAttempt.current;
    setMessage("Requesting location permission…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (attempt !== locationAttempt.current) return;
        setLocationLabel("Used for this delivery check");
        void load({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => {
        if (attempt !== locationAttempt.current) return;
        setMessage("Location wasn’t shared. You can still browse; your choice is respected.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const clearLocation = () => {
    locationAttempt.current += 1;
    setLocationLabel("Location not shared");
    void load(null);
  };

  const stateTitle = status === "loading"
    ? "Loading live catalogue…"
    : status === "not-configured"
      ? "Live catalogue not configured"
      : status === "not-found"
        ? "Catalogue item not found"
        : "The catalogue is temporarily unavailable";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Doodhwala home">
          <span className={styles.brandMark} aria-hidden="true">D</span>
          <span><strong>Doodhwala</strong><small>Local milk, nearby.</small></span>
        </a>
        <a className={styles.backLink} href="/providers">← Browse providers</a>
      </header>

      {(status !== "ready" || !provider) && (
        <section className={styles.statePanel} role={status === "loading" ? "status" : "alert"} aria-live="polite">
          {status === "loading" && <span className={styles.spinner} aria-hidden="true" />}
          <h1>{stateTitle}</h1>
          <p>{status === "loading" ? "Connecting to the existing Doodhwala seller catalogue." : message}</p>
          {(status === "error" || status === "not-configured") && <button type="button" className={styles.primaryButton} onClick={() => void load(null)}>Try again</button>}
          {status === "not-found" && <a className={styles.primaryButton} href="/providers">Back to providers</a>}
        </section>
      )}

      {status === "ready" && provider && !productId && (
        <>
          <section className={styles.intro}>
            <p className={styles.eyebrow}>INDEPENDENT LOCAL SELLER</p>
            <div className={styles.titleRow}>
              <div><h1>{provider.name}</h1><p className={styles.location}>{[provider.area, provider.city].filter(Boolean).join(" · ") || "Local area"}</p></div>
              {provider.rating !== null && <span className={styles.rating}>★ {provider.rating.toFixed(1)}</span>}
            </div>
            <p className={styles.description}>{provider.description}</p>
            <div className={styles.facts}>
              <div><span>Milk type</span><strong>{provider.milkType === "other" ? "Local milk" : provider.milkType === "a2" ? "A2 milk" : provider.milkType[0].toUpperCase() + provider.milkType.slice(1) + " milk"}</strong></div>
              <div><span>Delivery window</span><strong>{deliveryWindow(provider)}</strong></div>
              <div><span>Service radius</span><strong>{provider.serviceRadiusKm === null ? "Check delivery area" : `${provider.serviceRadiusKm} km`}</strong></div>
            </div>
            <div className={styles.locationBar}>
              <div><strong>Delivery area</strong><span>{locationLabel}</span></div>
              <div className={styles.locationActions}>
                <button type="button" className={styles.secondaryButton} onClick={useLocation}>Check my delivery area</button>
                {locationLabel !== "Location not shared" && <button type="button" className={styles.textButton} onClick={clearLocation}>Clear</button>}
              </div>
            </div>
            <p className={styles.privacyNote}>Location is requested only after you tap the button, used for this check, and not saved by this page. The database response—not the browser—decides availability.</p>
            {message && <p className={styles.notice} role="status">{message}</p>}
          </section>

          <section className={styles.catalogue}>
            <div className={styles.catalogueHead}><div><p className={styles.eyebrow}>LIVE CATALOGUE</p><h2>Milk from this seller</h2></div><span className={styles.priceFrom}>{priceLabel(provider)}</span></div>
            {provider.isServiceable === false && <p className={styles.warning} role="status">This seller is outside the selected delivery area. You can still view the public catalogue.</p>}
            {provider.products.length === 0 ? (
              <div className={styles.emptyPanel}><strong>No active milk products listed.</strong><span>This provider has not published an active product in the public catalogue.</span></div>
            ) : (
              <div className={styles.productGrid}>
                {provider.products.map((item) => (
                  <article className={styles.productCard} key={item.id}>
                    <span className={styles.productMark} aria-hidden="true">{item.milkType === "cow" ? "C" : item.milkType === "buffalo" ? "B" : item.milkType === "a2" ? "A2" : "✳"}</span>
                    <div className={styles.productBody}>
                      <h3>{item.name}</h3>
                      <p>{item.milkType === "other" ? "Milk product" : item.milkType.toUpperCase() + " milk"} · {item.unitLabel}</p>
                      <strong className={styles.productPrice}>{item.pricePerLitre === null ? "Price not listed" : `${money.format(item.pricePerLitre)} / L`}</strong>
                      <span className={styles.daily}>{item.dailyAvailable ? "Daily plan availability listed" : "Availability varies"}</span>
                      <a className={styles.productLink} href={`/products/${encodeURIComponent(item.id)}?provider=${encodeURIComponent(provider.id)}`}>View product details <span aria-hidden="true">→</span></a>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <p className={styles.boundaryNote}>Read-only migration route. Cart, order placement and payments remain on the existing marketplace while those flows are tested for parity.</p>
          </section>
        </>
      )}

      {status === "ready" && provider && productId && !product && (
        <section className={styles.statePanel} role="status">
          <h1>Milk item not available</h1>
          <p>This product is no longer active in the seller’s public catalogue.</p>
          <a className={styles.primaryButton} href={`/stores/${encodeURIComponent(provider.id)}`}>Back to seller</a>
        </section>
      )}

      {status === "ready" && provider && productId && product && (
        <section className={styles.productDetail}>
          <p className={styles.eyebrow}>PRODUCT DETAILS</p>
          <div className={styles.detailLayout}>
            <div className={styles.productHeroMark} aria-hidden="true">{product.milkType === "cow" ? "C" : product.milkType === "buffalo" ? "B" : product.milkType === "a2" ? "A2" : "✳"}</div>
            <div className={styles.detailCopy}>
              <h1>{product.name}</h1>
              <p className={styles.productSubtitle}>{product.milkType === "other" ? "Milk product" : product.milkType.toUpperCase() + " milk"} · {product.unitLabel}</p>
              <p className={styles.detailDescription}>Listed by <strong>{provider.name}</strong>, an independent local seller serving {provider.area}{provider.city ? `, ${provider.city}` : ""}.</p>
              <div className={styles.detailPrice}>{product.pricePerLitre === null ? "Price not listed" : `${money.format(product.pricePerLitre)} per litre`}</div>
              <div className={styles.facts}>
                <div><span>Listed price</span><strong>{product.pricePerLitre === null ? "Unavailable" : `${money.format(product.pricePerLitre)} / L`}</strong></div>
                <div><span>Daily plan</span><strong>{product.dailyAvailable ? "Availability listed" : "Not listed"}</strong></div>
                <div><span>Seller delivery</span><strong>{deliveryWindow(provider)}</strong></div>
              </div>
              <p className={styles.boundaryNote}>This migrated page is read-only. Add-to-cart, recurring plans and checkout will be connected only after their existing validation and security behaviour is covered by tests.</p>
              <div className={styles.detailActions}>
                <a className={styles.primaryButton} href={`/stores/${encodeURIComponent(provider.id)}`}>View seller catalogue</a>
                <a className={styles.textButton} href="/providers">Browse other sellers</a>
              </div>
            </div>
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        <a className={styles.brand} href="/"><span className={styles.brandMark} aria-hidden="true">D</span><span><strong>Doodhwala</strong><small>Built around local sellers.</small></span></a>
        <span>© {new Date().getFullYear()} Doodhwala</span>
      </footer>
    </main>
  );
}
