import Link from "next/link";
"use client";

import { useEffect, useState } from "react";
import WorkspaceFrame from "@/components/workspace-frame";
import { cartEntries, cartSubtotal, readCart, removeCartItem, setCartQuantity, writeCart, type Cart } from "@/lib/commerce/cart";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export default function CartWorkspace() {
  const [cart, setCart] = useState<Cart>({});
  const [ready, setReady] = useState(false);

  useEffect(() => { setCart(readCart()); setReady(true); }, []);

  function update(next: Cart) {
    setCart(next);
    writeCart(next);
  }

  const items = cartEntries(cart);
  return (
    <WorkspaceFrame title="Your cart" description="Review quantities before checkout. The backend recalculates the final price when the order is placed.">
      <section className="workspace-card">
        <div className="workspace-section-head"><div><p className="workspace-eyebrow">YOUR MILK SELECTION</p><h2>{items.length} item{items.length === 1 ? "" : "s"}</h2></div><Link className="workspace-inline-link" href="/providers">Continue shopping →</Link></div>
        {!ready ? <p className="workspace-muted">Loading your cart…</p> : !items.length ? <div className="workspace-empty"><div className="workspace-item-icon">✳</div><h2>Your cart is waiting for fresh milk.</h2><p>Choose a local provider and add the products you need.</p><Link className="workspace-button workspace-button-primary" href="/providers">Explore local milk</Link></div> : (
          <>
            <div className="workspace-list">
              {Object.entries(cart).map(([key, item]) => <article className="workspace-list-row" key={key}>
                <div className="workspace-item-icon">✳</div>
                <div className="workspace-list-main"><strong>{item.milk}</strong><span>{item.provider}</span><small>{money.format(item.unitPrice)} / L · Indicative listing price</small></div>
                <div className="workspace-quantity">
                  <button type="button" aria-label={"Decrease " + item.milk} onClick={() => update(setCartQuantity(cart, key, Math.round((item.qty - 0.5) * 1000) / 1000))}>−</button>
                  <input aria-label={"Quantity of " + item.milk + " in litres"} value={item.qty} inputMode="decimal" onChange={(e) => update(setCartQuantity(cart, key, Number(e.target.value)))} />
                  <button type="button" aria-label={"Increase " + item.milk} onClick={() => update(setCartQuantity(cart, key, item.qty + 0.5))}>+</button>
                </div>
                <strong className="workspace-line-total">{money.format(item.unitPrice * item.qty)}</strong>
                <button className="workspace-text-button" onClick={() => update(removeCartItem(cart, key))}>Remove</button>
              </article>)}
            </div>
            <div className="workspace-cart-total"><span>Estimated subtotal</span><strong>{money.format(cartSubtotal(cart))}</strong></div>
            <p className="workspace-muted">This estimate is for planning only. Checkout validates products, delivery area, price and payment readiness with Supabase before creating orders.</p>
            <div className="workspace-actions"><Link className="workspace-button workspace-button-secondary" href="/providers">Add more milk</Link><Link className="workspace-button workspace-button-primary" href="/checkout">Secure checkout →</Link></div>
          </>
        )}
      </section>
    </WorkspaceFrame>
  );
}
