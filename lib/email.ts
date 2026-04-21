import { Resend } from "resend";
import { bestAngleForSignalType, confidenceLabel } from "@/lib/dashboard-utils";
import type { Company, Contact, Signal } from "@/types";

export type WeeklyDigestSignal = {
  signal: Signal;
  company: Company;
  contact: Contact | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function contactLabel(contact: Contact | null): string {
  if (!contact) return "No sales contact found";
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  const parts = [
    name || "Unnamed contact",
    contact.title?.trim() || "No title",
    contact.email?.trim() || "No email",
  ];
  return parts.join(" · ");
}

function normalizeAppUrl(appUrl: string): string {
  return appUrl.replace(/\/$/, "");
}

function fromEmail(): string {
  const base = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
  if (base.includes("<")) return base;
  return `HireSignal <${base}>`;
}

function splitWhyItMatters(value: string | null | undefined): {
  headline: string;
  bestFit: string | null;
} {
  const lines = (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    headline: lines[0] ?? "Hiring activity worth reviewing this week.",
    bestFit: lines[1] ?? null,
  };
}

function confidenceBadgeStyles(level: Signal["confidence_level"]): string {
  switch (level) {
    case "very_high":
      return "display:inline-block;background:#FFF1F2;color:#BE123C;border:1px solid #FECDD3;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:600;white-space:nowrap;";
    case "high":
      return "display:inline-block;background:#FFFBEB;color:#B45309;border:1px solid #FDE68A;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:600;white-space:nowrap;";
    case "medium":
    default:
      return "display:inline-block;background:#FAFAFA;color:#6B7280;border:1px solid #E5E7EB;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:600;white-space:nowrap;";
  }
}

function renderSignalCard(row: WeeklyDigestSignal): string {
  const { signal, company, contact } = row;
  const score = signal.score ?? 0;
  const size = company.size_range?.trim() || "Unknown size";
  const why = signal.why_it_matters?.trim() || "Growing sales team → evaluating sales tooling (60 days)\nBest fit: CRM, sales engagement tools";
  const angle = bestAngleForSignalType(signal.signal_type);
  const confidence = confidenceLabel(signal.confidence_level);
  const { headline, bestFit } = splitWhyItMatters(why);

  return `
    <div style="border:1px solid #e5e5e5;border-radius:14px;padding:20px;background:#ffffff;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div>
          <div style="font-size:18px;line-height:1.35;font-weight:600;color:#171717;">
            ${escapeHtml(company.name)}
          </div>
          <div style="margin-top:8px;">
            <span style="display:inline-block;background:#f5f5f5;color:#525252;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600;">
              ${escapeHtml(size)}
            </span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          <span style="display:inline-block;color:#0F6E56;font-size:12px;line-height:1.35;font-weight:700;padding-top:2px;white-space:nowrap;">
            Score: ${score}
          </span>
          <span style="${confidenceBadgeStyles(signal.confidence_level)}">
            ${escapeHtml(confidence)}
          </span>
        </div>
      </div>
      <div style="margin-top:14px;font-size:15px;line-height:1.6;color:#171717;font-weight:600;">
        ${escapeHtml(headline)}
      </div>
      ${bestFit ? `<div style="margin-top:6px;font-size:14px;line-height:1.6;color:#0F766E;font-weight:700;">${escapeHtml(bestFit)}</div>` : ""}
      <div style="margin-top:12px;font-size:13px;line-height:1.6;color:#525252;">
        <strong style="color:#171717;">Contact:</strong> ${escapeHtml(contactLabel(contact))}
      </div>
      <div style="margin-top:8px;font-size:13px;line-height:1.6;color:#525252;">
        <strong style="color:#171717;">Best angle:</strong> ${escapeHtml(angle)}
      </div>
    </div>
  `;
}

function renderHtml(signals: WeeklyDigestSignal[], appUrl: string): string {
  const top = signals[0];
  const cards = signals.slice(0, 10).map(renderSignalCard).join("");

  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#fafafa;font-family:Inter,Arial,sans-serif;color:#171717;">
        <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
          <div style="border:1px solid #e5e5e5;border-radius:20px;background:#ffffff;overflow:hidden;">
            <div style="padding:28px 28px 20px;border-bottom:1px solid #f0f0f0;background:#fcfcfc;">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#737373;font-weight:700;">
                HireSignal Weekly Digest
              </div>
              <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;color:#171717;">
                ${signals.length} hiring signals this week
              </h1>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#525252;">
                ${top ? `${escapeHtml(top.company.name)} is moving fast, and there are ${signals.length - 1} more buying signals worth acting on.` : "Fresh buying signals from sales-hiring activity are ready to review."}
              </p>
              <div style="margin-top:20px;">
                <a href="${appUrl}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;border-radius:12px;padding:12px 18px;font-size:14px;font-weight:600;">
                  See all signals →
                </a>
              </div>
            </div>
            <div style="padding:24px 28px;">
              ${cards}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function renderText(signals: WeeklyDigestSignal[], appUrl: string): string {
  const lines = signals.slice(0, 10).map((row, idx) => {
    const score = row.signal.score ?? 0;
    const why = row.signal.why_it_matters?.trim() || "Growing sales team → evaluating sales tooling (60 days)\nBest fit: CRM, sales engagement tools";
    const { headline, bestFit } = splitWhyItMatters(why);
    return [
      `${idx + 1}. ${row.company.name} (${row.company.size_range ?? "Unknown size"})`,
      `   Score: ${score}`,
      `   Confidence: ${confidenceLabel(row.signal.confidence_level)}`,
      `   Why it matters: ${headline}`,
      ...(bestFit ? [`   ${bestFit}`] : []),
      `   Contact: ${contactLabel(row.contact)}`,
      `   Best angle: ${bestAngleForSignalType(row.signal.signal_type)}`,
    ].join("\n");
  });

  return [
    `HireSignal Weekly Digest`,
    ``,
    `${signals.length} hiring signals this week`,
    ``,
    ...lines,
    ``,
    `See all signals: ${appUrl}`,
  ].join("\n");
}

export async function sendWeeklyDigest(
  subscriberEmail: string,
  signals: WeeklyDigestSignal[],
  appUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const resend = new Resend(apiKey);
  const topCompany = signals[0]?.company.name ?? "a top company";
  const subject = `${signals.length} hiring signals this week — ${topCompany} is building fast`;
  const resolvedAppUrl = normalizeAppUrl(appUrl);

  const { error } = await resend.emails.send({
    from: fromEmail(),
    to: subscriberEmail,
    subject,
    html: renderHtml(signals, resolvedAppUrl),
    text: renderText(signals, resolvedAppUrl),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendPaymentFailedEmail(
  subscriberEmail: string,
  appUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const base = normalizeAppUrl(appUrl);
  const resend = new Resend(apiKey);
  const subject = "Action needed: your HireSignal payment didn’t go through";

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:24px;font-family:system-ui,sans-serif;background:#fafafa;color:#171717;">
        <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:28px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">We couldn’t process your last subscription payment. Your account is marked <strong>past due</strong> until billing succeeds.</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#525252;">Update your payment method in the billing portal to keep access to signals and digests.</p>
          <a href="${escapeHtml(base)}/api/stripe/portal" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px;font-size:14px;font-weight:600;">Manage billing →</a>
        </div>
      </body>
    </html>
  `;

  const text = [
    "We couldn’t process your last HireSignal subscription payment.",
    "Your plan is past due until payment succeeds.",
    "",
    `Manage billing: ${base}/api/stripe/portal`,
  ].join("\n");

  const { error } = await resend.emails.send({
    from: fromEmail(),
    to: subscriberEmail,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendTrialEndingReminder(
  subscriberEmail: string,
  daysRemaining: number,
  appUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const base = normalizeAppUrl(appUrl);
  const resend = new Resend(apiKey);
  const d = Math.max(1, Math.ceil(daysRemaining));
  const subject = `Your HireSignal trial ends in ${d} day${d === 1 ? "" : "s"}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:24px;font-family:system-ui,sans-serif;background:#fafafa;color:#171717;">
        <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:28px;">
          <p style="margin:0 0 12px;font-size:16px;font-weight:600;">Your trial is ending soon</p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#404040;">In about <strong>${d} day${d === 1 ? "" : "s"}</strong>, you’ll lose access to weekly hiring signals, verified VP-level contacts, and the Monday digest.</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#525252;">Subscribe to keep full access and stay ahead of your competitors.</p>
          <a href="${escapeHtml(base)}/upgrade" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px;font-size:14px;font-weight:600;">Subscribe now →</a>
          <p style="margin:20px 0 0;font-size:12px;color:#737373;">Already subscribed? You can ignore this email.</p>
        </div>
      </body>
    </html>
  `;

  const text = [
    `Your HireSignal trial ends in about ${d} day${d === 1 ? "" : "s"}.`,
    "",
    "Without an active plan you’ll lose:",
    "- Weekly buying signals",
    "- Verified contacts",
    "- Monday email digest",
    "",
    `Subscribe: ${base}/upgrade`,
    "",
    "(If you already subscribed, ignore this message.)",
  ].join("\n");

  const { error } = await resend.emails.send({
    from: fromEmail(),
    to: subscriberEmail,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(error.message);
  }
}
