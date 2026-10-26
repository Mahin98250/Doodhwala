import Link from "next/link";
import styles from "@/components/route-feedback.module.css";

export default function NotFound() {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Doodhwala home">
          <span className={styles.mark} aria-hidden="true">D</span>
          <span><strong>Doodhwala</strong><small>Local milk, nearby.</small></span>
        </Link>
      </header>
      <section className={styles.content}>
        <p className={styles.eyebrow}>404 · NOT FOUND</p>
        <h1 className={styles.title}>This page isn’t in the catalogue.</h1>
        <p className={styles.copy}>The link may be outdated, or the seller or product is no longer published. Nothing was ordered or changed.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/providers">Browse providers</Link>
          <Link className={styles.secondary} href="/">Back to home</Link>
        </div>
      </section>
      <footer className={styles.footer}><span>Doodhwala</span><span>Built around local sellers.</span></footer>
    </main>
  );
}
