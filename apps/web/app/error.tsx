"use client";

import { useEffect } from "react";
import styles from "@/components/route-feedback.module.css";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Do not print the exception to the UI; its message may contain internal details.
    // The digest is retained by Next.js for server-side log correlation.
    console.error("Doodhwala route rendering failed", error.digest ?? "no-digest");
  }, [error]);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Doodhwala home">
          <span className={styles.mark} aria-hidden="true">D</span>
          <span><strong>Doodhwala</strong><small>Local milk, nearby.</small></span>
        </a>
      </header>
      <section className={styles.content} role="alert">
        <p className={styles.eyebrow}>A TEMPORARY INTERRUPTION</p>
        <h1 className={styles.title}>This page hit a problem.</h1>
        <p className={styles.copy}>Your browsing session has not placed an order or changed payment details. You can retry the page or return to the provider catalogue.</p>
        <div className={styles.actions}>
          <button className={styles.primary} type="button" onClick={() => reset()}>Try again</button>
          <a className={styles.secondary} href="/providers">Browse providers</a>
        </div>
      </section>
      <footer className={styles.footer}><span>Doodhwala</span><span>Built around local sellers.</span></footer>
    </main>
  );
}
