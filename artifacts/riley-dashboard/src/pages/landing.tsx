/**
 * Riley Security — Marketing Landing Page
 * Dark editorial aesthetic, lium.ai inspired.
 * Includes: hero, stats, challenge, features bento, pricing, waitlist CTA, footer
 */

import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import MagicBento from "@/components/MagicBento";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

// ---------------------------------------------------------------------------
// Inline styles
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
  statFirst: { paddingLeft: 0 },
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

  // Two-col
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "64px",
    alignItems: "start",
  },
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

  // Security grid
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

  // Pricing
  pricingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    marginTop: "40px",
  },
  pricingCard: {
    padding: "32px",
    background: "#141412",
    border: "1px solid #1e1e1c",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0",
  },
  pricingCardHighlight: {
    padding: "32px",
    background: "rgba(132,0,255,0.07)",
    border: "1px solid rgba(132,0,255,0.3)",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0",
    position: "relative" as const,
  },
  pricingBadge: {
    position: "absolute" as const,
    top: "-12px",
    left: "32px",
    fontSize: "10px",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    background: "rgba(132,0,255,0.9)",
    color: "#fff",
    padding: "3px 10px",
    borderRadius: "4px",
    fontWeight: 700,
  },
  pricingName: {
    fontSize: "12px",
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "#696964",
    fontWeight: 600,
    marginBottom: "16px",
  },
  pricingPrice: {
    fontSize: "40px",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    color: "#f0ede6",
    lineHeight: 1,
  },
  pricingPeriod: {
    fontSize: "14px",
    color: "#696964",
    fontWeight: 400,
    marginLeft: "4px",
  },
  pricingDesc: {
    fontSize: "13px",
    color: "#696964",
    lineHeight: 1.55,
    marginTop: "12px",
    marginBottom: "24px",
    paddingBottom: "24px",
    borderBottom: "1px solid #1e1e1c",
  },
  pricingFeatures: {
    listStyle: "none",
    margin: "0 0 32px",
    padding: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
    flex: 1,
  },
  pricingFeature: {
    fontSize: "13px",
    color: "#969690",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  pricingCheck: {
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    background: "rgba(132,0,255,0.15)",
    border: "1px solid rgba(132,0,255,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: "9px",
    color: "rgba(180,120,255,0.9)",
  },
  pricingCta: {
    display: "block",
    textAlign: "center" as const,
    padding: "11px 0",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 700,
    textDecoration: "none",
    letterSpacing: "0.03em",
    cursor: "pointer",
  },
  pricingCtaDefault: {
    background: "#1e1e1c",
    color: "#f0ede6",
    border: "1px solid #363630",
  },
  pricingCtaHighlight: {
    background: "#8400ff",
    color: "#fff",
    border: "none",
  },

  // Waitlist form
  waitlistSection: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "100px 48px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    textAlign: "center" as const,
  },
  waitlistH2: {
    fontSize: "clamp(2rem, 4.5vw, 4.5rem)",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    lineHeight: 1.05,
    color: "#f0ede6",
    margin: "0 0 20px",
    maxWidth: "700px",
  },
  waitlistSub: {
    fontSize: "15px",
    color: "#696964",
    lineHeight: 1.65,
    maxWidth: "480px",
    margin: "0 0 40px",
  },
  waitlistForm: {
    display: "flex",
    gap: "10px",
    maxWidth: "440px",
    width: "100%",
  },
  waitlistInput: {
    flex: 1,
    padding: "11px 16px",
    background: "#141412",
    border: "1px solid #363630",
    borderRadius: "6px",
    color: "#f0ede6",
    fontSize: "14px",
    outline: "none",
    fontFamily: "inherit",
  },
  waitlistBtn: {
    padding: "11px 24px",
    background: "#f0ede6",
    color: "#0c0c0a",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.02em",
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
  },
  waitlistSuccess: {
    fontSize: "14px",
    color: "#22c55e",
    background: "rgba(34,197,94,0.08)",
    border: "1px solid rgba(34,197,94,0.2)",
    borderRadius: "8px",
    padding: "12px 24px",
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
// Pricing tiers
// ---------------------------------------------------------------------------

const TIERS = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    desc: "Perfect for solo analysts and small teams evaluating autonomous SOC.",
    features: [
      "100 alerts / month",
      "Riley AI chat assistant",
      "Bug scanner (3-agent pipeline)",
      "Threat map visualization",
      "1 workspace",
    ],
    cta: "Open dashboard",
    ctaHref: "/",
    ctaExternal: false,
    highlight: false,
  },
  {
    name: "Pro",
    price: "$99",
    period: "/ mo",
    desc: "Full autonomous SOC coverage for growing security teams.",
    features: [
      "Unlimited alerts",
      "Tier 1 autonomous agent (24/7)",
      "OSINT + Recon intelligence",
      "Attack pattern clustering",
      "Incident runbooks with remediation",
      "5 workspaces",
    ],
    cta: "Join waitlist",
    ctaHref: "#waitlist",
    ctaExternal: false,
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "Dedicated infrastructure, SLAs, and custom integrations for large teams.",
    features: [
      "Everything in Pro",
      "Dedicated Render instance",
      "Custom SIEM integrations",
      "SSO / SAML auth",
      "99.9% uptime SLA",
      "Dedicated support channel",
    ],
    cta: "Contact us",
    ctaHref: "mailto:husseinallshuwaili@gmail.com?subject=Riley%20Enterprise%20Inquiry",
    ctaExternal: true,
    highlight: false,
  },
];

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"starter" | "pro" | "enterprise">("pro");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  const handleWaitlist = async (e: FormEvent, planOverride?: "starter" | "pro" | "enterprise") => {
    e.preventDefault();
    if (!email || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`${API_BASE}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan: planOverride ?? plan, source: "landing" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Signup failed");
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={s.root}>

      {/* ── Nav ─────────────────────────────────────────── */}
      <nav style={s.nav}>
        <div style={s.navLogo}>RILEY</div>
        <div style={s.navLinks}>
          <a href="#features" style={s.navLink}>Agents</a>
          <a href="#pricing" style={s.navLink}>Pricing</a>
          <a href="#security" style={s.navLink}>Security</a>
          <Link href="/" style={s.navLink}>Dashboard →</Link>
          <a href="#waitlist" style={s.navCta}>Get started</a>
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
          <a href="#pricing" style={s.heroBtnGhost}>
            See pricing <span>→</span>
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
          <div
            key={i}
            style={{
              ...s.stat,
              ...(i === 0 ? s.statFirst : {}),
              ...(i === 3 ? { borderRight: "none" } : {}),
            }}
          >
            <div style={s.statVal}>{val}</div>
            <div style={s.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Challenge ───────────────────────────────────── */}
      <section id="challenge" style={s.section}>
        <span style={s.sectionLabel}>The Challenge</span>
        <div style={s.twoCol}>
          <div>
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

      {/* ── Security ────────────────────────────────────── */}
      <section id="security" style={s.section}>
        <span style={s.sectionLabel}>Security & Privacy</span>
        <h2 style={s.sectionH2}>Enterprise-grade. Private by design.</h2>
        <p style={s.sectionSub}>
          Riley runs on your infrastructure. Your alert data, your incidents,
          your keys — nothing leaves your environment.
        </p>
        <div style={s.securityGrid}>
          {[
            { label: "Data",    title: "Your data stays yours",      desc: "Riley does not train on your security data. Every alert and incident remains in your Neon database." },
            { label: "Auth",    title: "End-to-end encryption",      desc: "All API traffic is TLS. Database credentials are stored as environment variables, never committed." },
            { label: "Access",  title: "Controlled access",          desc: "Role-based permissions across teams. Audit logs for every agent action and alert status change." },
            { label: "Keys",    title: "Zero hardcoded secrets",     desc: "API keys for Groq, VirusTotal, Shodan, and AbuseIPDB are transient env vars on Render — never in source." },
            { label: "Agents",  title: "Adversarial by design",      desc: "The Verdict agent actively challenges the Analyzer and Investigator to prevent false positives reaching incident status." },
            { label: "Ops",     title: "Always-on coverage",         desc: "Autonomous cron sweeps continue independently of your analyst team. No manual intervention required." },
          ].map((card, i) => (
            <div key={i} style={s.secCard}>
              <span style={s.secCardLabel}>{card.label}</span>
              <div style={s.secCardTitle}>{card.title}</div>
              <div style={s.secCardDesc}>{card.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────── */}
      <section id="pricing" style={s.section}>
        <span style={s.sectionLabel}>Pricing</span>
        <h2 style={s.sectionH2}>Simple, transparent pricing.</h2>
        <p style={s.sectionSub}>
          Start free with the dashboard. Upgrade to Pro when you need
          autonomous triage and intelligence — no sales call required.
        </p>
        <div style={s.pricingGrid}>
          {TIERS.map((tier) => {
            const cardStyle = tier.highlight ? s.pricingCardHighlight : s.pricingCard;
            return (
              <div key={tier.name} style={cardStyle}>
                {tier.highlight && "badge" in tier && (
                  <div style={s.pricingBadge}>{tier.badge}</div>
                )}
                <div style={s.pricingName}>{tier.name}</div>
                <div>
                  <span style={s.pricingPrice}>{tier.price}</span>
                  {tier.period && <span style={s.pricingPeriod}>{tier.period}</span>}
                </div>
                <div style={s.pricingDesc}>{tier.desc}</div>
                <ul style={s.pricingFeatures}>
                  {tier.features.map((f) => (
                    <li key={f} style={s.pricingFeature}>
                      <span style={s.pricingCheck}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                {tier.ctaExternal ? (
                  <a
                    href={tier.ctaHref}
                    style={{
                      ...s.pricingCta,
                      ...(tier.highlight ? s.pricingCtaHighlight : s.pricingCtaDefault),
                    }}
                  >
                    {tier.cta}
                  </a>
                ) : tier.ctaHref.startsWith("#") ? (
                  <a
                    href={tier.ctaHref}
                    onClick={() => setPlan(tier.name.toLowerCase() as "starter" | "pro" | "enterprise")}
                    style={{
                      ...s.pricingCta,
                      ...(tier.highlight ? s.pricingCtaHighlight : s.pricingCtaDefault),
                    }}
                  >
                    {tier.cta}
                  </a>
                ) : (
                  <Link
                    href={tier.ctaHref}
                    style={{
                      ...s.pricingCta,
                      ...(tier.highlight ? s.pricingCtaHighlight : s.pricingCtaDefault),
                    }}
                  >
                    {tier.cta}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Waitlist CTA ────────────────────────────────── */}
      <section id="waitlist" style={s.waitlistSection}>
        <span style={{ ...s.heroLabel, marginBottom: "16px" }}>Early access</span>
        <h2 style={s.waitlistH2}>
          Be the first to try<br />Riley Pro.
        </h2>
        <p style={s.waitlistSub}>
          Pro is launching soon. Drop your email and we'll reach out when
          your spot is ready — no credit card required.
        </p>
        {submitted ? (
          <div style={s.waitlistSuccess}>
            ✓ You're on the list — we'll be in touch soon.
          </div>
        ) : (
          <form onSubmit={handleWaitlist} style={s.waitlistForm}>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={s.waitlistInput}
            />
            <button type="submit" disabled={submitting} style={s.waitlistBtn}>
              {submitting ? "Joining…" : "Join waitlist"}
            </button>
          </form>
        )}
        {submitError && (
          <p style={{ fontSize: "13px", color: "#f97316", marginTop: "12px" }}>
            {submitError}
          </p>
        )}
        <p style={{ fontSize: "12px", color: "#363630", marginTop: "16px" }}>
          No spam. One email when Pro launches.
        </p>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid #1e1e1c" }}>
        <div style={s.footer}>
          <div style={s.footerLogo}>RILEY</div>
          <div style={s.footerRight}>© 2026 Riley Security · Powered by Groq LLaMA</div>
        </div>
      </footer>

    </div>
  );
}
