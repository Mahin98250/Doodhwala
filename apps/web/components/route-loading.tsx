import styles from "./route-feedback.module.css";

interface RouteLoadingProps {
  title?: string;
  detail?: string;
}

export default function RouteLoading({
  title = "Loading the live catalogue",
  detail = "Connecting to Doodhwala’s existing public catalogue. This can take a moment on a slow connection.",
}: RouteLoadingProps) {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Doodhwala home">
          <span className={styles.mark} aria-hidden="true">D</span>
          <span><strong>Doodhwala</strong><small>Local milk, nearby.</small></span>
        </a>
        <a className={styles.secondary} href="/providers">Browse providers</a>
      </header>
      <section className={styles.content} role="status" aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" />
        <p className={styles.eyebrow}>FRESH · LOCAL · DIRECT</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.copy}>{detail}</p>
      </section>
      <footer className={styles.footer}><span>Doodhwala</span><span>Local milk, nearby.</span></footer>
    </main>
  );
}
