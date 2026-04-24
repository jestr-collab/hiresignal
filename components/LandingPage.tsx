"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef, type ReactNode } from "react";
import "../app/landing.css";

function useSmoothScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "smooth";
    return () => {
      html.style.scrollBehavior = prev;
    };
  }, []);
}

function fireConfetti() {
  if (typeof document === "undefined") return;
  const accent =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim() || "#16A34A";
  const ink = "#0a0a0a";
  const colors = [accent, ink, "#fff", accent, accent];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    const x = window.innerWidth / 2 + (Math.random() - 0.5) * 80;
    const y = window.innerHeight / 2;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = colors[Math.floor(Math.random() * colors.length)]!;
    const dx = (Math.random() - 0.5) * 800;
    const dy = -Math.random() * 500 - 200;
    const rot = Math.random() * 720 - 360;
    document.body.appendChild(p);
    p.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy + 600}px) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      { duration: 1500 + Math.random() * 500, easing: "cubic-bezier(.2,.8,.3,1)" }
    ).onfinish = () => p.remove();
  }
}

function useReveal(): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const [ref, vis] = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal ${vis ? "in" : ""} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Hero() {
  const [magnet, setMagnet] = useState({ x: 0, y: 0 });
  const magnetRef = useRef<HTMLSpanElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const h = heroRef.current;
    if (!h) return;

    const onMove = (e: MouseEvent) => {
      const el = magnetRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(x, y);
      if (dist < 90) {
        setMagnet({ x: x * 0.35, y: y * 0.35 });
      } else {
        setMagnet({ x: 0, y: 0 });
      }
    };

    const onLeave = () => setMagnet({ x: 0, y: 0 });

    h.addEventListener("mousemove", onMove);
    h.addEventListener("mouseleave", onLeave);
    return () => {
      h.removeEventListener("mousemove", onMove);
      h.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <section ref={heroRef} className="hero">
      <div className="hero-bg-grid" aria-hidden />
      <div className="hero-bg-glow" aria-hidden />
      <div className="hero-inner">
        <span className="pill">
          <span className="dot" aria-hidden />
          Live signals updated weekly
        </span>
        <h1 className="h1">
          Your next customer
          <br />
          just posted a job.
          <span className="h1-line2">You&apos;re not calling them yet.</span>
        </h1>
        <p className="hero-sub">
          Every week, B2B SaaS companies hire VP Sales, build SDR teams, and bring
          in CROs. That&apos;s when they buy tools. HireSignal finds them
          automatically — scores them, ranks them, and hands you the right contact
          before your competitors notice.
        </p>
        <div className="hero-cta">
          <span
            ref={magnetRef}
            className="magnet"
            style={{
              transform: `translate(${magnet.x}px, ${magnet.y}px)`,
            }}
          >
            <Link
              href="/sign-up"
              className="btn btn-accent btn-lg"
              onClick={() => fireConfetti()}
            >
              Start free trial
              <span className="arrow">→</span>
            </Link>
          </span>
          <a href="#product" className="btn btn-ghost btn-lg">
            See how it works
            <span className="arrow">→</span>
          </a>
        </div>
        <div className="hero-meta">
          14-day free trial · No credit card required · Cancel anytime
        </div>

        <LiveFeed />
      </div>
    </section>
  );
}

const feedItems = [
  { time: "09:04", co: "Ramp", role: "VP of Sales", size: "501-1K", score: 5 },
  { time: "09:11", co: "Clay", role: "Head of GTM", size: "51-200", score: 5 },
  { time: "09:18", co: "Vercel", role: "RevOps Director", size: "201-500", score: 4 },
  { time: "09:22", co: "Notion", role: "CRO", size: "1K+", score: 5 },
  { time: "09:29", co: "Linear", role: "VP Marketing", size: "51-200", score: 4 },
  {
    time: "09:36",
    co: "Retool",
    role: "Sr. Manager, Sales",
    size: "201-500",
    score: 3,
  },
  { time: "09:41", co: "Attio", role: "Head of Sales", size: "11-50", score: 5 },
  {
    time: "09:48",
    co: "Arc",
    role: "VP Sales, Enterprise",
    size: "201-500",
    score: 4,
  },
  {
    time: "09:55",
    co: "Airbyte",
    role: "Director, Sales Ops",
    size: "51-200",
    score: 4,
  },
];

function LiveFeed() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setOffset((o) => o + 1), 2200);
    return () => clearInterval(id);
  }, []);

  const visible = 5;
  const rows: Array<(typeof feedItems)[0] & { key: string }> = [];
  for (let i = 0; i < visible; i++) {
    const item = feedItems[(offset + i) % feedItems.length]!;
    rows.push({ ...item, key: `${offset}-${i}` });
  }

  return (
    <div className="live-feed">
      <div className="live-feed-header">
        <span>Last 60 minutes · 12 new signals</span>
        <span className="status">
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "currentColor",
              display: "inline-block",
            }}
            aria-hidden
          />
          Live
        </span>
      </div>
      <div className="live-feed-body">
        {rows.map((r, i) => (
          <div
            key={r.key}
            className="feed-row"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="feed-time">{r.time}</span>
            <span>
              <span className="feed-co">{r.co}</span>
              <span className="feed-role" style={{ marginLeft: 8 }}>
                hiring {r.role}
              </span>
            </span>
            <span className="feed-size">{r.size}</span>
            <span className="feed-score">
              <span className="score-bar">
                {Array.from({ length: 5 }).map((_, k) => (
                  <i key={k} className={k < r.score ? "on" : ""} />
                ))}
              </span>
              <span className="score-num">{r.score * 20}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Marquee() {
  const names = [
    "Ramp",
    "Clay",
    "Vercel",
    "Notion",
    "Linear",
    "Retool",
    "Attio",
    "Arc",
    "Airbyte",
    "Brex",
    "Intercom",
    "Plaid",
    "Rippling",
    "Gusto",
  ];
  const items = [...names, ...names];
  return (
    <>
      <div className="marquee-label">Signals caught in the last 7 days</div>
      <div className="marquee-wrap">
        <div className="marquee-track">
          {items.map((n, i) => (
            <span key={`${n}-${i}`}>{n}</span>
          ))}
        </div>
      </div>
    </>
  );
}

function SignalCardContent({ animate }: { animate: boolean }) {
  const [score, setScore] = useState(0);
  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1200;
    const target = 100;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      setScore(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  return (
    <div>
      <div className="sc-row">
        <div>
          <span className="sc-co">Brex</span>
          <span className="sc-size">201–500</span>
        </div>
        <span className="sc-intent-pill">● Very high intent</span>
      </div>
      <div className="sc-headline">
        New CRO hired → rebuilding sales stack (30 days)
      </div>
      <div className="sc-fit">
        Best fit: CRM, revenue intelligence, forecasting tools
      </div>
      <div className="sc-meta">
        Hiring 39 sales roles this week — 17 AEs, 1 CRO, 12 SDRs, 4 Sales Enablement
      </div>

      <div className="sc-score-mini">
        <span className="label" style={{ minWidth: 78 }}>
          Intent {score}/100
        </span>
        <span className="meter">
          <span className="meter-fill" style={{ width: `${score}%` }} />
        </span>
      </div>

      <div className="sc-contact">
        <div className="sc-avatar">GM</div>
        <div style={{ flex: 1 }}>
          <div className="sc-name">Garrett Marker</div>
          <div className="sc-role">Chief Revenue Officer</div>
        </div>
        <a href="mailto:garrett@brex.com" className="sc-email">
          garrett@brex.com →
        </a>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg
      className="check"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function EmailShowcase() {
  const [ref, vis] = useReveal();
  return (
    <section className="section soft scroll-mt-24" id="product">
      <div className="section-inner">
        <Reveal>
          <div className="eyebrow">What you get every Monday</div>
        </Reveal>
        <Reveal delay={80}>
          <h2>Monday morning clarity.</h2>
        </Reveal>
        <Reveal delay={160}>
          <p className="section-sub">
            Open your inbox and know exactly who to call this week and why.
          </p>
        </Reveal>

        <div className="email-showcase" ref={ref}>
          <Reveal>
            <div className="email-card-stack">
              <div className="email-card back-2" aria-hidden />
              <div className="email-card back-1" aria-hidden />
              <div className="email-card front">
                <SignalCardContent animate={vis} />
              </div>
            </div>
          </Reveal>

          <div className="email-showcase-text">
            <Reveal delay={120}>
              <h3>Scored. Ranked. Contact attached.</h3>
              <p>
                Each signal is a B2B SaaS company actively hiring a role that
                signals buying intent — with the name, title, and verified email of
                the decision-maker.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <ul className="feature-list">
                <li>
                  <Check /> Intent score so you know where to start
                </li>
                <li>
                  <Check /> Best-fit tool categories for each company
                </li>
                <li>
                  <Check /> Your angle — what to pitch and why now
                </li>
                <li>
                  <Check /> Verified email for the actual budget owner
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function Why() {
  const items = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
      title: "Monday morning clarity",
      body: "Open your inbox and know exactly who to call this week and why. No more spending mornings hunting for prospects.",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      title: "VP-level contacts, verified",
      body: "Every signal includes the name, title, and real email of the person who owns the budget. Not a generic inbox.",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      title: "Walk in prepared",
      body: "We tell you what they're evaluating, why now, and the exact angle to use. Show up to every call knowing more than they expect.",
    },
  ];
  return (
    <section className="section" id="why">
      <div className="section-inner">
        <Reveal>
          <div className="eyebrow">Why HireSignal</div>
        </Reveal>
        <Reveal delay={80}>
          <h2>Three reasons reps keep it open.</h2>
        </Reveal>
        <div className="why-grid" style={{ marginTop: 56 }}>
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 100}>
              <div className="why-item">
                <div className="why-icon">{it.icon}</div>
                <h3>{it.title}</h3>
                <p>{it.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowStep({
  n,
  t,
  b,
  delay,
}: {
  n: string;
  t: string;
  b: string;
  delay: number;
}) {
  const [ref, vis] = useReveal();
  return (
    <div
      ref={ref}
      className={`how-step reveal ${vis ? "in" : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="how-num">{n}</div>
      <h3>{t}</h3>
      <p>{b}</p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "We scan 100+ job boards nightly",
      b: "Every night we check hiring activity across B2B SaaS companies — flagging VP Sales hires, SDR buildouts, RevOps additions, and CRO appointments.",
    },
    {
      n: "02",
      t: "Signals are scored and ranked",
      b: "Companies are ranked by intent level, size, and signal strength. The most winnable targets rise to the top — enterprise noise sinks.",
    },
    {
      n: "03",
      t: "You get the list Monday morning",
      b: "A clean digest lands in your inbox with contacts attached. Log in anytime to see the full feed, filter by signal type, and export to CSV.",
    },
  ];
  return (
    <section className="section soft" id="how">
      <div className="section-inner">
        <Reveal>
          <h2 style={{ marginTop: 0 }}>Set it and forget it.</h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="section-sub">
            HireSignal runs in the background so you don&apos;t have to.
          </p>
        </Reveal>
        <div className="how-grid">
          {steps.map((s, i) => (
            <HowStep key={s.n} {...s} delay={i * 120} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section className="section" id="pricing">
      <div className="section-inner">
        <Reveal>
          <div className="eyebrow">Pricing</div>
        </Reveal>
        <Reveal delay={80}>
          <h2>One plan. Every signal.</h2>
        </Reveal>
        <Reveal delay={160}>
          <p className="section-sub">
            Cancel anytime. No contracts. No per-seat gotchas.
          </p>
        </Reveal>

        <Reveal delay={200}>
          <div className="pricing-wrap">
            <div className="pricing-card">
              <div className="pricing-eyebrow">HireSignal Pro</div>
              <div className="price-row">
                <span className="price">$199</span>
                <span className="price-per">/month</span>
              </div>
              <div className="pricing-hint">Start free for 14 days</div>
              <ul className="pricing-list">
                <li>
                  <Check /> 25+ buying signals every week
                </li>
                <li>
                  <Check /> Verified VP Sales and CRO contacts
                </li>
                <li>
                  <Check /> Monday morning email digest
                </li>
                <li>
                  <Check /> Winnable now filter
                </li>
                <li>
                  <Check /> CSV export for your CRM
                </li>
                <li>
                  <Check /> Cancel anytime
                </li>
              </ul>
              <Link href="/sign-up" className="btn btn-primary btn-lg">
                Start your free trial
                <span className="arrow">→</span>
              </Link>
              <div className="pricing-fine">No credit card required</div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="final-cta">
      <Reveal>
        <h2>Your next customer is hiring right now.</h2>
      </Reveal>
      <Reveal delay={80}>
        <p>Find out who — before your competitors do.</p>
      </Reveal>
      <Reveal delay={160}>
        <Link
          href="/sign-up"
          className="btn btn-accent btn-lg"
          onClick={() => fireConfetti()}
        >
          Start free trial <span className="arrow">→</span>
        </Link>
      </Reveal>
    </section>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav className={`nav ${scrolled ? "scrolled" : ""}`}>
      <div className="nav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Image
              src="/logo.png"
              alt=""
              width={1536}
              height={1024}
              sizes="84px"
              className="brand-logo-img"
              quality={95}
              priority
            />
          </span>
          HireSignal
        </Link>
        <div className="nav-actions">
          <Link href="/sign-in" className="btn btn-ghost">
            Log in
          </Link>
          <Link href="/sign-up" className="btn btn-primary">
            Start free trial
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>© 2026 HireSignal · Made for B2B SaaS operators</div>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  useSmoothScroll();

  return (
    <div className="landing-root">
      <Nav />
      <Hero />
      <Marquee />
      <EmailShowcase />
      <Why />
      <HowItWorks />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
