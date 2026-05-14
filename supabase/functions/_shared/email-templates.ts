// Shared HTML email templates for Artisaneo (Resend)

const BRAND = {
  name: "Artisaneo",
  url: "https://artisaneo.lovable.app",
  primary: "#8b5e3c",
  bg: "#faf7f2",
  text: "#2d2418",
  muted: "#6b6258",
  card: "#ffffff",
  border: "#ece4d8",
};

const formatGBP = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format((pence || 0) / 100);

const layout = (title: string, inner: string, ctaLabel?: string, ctaUrl?: string) => `
<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding:0 8px 24px;">
          <a href="${BRAND.url}" style="text-decoration:none;color:${BRAND.primary};font-size:22px;font-weight:700;letter-spacing:-0.02em;">${BRAND.name}</a>
        </td></tr>
        <tr><td style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:14px;padding:32px;">
          ${inner}
          ${ctaUrl && ctaLabel ? `
            <div style="margin-top:28px;">
              <a href="${ctaUrl}" style="display:inline-block;background:${BRAND.primary};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">${ctaLabel}</a>
            </div>` : ""}
        </td></tr>
        <tr><td style="padding:24px 8px;color:${BRAND.muted};font-size:12px;line-height:1.6;">
          You're receiving this because you have an account on ${BRAND.name}.<br/>
          <a href="${BRAND.url}" style="color:${BRAND.muted};">${BRAND.url}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const h1 = (t: string) => `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${BRAND.text};">${t}</h1>`;
const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.text};">${t}</p>`;
const meta = (rows: [string, string][]) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid ${BRAND.border};border-radius:10px;overflow:hidden;">
    ${rows.map(([k, v]) => `
      <tr>
        <td style="padding:10px 14px;background:${BRAND.bg};color:${BRAND.muted};font-size:13px;width:40%;">${k}</td>
        <td style="padding:10px 14px;font-size:14px;color:${BRAND.text};font-weight:500;">${v}</td>
      </tr>`).join("")}
  </table>`;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export type TemplateName =
  | "booking_confirmed_buyer"
  | "booking_confirmed_seller"
  | "booking_reminder"
  | "booking_cancelled_buyer"
  | "booking_cancelled_seller"
  | "new_message"
  | "payout_processed";

type Rendered = { subject: string; html: string };

export function renderTemplate(name: TemplateName, data: Record<string, any>): Rendered {
  switch (name) {
    case "booking_confirmed_buyer": {
      const subject = `Booking confirmed with ${data.sellerName}`;
      const html = layout(subject,
        h1("Your booking is confirmed 🎉") +
        p(`Hi ${esc(data.buyerName || "there")}, your booking with <strong>${esc(data.sellerName)}</strong> is confirmed.`) +
        meta([
          ["Service", esc(data.serviceType)],
          ["Date", esc(data.date)],
          ["Time", esc(data.time)],
          ["Reference", esc(data.reference || "—")],
          ["Total", formatGBP(Number(data.pricePence) || 0)],
        ]),
        "View booking", `${BRAND.url}/dashboard/buyer`);
      return { subject, html };
    }
    case "booking_confirmed_seller": {
      const subject = `New confirmed booking from ${data.buyerName}`;
      const html = layout(subject,
        h1("You have a new booking") +
        p(`Hi ${esc(data.sellerName || "there")}, <strong>${esc(data.buyerName)}</strong> just booked you and paid in full.`) +
        meta([
          ["Service", esc(data.serviceType)],
          ["Date", esc(data.date)],
          ["Time", esc(data.time)],
          ["Reference", esc(data.reference || "—")],
          ["You'll receive", formatGBP((Number(data.pricePence) || 0) - (Number(data.feePence) || 0))],
        ]),
        "Open dashboard", `${BRAND.url}/dashboard/seller`);
      return { subject, html };
    }
    case "booking_reminder": {
      const subject = `Reminder: ${data.serviceType} tomorrow at ${data.time}`;
      const html = layout(subject,
        h1("Your booking is tomorrow") +
        p(`Hi ${esc(data.recipientName || "there")}, this is a friendly reminder of your upcoming booking.`) +
        meta([
          ["With", esc(data.counterpartyName)],
          ["Service", esc(data.serviceType)],
          ["Date", esc(data.date)],
          ["Time", esc(data.time)],
          ["Reference", esc(data.reference || "—")],
        ]),
        "View details", `${BRAND.url}${data.dashboardPath || "/dashboard/buyer"}`);
      return { subject, html };
    }
    case "booking_cancelled_buyer": {
      const subject = `Booking cancelled — ${data.reference || data.serviceType}`;
      const html = layout(subject,
        h1("Your booking has been cancelled") +
        p(`Hi ${esc(data.buyerName || "there")}, your booking with <strong>${esc(data.sellerName)}</strong> has been cancelled.`) +
        meta([
          ["Service", esc(data.serviceType)],
          ["Date", esc(data.date)],
          ["Time", esc(data.time)],
          ["Reference", esc(data.reference || "—")],
          ...(data.reason ? [["Reason", esc(data.reason)] as [string, string]] : []),
        ]) +
        p("If a payment was made, any refund will appear within 5–10 business days."),
        "Browse artisans", `${BRAND.url}/browse`);
      return { subject, html };
    }
    case "booking_cancelled_seller": {
      const subject = `Booking cancelled — ${data.reference || data.serviceType}`;
      const html = layout(subject,
        h1("A booking was cancelled") +
        p(`Hi ${esc(data.sellerName || "there")}, the booking with <strong>${esc(data.buyerName)}</strong> has been cancelled.`) +
        meta([
          ["Service", esc(data.serviceType)],
          ["Date", esc(data.date)],
          ["Time", esc(data.time)],
          ["Reference", esc(data.reference || "—")],
          ...(data.reason ? [["Reason", esc(data.reason)] as [string, string]] : []),
        ]),
        "Open dashboard", `${BRAND.url}/dashboard/seller`);
      return { subject, html };
    }
    case "new_message": {
      const subject = `New message from ${data.senderName}`;
      const preview = String(data.preview || "").slice(0, 240);
      const html = layout(subject,
        h1(`${esc(data.senderName)} sent you a message`) +
        p(`Hi ${esc(data.recipientName || "there")}, you have an unread message on ${BRAND.name}.`) +
        `<blockquote style="margin:18px 0;padding:14px 16px;border-left:3px solid ${BRAND.primary};background:${BRAND.bg};color:${BRAND.text};font-size:14px;line-height:1.6;border-radius:0 8px 8px 0;">${esc(preview)}</blockquote>`,
        "Open inbox", `${BRAND.url}/messages`);
      return { subject, html };
    }
    case "payout_processed": {
      const subject = `Payout sent: ${formatGBP(Number(data.amountPence) || 0)}`;
      const html = layout(subject,
        h1("Your payout is on its way 💸") +
        p(`Hi ${esc(data.sellerName || "there")}, we've released a payout to your connected Stripe account.`) +
        meta([
          ["Amount", formatGBP(Number(data.amountPence) || 0)],
          ["Booking", esc(data.reference || "—")],
          ["Service", esc(data.serviceType || "—")],
        ]) +
        p("Funds typically arrive within 1–2 business days, depending on your bank."),
        "View earnings", `${BRAND.url}/dashboard/seller`);
      return { subject, html };
    }
  }
}
