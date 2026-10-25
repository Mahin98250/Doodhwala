"use client";

import { useEffect, useState } from "react";
import WorkspaceFrame from "@/components/workspace-frame";

interface SavedProduct { id: string; providerId: string; name?: string; providerName?: string; savedAt?: number; }
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export default function SavedItemsWorkspace() {
  const [products,setProducts]=useState<SavedProduct[]>([]);
  const [providers,setProviders]=useState<string[]>([]);
  const [ready,setReady]=useState(false);

  function load() {
    try {
      const rawProducts=JSON.parse(window.localStorage.getItem("doodhwala-saved-items-v1") ?? "[]");
      const validProducts=Array.isArray(rawProducts) ? rawProducts.filter((item): item is SavedProduct => item && typeof item==="object" && typeof item.id==="string" && UUID.test(item.id) && typeof item.providerId==="string" && UUID.test(item.providerId)).slice(0,100) : [];
      const rawProviders=JSON.parse(window.localStorage.getItem("doodhwala-favorites") ?? "[]");
      const validProviders=Array.isArray(rawProviders) ? [...new Set(rawProviders.filter((id):id is string=>typeof id==="string"&&UUID.test(id)))].slice(0,100):[];
      setProducts(validProducts);setProviders(validProviders);
    } catch { setProducts([]);setProviders([]); }
    setReady(true);
  }

  useEffect(()=>{load();},[]);

  function removeProduct(item:SavedProduct) {
    const next=products.filter((p)=>!(p.id===item.id&&p.providerId===item.providerId));
    setProducts(next);
    try{window.localStorage.setItem("doodhwala-saved-items-v1",JSON.stringify(next));}catch{}
  }
  function removeProvider(id:string) {
    const next=providers.filter((item)=>item!==id);
    setProviders(next);
    try{window.localStorage.setItem("doodhwala-favorites",JSON.stringify(next));}catch{}
  }

  return (
    <WorkspaceFrame title="Your saved items" description="Saved products and favourite local sellers are kept on this device, so you can return to them quickly.">
      {!ready ? <section className="workspace-card"><p>Loading saved items…</p></section> : <>
        <section className="workspace-card">
          <div className="workspace-section-head"><div><p className="workspace-eyebrow">MILK PRODUCTS</p><h2>Saved products ({products.length})</h2></div><a className="workspace-inline-link" href="/providers">Discover milk →</a></div>
          {!products.length ? <div className="workspace-empty-inline"><strong>No saved products yet.</strong><p>Open a seller catalogue and tap Save on a product you like.</p></div> : <div className="workspace-list">
            {products.map((item)=><article className="workspace-list-row" key={item.providerId+":"+item.id}>
              <div className="workspace-item-icon">✳</div><div className="workspace-list-main"><strong>{item.name||"Saved milk product"}</strong><span>{item.providerName||"Independent local seller"}</span><small>Saved on this device</small></div>
              <div className="workspace-row-actions"><a href={"/products/"+encodeURIComponent(item.id)+"?provider="+encodeURIComponent(item.providerId)}>View</a><button className="workspace-text-button danger" onClick={()=>removeProduct(item)}>Remove</button></div>
            </article>)}
          </div>}
        </section>
        <section className="workspace-card">
          <div className="workspace-section-head"><div><p className="workspace-eyebrow">FAVOURITE SELLERS</p><h2>Saved local providers ({providers.length})</h2></div><a className="workspace-inline-link" href="/providers">Find providers →</a></div>
          {!providers.length ? <div className="workspace-empty-inline"><strong>No saved sellers yet.</strong><p>Save a seller from their storefront to keep it here.</p></div> : <div className="workspace-list">
            {providers.map((id)=><article className="workspace-list-row" key={id}><div className="workspace-item-icon">♥</div><div className="workspace-list-main"><strong>Local seller</strong><span>Provider reference: {id}</span><small>Saved on this device</small></div><div className="workspace-row-actions"><a href={"/stores/"+encodeURIComponent(id)}>Open seller</a><button className="workspace-text-button danger" onClick={()=>removeProvider(id)}>Remove</button></div></article>)}
          </div>}
        </section>
      </>}
      <p className="workspace-muted">Saved items are local to this browser and are not synced across devices. Sign in to manage addresses, orders and subscriptions.</p>
    </WorkspaceFrame>
  );
}
