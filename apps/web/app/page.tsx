const categories = [
  { title: "Cow milk", detail: "Fresh and creamy", mark: "C" },
  { title: "Buffalo milk", detail: "Rich and thick", mark: "B" },
  { title: "A2 milk", detail: "Explore local options", mark: "A2" },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Doodhwala home">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span><strong>Doodhwala</strong><small>Local milk, nearby.</small></span>
        </a>
        <nav className="topnav" aria-label="Main navigation">
          <a href="#discover">Discover</a>
          <a href="#how-it-works">How it works</a>
          <a className="nav-cta" href="#discover">Find local milk <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> FRESH · LOCAL · DIRECT</p>
          <h1 id="hero-title">Your neighbourhood’s milk, <em>one tap away.</em></h1>
          <p className="hero-description">Meet independent milk sellers near you. Compare what they offer, choose what suits your home, and order directly.</p>
          <div className="hero-actions"><a className="button button-primary" href="#discover">Explore local milk <span aria-hidden="true">→</span></a><a className="text-link" href="#how-it-works">How Doodhwala works</a></div>
          <div className="trust-row"><span aria-hidden="true">✓</span> Independent local sellers <span className="trust-divider">·</span> Transparent prices <span className="trust-divider">·</span> Direct ordering</div>
        </div>
        <div className="hero-art" aria-label="Illustration of a milk bottle in a green countryside" role="img">
          <div className="sun" /><div className="hill hill-back" /><div className="hill hill-front" />
          <div className="farmhouse"><span className="roof" /><span className="house-body"><i /><b /></span></div>
          <div className="milk-bottle"><span className="bottle-cap" /><span className="bottle-neck" /><span className="bottle-body"><i>✳</i><small>FRESH<br />DAILY</small></span></div>
          <div className="art-caption"><span className="caption-icon">✳</span><span><b>From your neighbourhood</b><small>Closer to home. Fresher by design.</small></span></div>
        </div>
      </section>

      <section className="discover" id="discover" aria-labelledby="discover-title">
        <div className="section-heading"><div><p className="eyebrow">A GOOD PLACE TO START</p><h2 id="discover-title">Find your kind of milk</h2></div><p>Explore the options available from local providers.</p></div>
        <div className="category-grid">{categories.map((category) => <article className="category-card" key={category.title}><span className="category-mark">{category.mark}</span><span className="category-copy"><strong>{category.title}</strong><small>{category.detail}</small></span><span className="category-arrow" aria-hidden="true">↗</span></article>)}</div>
        <p className="migration-note"><span aria-hidden="true">✦</span> This is the new framework foundation. Live provider search, accounts, carts and checkout will be migrated only after their existing behaviour is mapped and tested.</p>
      </section>

      <section className="how-section" id="how-it-works"><p className="eyebrow">SIMPLE BY DESIGN</p><h2 id="how-title">Local milk. Less hassle.</h2><div className="steps"><article><span>01</span><strong>Discover nearby</strong><p>Explore independent providers serving your area.</p></article><article><span>02</span><strong>Compare confidently</strong><p>Review milk types, prices and delivery details.</p></article><article><span>03</span><strong>Order directly</strong><p>Choose a seller and follow a clear order journey.</p></article></div></section>
      <footer className="footer"><a className="footer-brand" href="/">Doodhwala</a><span>Built around neighbourhoods, powered by local sellers.</span><span>© {new Date().getFullYear()} Doodhwala</span></footer>
    </main>
  );
}
