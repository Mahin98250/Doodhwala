import Link from "next/link";
import type { ReactNode } from "react";

interface WorkspaceFrameProps {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  compact?: boolean;
}

const nav = [
  { href: "/", label: "Home" },
  { href: "/providers", label: "Find milk" },
  { href: "/cart", label: "Cart" },
  { href: "/saved", label: "Saved" },
  { href: "/orders", label: "Orders" },
  { href: "/subscriptions", label: "Milk plans" },
  { href: "/account", label: "Account" },
  { href: "/support", label: "Support" },
];

export default function WorkspaceFrame({ title, eyebrow = "DOODHWALA WORKSPACE", description, children, compact = false }: WorkspaceFrameProps) {
  return (
    <main className="workspace">
      <header className="workspace-header">
        <Link className="workspace-brand" href="/" aria-label="Doodhwala home">
          <span className="workspace-brand-mark" aria-hidden="true">D</span>
          <span><strong>Doodhwala</strong><small>Independent local milk marketplace</small></span>
        </Link>
        <nav aria-label="Main navigation" className="workspace-nav">
          {nav.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </nav>
      </header>
      <section className={"workspace-content" + (compact ? " workspace-content-compact" : "")}>
        <div className="workspace-intro">
          <p className="workspace-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {description && <p className="workspace-description">{description}</p>}
        </div>
        {children}
      </section>
      <footer className="workspace-footer">
        <span>© {new Date().getFullYear()} Doodhwala</span>
        <span>Local sellers · Transparent pricing · Secure order flows</span>
        <Link href="/legal">Policies &amp; marketplace terms</Link>
      </footer>
    </main>
  );
}
