import styles from "@/components/route-feedback.module.css";

export default function Loading() {
  return (
    <main className={styles.shell} aria-busy="true" aria-live="polite">
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Doodhwala home">
          <span className={styles.mark} aria-hidden="true">D</span>
          <span><strong>Doodhwala</strong><small>Local milk, nearby.</small></span>
        </a>
      </header>
      <section className={styles.content}>
        <span className={styles.spinner} aria-hidden="true" />
        <p className={styles.eyebrow}>JUST A MOMENT</p>
        <h1 className={styles.title}>Getting things ready</h1>
        <p className={styles.copy}>We’re loading this part of Doodhwala. Please keep this page open.</p>
      </section>
      <footer className={styles.footer}><span>Doodhwala</span><span>Built around local sellers.</span></footer>
    </main>
  );
}
