"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

const SUPPORT_EMAIL = "support@hiresignal.com";

const page: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#fafafa",
  padding: "48px 16px",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const card: React.CSSProperties = {
  maxWidth: "32rem",
  margin: "0 auto",
  borderRadius: "16px",
  border: "1px solid #e5e5e5",
  backgroundColor: "#ffffff",
  padding: "40px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const h1: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 600,
  letterSpacing: "-0.02em",
  color: "#171717",
  margin: 0,
  lineHeight: 1.25,
};

const sub: React.CSSProperties = {
  marginTop: "12px",
  fontSize: "1rem",
  color: "#525252",
  lineHeight: 1.5,
};

const list: React.CSSProperties = {
  marginTop: "32px",
  padding: 0,
  listStyle: "none",
};

const li: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  fontSize: "0.875rem",
  color: "#404040",
  marginBottom: "12px",
  lineHeight: 1.45,
};

const bullet: React.CSSProperties = {
  color: "#059669",
  flexShrink: 0,
};

const price: React.CSSProperties = {
  marginTop: "32px",
  fontSize: "1.125rem",
  fontWeight: 600,
  color: "#171717",
};

const priceSuffix: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#737373",
};

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  width: "100%",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "8px",
  backgroundColor: "#171717",
  color: "#ffffff",
  fontSize: "0.875rem",
  fontWeight: 600,
  padding: "12px 16px",
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
  marginTop: "24px",
  boxSizing: "border-box",
};

const footer: React.CSSProperties = {
  marginTop: "32px",
  textAlign: "center",
  fontSize: "0.875rem",
  color: "#737373",
};

const link: React.CSSProperties = {
  fontWeight: 500,
  color: "#047857",
  textDecoration: "none",
};

export default function UpgradePage() {
  return (
    <div style={page}>
      <div style={card}>
        <h1 style={h1}>Your free trial has ended</h1>
        <p style={sub}>Get full access to HireSignal Pro</p>

        <ul style={list}>
          <li style={li}>
            <span style={bullet} aria-hidden>
              •
            </span>
            <span>25+ high-intent companies every week</span>
          </li>
          <li style={li}>
            <span style={bullet} aria-hidden>
              •
            </span>
            <span>Verified VP Sales and CRO contacts</span>
          </li>
          <li style={{ ...li, marginBottom: 0 }}>
            <span style={bullet} aria-hidden>
              •
            </span>
            <span>Monday morning email digest</span>
          </li>
        </ul>

        <p style={price}>
          $99<span style={priceSuffix}>/month</span>
        </p>

        <SignedIn>
          <form method="get" action="/api/stripe/checkout">
            <button type="submit" style={btnBase}>
              Start subscription
            </button>
          </form>
        </SignedIn>
        <SignedOut>
          <Link href="/sign-in" style={btnBase}>
            Sign in to subscribe
          </Link>
        </SignedOut>

        <p style={footer}>
          <a href={`mailto:${SUPPORT_EMAIL}`} style={link}>
            Questions? Email us
          </a>
        </p>
      </div>
    </div>
  );
}
