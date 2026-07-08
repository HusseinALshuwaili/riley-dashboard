/**
 * Riley Security — Marketing Landing Page
 * Style: lium.ai inspired — dark editorial, large type, MagicBento features grid
 */

import { useEffect } from "react";
import { Link } from "wouter";
import MagicBento from "@/components/MagicBento";

// ---------------------------------------------------------------------------
// Inline styles (isolated from dashboard Tailwind)
// ---------------------------------------------------------------------------

const s = {
  root: {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    background: "#0c0c0a",
    color: "#f0ede6",
    minHeight: "100vh",
    overflowX: "hidden" as const,
  },

  // Nav
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 48px",
    height: "64px",
    borderBottom: "1px solid #1e1e1c",
    position: "sticky" as const,
    top: 0,
    background: "rgba(12, 12, 10, 0.92)",
    backdropFilter: "blur(12px)",
    zIndex: 50,
  },
  navLogo: {
    fontSize: "15px",
    fontWeight: 800,
    letterSpacing: "0.14em",
    color: "#f0ede6",
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: "32px",
  },
  navLink: {
    fontSize: "13px",
    color: "#696964",
    textDecoration: "none",
    letterSpacing: "0.02em",
    transition: "color 0.2s",
  },
  navCta: {
    fontSize: "12px",
    background: "#f0ede6",
    color: "#0c0c0a",
    padding: "7px 18px",
    borderRadius: "5px",
    fontWeight: 700,
    letterSpacing: "0.03em",
    textDecoration: "none",
    transition: "opacity 0.2s",
  },

  // Hero
  hero: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "96px 48px 80px",
    borderBottom: "1px solid #1e1e1c",
  },
  heroLabel: {
    display: "inline-block",
    fontSize: "10px",
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    color: "#696964",
    marginBottom: "24px",
    fontWeight: 500,
  },
  heroH1: {
    fontSize: "clamp(2.8rem, 6vw, 6.5rem)",
    fontWeight: 800,
    lineHeight: 1.02,
    letterSpacing: "-0.04em",
    color: "#f0ede6",
    margin: "0 0 24px",
    maxWidth: "820px",
  },
  heroSub: {
    fontSize: "16px",
    lineHeight: 1.65,
    color: "#696964",
    maxWidth: "520px",
    margin: "0 0 36px",
  },
  heroBtns: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },
  heroBtnPrimary: {
    fontSize: "13px",
    background: "#f0ede6",
    color: "#0c0c0a",
    padding: "10px 24px",
    borderRadius: "5px",
    fontWeight: 700,
    textDecoration: "none",
    letterSpacing: "0.02em",
  },
  heroBtnGhost: {
    fontSize: "13px",
    color: "#696964",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    letterSpacing: "0.02em",
    borderBottom: "1px solid #363630",
    paddingBottom: "2px",
  },

  // Stats bar
  statsBar: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "0 48px",
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    borderBottom: "1px solid #1e1e1c",
  },
  stat: {
    padding: "32px 0",
    borderRight: "1px solid #1e1e1c",
    paddingRight: "32px",
    paddingLeft: "32px",
  },
  statFirst: {
    paddingLeft: 0,
  },
  statVal: {
    fontSize: "32px",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    color: "#f0ede6",
    lineHeight: 1,
    marginBottom: "6px",
  },
  statLabel: {
    fontSize: "11px",
    color: "#696964",
    letterSpacing: "0.04em",
  },

  // Section
  section: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "80px 48px",
    borderBottom: "1px solid #1e1e1c",
  },
  sectionLabel: {
    fontSize: "10px",
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    color: "#696964",
    marginBottom: "24px",
    fontWeight: 500,
    display: "block",
  },
  sectionH2: {
    fontSize: "clamp(1.6rem, 3.5vw, 3rem)",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
    color: "#f0ede6",
    margin: "0 0 16px",
    maxWidth: "700px",
  },
  sectionSub: {
    fontSize: "15px",
    color: "#696964",
    lineHeight: 1.65,
    maxWidth: "540px",
    margin: "0 0 48px",
  },

  // Challenge / Solution two-col
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "64px",
    alignItems: "start",
  },
  twoColLeft: {},
  twoColRight: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
  },
  featurePill: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    padding: "20px",
    background: "#141412",
    border: "1px solid #1e1e1c",
    borderRadius: "10px",
  },
  pillDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "rgba(132, 0, 255, 0.9)",
    marginTop: "6px",
    flexShrink: 0,
  },
  pillTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#f0ede6",
    marginBottom: "4px",
    letterSpacing: "-0.01em",
  },
  pillDesc: {
    fontSize: "12px",
    color: "#696964",
    lineHeight: 1.55,
  },

  // Bento section
  bentoSection: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "80px 0",
    borderBottom: "1px solid #1e1e1c",
  },
  bentoHeader: {
    padding: "0 48px",
    marginBottom: "8px",
  },

  // Security section
  securityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    marginTop: "40px",
  },
  secCard: {
    padding: "24px",
    background: "#141412",
    border: "1px solid #1e1e1c",
    borderRadius: "10px",
  },
  secCardLabel: {
    fontSize: "10px",
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const,
    color: "#696964",
    marginBottom: "10px",
    display: "block",
    fontWeight: 500,
  },
  secCardTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#f0ede6",
    marginBottom: "6px",
    letterSpacing: "-0.01em",
  },
  secCardDesc: {
    fontSize: "12px",
    color: "#696964",
    lineHeight: 1.55,
  },

  // CTA
  ctaSection: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "100px 48px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    textAlign: "center" as const,
  },
  ctaH2: {
    fontSize: "clamp(2rem, 4.5vw, 4.5rem)",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    lineHeight: 1.05,
    color: "#f0ede6",
    margin: "0 0 20px",
    maxWidth: "700px",
  },
  ctaSub: {
    fontSize: "15px",
    color: "#696964",
    lineHeight: 1.65,
    maxWidth: "480px",
    margin: "0 0 36px",
  },
  ctaBtns: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    justifyContent: "center",
  },

  // Footer
  footer: {
    borderTop: "1px solid #1e1e1c",
    padding: "32px 48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: "1100px",
    margin: "0 auto",
  },
  footerLogo: {
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: "#696964",
  },
  footerRight: {
    fontSize: "12px",
    color: "#363630",
    letterSpacing: "0.04em",
  },
};

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  // Inject Inter font
  useEffect(() => {
    if (!document.querySelector('link[data-riley-font]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap';
      link.setAttribute('data-riley-font', 'true');
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div style={s.root}>

      {/* ── Nav ─────────────────────────────────────────── */}
      <nav style={s.nav}>
        <div style={s.navLogo}>RILEY</div>
        <div style={s.navLinks}>
          <a href="#features" style={s.navLink}>Agents</a>
          <a href="#security" style={s.navLink}>Security</a>
          <a href="#challenge" style={s.navLink}>How it works</a>
          <Link href="/" style={s.navLink}>Dashboard →</Link>
          <Link href="/" style={s.navCta}>Get started</Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section style={s.hero}>
        <span style={s.heroLabel}>Autonomous SOC Intelligence</span>
        <h1 style={s.heroH1}>
          From alert to incident<br />without the noise.
        </h1>
        <p style={s.heroSub}>
          Riley runs a four-agent adversarial pipeline on every pending alert —
          analyst-grade triage at machine speed, 24 hours a day. No missed
          incidents. No alert fatigue.
        </p>
        <div style={s.heroBtns}>
          <Link href="/" style={s.heroBtnPrimary}>Open dashboard</Link>
          <a href="#features" style={s.heroBtnGhost}>
            See how it works <span>→</span>
          </a>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────── */}
      <div style={s.statsBar}>
        {[
          { val: "2.4s",  label: "Avg. alert triage time" },
          { val: "94%",   label: "True positive accuracy" },
          { val: "4",     label: "Specialized AI agents" },
          { val: "24/7",  label: "Autonomous coverage" },
        ].map(({ val, label }, i) => (
          <div key={i} style={{ ...s.stat, ...(i === 0 ? s.statFirst : {}), ...(i === 3 ? { borderRight: "none" } : {}) }}>
            <div style={s.statVal}>{val}</div>
            <div style={s.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Challenge ───────────────────────────────────── */}
      <section id="challenge" style={s.section}>
        <span style={s.sectionLabel}>The Challenge</span>
        <div style={s.twoCol}>
          <div style={s.twoColLeft}>
            <h2 style={s.sectionH2}>
              Your most critical incidents shouldn't sit in a pending queue.
            </h2>
            <p style={s.sectionSub}>
              Security alert queues grow faster than teams can triage them.
              Every unreviewed alert is a window of exposure. Riley closes
              that window automatically — correlating, challenging, and
              resolving alerts before any human analyst sees them.
            </p>
            <Link href="/" style={s.heroBtnPrimary}>Start triaging now</Link>
          </div>
          <div style={s.twoColRight}>
            {[
              { title: "Alert fatigue is killing coverage", desc: "Analysts skip alerts when queues are too long. Riley never skips." },
              { title: "Manual triage misses correlations", desc: "Isolated alert review misses multi-stage attack campaigns that span assets and tactics." },
              { title: "Remediation arrives too late", desc: "By the time a ticket is created, the attacker has already moved laterally." },
            ].map((item, i) => (
              <div key={i} style={s.featurePill}>
                <div style={s.pillDot} />
                <div>
                  <div style={s.pillTitle}>{item.title}</div>
                  <div style={s.pillDesc}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features bento grid ─────────────────────────── */}
      <section id="features" style={s.bentoSection}>
        <div style={s.bentoHeader}>
          <span style={s.sectionLabel}>Capabilities</span>
          <h2 style={{ ...s.sectionH2, marginBottom: 0 }}>
            Every tool your SOC needs, wired together.
          </h2>
        </div>
        <MagicBento
          textAutoHide={true}
          enableStars={true}
          enableSpotlight={true}
          enableBorderGlow={true}
          enableTilt={false}
          enableMagnetism={false}
          clickEffect={true}
          spotlightRadius={400}
          particleCount={12}
          glowColor="132, 0, 255"
          disableAnimations={false}
        />
      </section>

      {/* ── Security section ────────────────────────────── */}
      <section id="security" style={s.section}>
        <span style={s.sectionLabel}>Security & Privacy</span>
        <h2 style={s.sectionH2}>Enterprise-grade. Private by design.</h2>
        <p style={s.sectionSub}>
          Riley runs on your infrastructure. Your alert data, your incidents,
          your keys — nothing leaves your environment.
        </p>
        <div style={s.securityGrid}>
          {[
            { label: "Data", title: "Your data stays yours", desc: "Riley does not train on your security data. Every alert and incident remains in your Neon database." },
            { label: "Auth", title: "End-to-end encryption", desc: "All API traffic is TLS. Database credentials are stored as environment variables, never committed." },
            { label: "Access", title: "Controlled access", desc: "Role-based permissions across teams. Audit logs for every agent action and alert status change." },
            { label: "Keys", title: "Zero hardcoded secrets", desc: "API keys for Groq, VirusTotal, Shodan, and AbuseIPDB are transient env vars on Render — never in source." },
            { label: "Agents", title: "Adversarial by design", desc: "The Verdict agent actively challenges the Analyzer and Investigator to prevent false positives from reaching incident status." },
            { label: "Ops", title: "No downtime SLA", desc: "Autonomous cron sweeps continue independently of your analyst team. No manual intervention required." },
          ].map((card, i) => (
            <div key={i} style={s.secCard}>
              <span style={s.secCardLabel}>{card.label}</span>
              <div style={s.secCardTitle}>{card.title}</div>
              <div style={s.secCardDesc}>{card.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section style={s.ctaSection}>
        <h2 style={s.ctaH2}>
          Ask Riley anything.<br />It answers with evidence.
        </h2>
        <p style={s.ctaSub}>
          Every alert. Every incident. Every IOC. Riley correlates, triages,
          and remediates — then explains its reasoning.
        </p>
        <div style={s.ctaBtns}>
          <Link href="/" style={s.heroBtnPrimary}>Open dashboard</Link>
          <Link href="/tier1" style={{ ...s.heroBtnGhost, color: "#696964" }}>
            View Tier 1 agent →
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid #1e1e1c" }}>
        <div style={s.footer}>
          <div style={s.footerLogo}>RILEY</div>
          <div style={s.footerRight}>© 2026 Riley Security · Built with Groq LLaMA-3.3-70b</div>
        </div>
      </footer>

    </div>
  );
}
