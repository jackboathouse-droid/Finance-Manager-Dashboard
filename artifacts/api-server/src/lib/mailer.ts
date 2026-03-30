import * as nodemailer from "nodemailer";
import type { Logger } from "pino";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// ── Transporter (lazy singleton) ──────────────────────────────────────────────

let _transporter: nodemailer.Transporter | null | undefined = undefined;

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter !== undefined) return _transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    _transporter = null;
    return null;
  }
  _transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
  return _transporter;
}

export function getFromAddress(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@bubble.app";
}

// ── sendMail helper ───────────────────────────────────────────────────────────

export async function sendMail(
  opts: MailOptions,
  logger?: Pick<Logger, "warn" | "error" | "info">
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    logger?.warn("SMTP not configured — email skipped");
    return false;
  }
  try {
    await transporter.sendMail({
      from: `"Bubble Finance" <${getFromAddress()}>`,
      ...opts,
    });
    logger?.info({ to: opts.to }, "Email sent");
    return true;
  } catch (err) {
    logger?.error({ err, to: opts.to }, "Failed to send email");
    return false;
  }
}

// ── Base HTML layout ──────────────────────────────────────────────────────────

export function baseLayout(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bubble Finance</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#4FC3F7;padding:24px 32px;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Bubble</span>
              <span style="font-size:13px;color:rgba(255,255,255,0.8);margin-left:8px;">Personal Finance</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                You're receiving this email because you have a Bubble Finance account.<br />
                Manage your email preferences in <a href="${process.env.FRONTEND_URL || ""}/settings" style="color:#4FC3F7;text-decoration:none;">Settings</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin:24px 0 8px;padding:12px 28px;background:#4FC3F7;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${label}</a>`;
}

// ── Email builders ────────────────────────────────────────────────────────────

export function buildWelcomeEmail(name: string, appUrl: string): Pick<MailOptions, "subject" | "html" | "text"> {
  const firstName = name.split(" ")[0];
  const html = baseLayout(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Welcome to Bubble, ${firstName}!</h2>
    <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
      Your account is ready. Bubble helps you track spending, manage budgets, and grow your net worth — all in one place.
    </p>
    <p style="color:#475569;line-height:1.6;margin:0 0 4px;">Here's what you can do right away:</p>
    <ul style="color:#475569;line-height:1.8;padding-left:20px;margin:0 0 16px;">
      <li>Add your bank accounts and track balances</li>
      <li>Log transactions and categorise spending</li>
      <li>Set monthly budgets and watch progress in real time</li>
      <li>View AI-powered financial insights</li>
    </ul>
    ${ctaButton(appUrl, "Open Bubble →")}
    <p style="color:#94a3b8;font-size:13px;margin:16px 0 0;">
      If you didn't create this account, you can safely ignore this email.
    </p>
  `);
  const text = `Welcome to Bubble, ${firstName}!\n\nYour account is ready. Open the app here: ${appUrl}\n\nBubble helps you track spending, manage budgets, and grow your net worth.`;
  return { subject: "Welcome to Bubble Finance!", html, text };
}

export interface BudgetAlertRow {
  category: string;
  budget: number;
  actual: number;
  pct: number;
}

export function buildBudgetAlertEmail(
  name: string,
  month: string,
  alerts: BudgetAlertRow[],
  appUrl: string
): Pick<MailOptions, "subject" | "html" | "text"> {
  const firstName = name.split(" ")[0];
  const rows = alerts
    .map(
      (a) => `
      <tr>
        <td style="padding:8px 0;color:#334155;border-bottom:1px solid #f1f5f9;">${a.category}</td>
        <td style="padding:8px 0;text-align:right;color:#334155;border-bottom:1px solid #f1f5f9;">$${a.actual.toFixed(2)}</td>
        <td style="padding:8px 0;text-align:right;color:#334155;border-bottom:1px solid #f1f5f9;">$${a.budget.toFixed(2)}</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;color:${a.pct >= 100 ? "#EF4444" : "#F59E0B"};">${a.pct.toFixed(0)}%</td>
      </tr>`
    )
    .join("");

  const html = baseLayout(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Budget Alert for ${month}</h2>
    <p style="color:#475569;line-height:1.6;margin:0 0 20px;">
      Hi ${firstName}, one or more of your budgets is approaching or over the limit this month.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:8px 0;text-align:left;color:#64748b;font-weight:600;">Category</th>
          <th style="padding:8px 0;text-align:right;color:#64748b;font-weight:600;">Spent</th>
          <th style="padding:8px 0;text-align:right;color:#64748b;font-weight:600;">Budget</th>
          <th style="padding:8px 0;text-align:right;color:#64748b;font-weight:600;">Used</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${ctaButton(appUrl, "Review budgets →")}
  `);
  const textLines = alerts.map((a) => `• ${a.category}: $${a.actual.toFixed(2)} of $${a.budget.toFixed(2)} (${a.pct.toFixed(0)}%)`).join("\n");
  const text = `Budget Alert for ${month}\n\nHi ${firstName},\n\nThe following categories have exceeded 90% of their budget:\n\n${textLines}\n\nOpen the app: ${appUrl}`;
  return { subject: `Budget alert — ${month}`, html, text };
}

export interface WeeklyDigestData {
  weekLabel: string;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  topCategory: string | null;
  topCategoryAmount: number;
}

export function buildPasswordResetEmail(
  name: string,
  resetUrl: string,
  ttlMinutes: number
): Pick<MailOptions, "subject" | "html" | "text"> {
  const firstName = name.split(" ")[0];
  const html = baseLayout(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Reset your password</h2>
    <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
      Hi ${firstName}, we received a request to reset the password for your Bubble account.
      Click the button below to choose a new password. This link expires in <strong>${ttlMinutes} minutes</strong>.
    </p>
    ${ctaButton(resetUrl, "Reset password")}
    <p style="color:#94a3b8;font-size:13px;margin:16px 0 0;">
      If you didn't request this, you can safely ignore this email — your password won't change.
    </p>
  `);
  const text = `Reset your Bubble password\n\nHi ${firstName},\n\nClick the link below to reset your password (expires in ${ttlMinutes} min):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`;
  return { subject: "Reset your Bubble password", html, text };
}

export function buildWeeklyDigestEmail(
  name: string,
  data: WeeklyDigestData,
  appUrl: string
): Pick<MailOptions, "subject" | "html" | "text"> {
  const firstName = name.split(" ")[0];
  const netColor = data.netCashFlow >= 0 ? "#10B981" : "#EF4444";
  const netSign = data.netCashFlow >= 0 ? "+" : "";

  const html = baseLayout(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Weekly Summary</h2>
    <p style="color:#475569;line-height:1.6;margin:0 0 20px;">Hi ${firstName}, here's your spending digest for <strong>${data.weekLabel}</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;margin-bottom:8px;">
      <tr>
        <td style="padding:10px 0;color:#475569;border-bottom:1px solid #f1f5f9;">Total income</td>
        <td style="padding:10px 0;text-align:right;color:#10B981;font-weight:600;border-bottom:1px solid #f1f5f9;">+$${data.totalIncome.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#475569;border-bottom:1px solid #f1f5f9;">Total expenses</td>
        <td style="padding:10px 0;text-align:right;color:#EF4444;font-weight:600;border-bottom:1px solid #f1f5f9;">-$${data.totalExpenses.toFixed(2)}</td>
      </tr>
      ${data.topCategory ? `<tr>
        <td style="padding:10px 0;color:#475569;border-bottom:1px solid #f1f5f9;">Top category</td>
        <td style="padding:10px 0;text-align:right;color:#334155;font-weight:600;border-bottom:1px solid #f1f5f9;">${data.topCategory} ($${data.topCategoryAmount.toFixed(2)})</td>
      </tr>` : ""}
      <tr>
        <td style="padding:12px 0;color:#0f172a;font-weight:600;">Net cash flow</td>
        <td style="padding:12px 0;text-align:right;font-weight:700;color:${netColor};">${netSign}$${Math.abs(data.netCashFlow).toFixed(2)}</td>
      </tr>
    </table>
    ${ctaButton(appUrl, "View full details →")}
  `);
  const text = `Weekly Summary — ${data.weekLabel}\n\nHi ${firstName},\n\nIncome: $${data.totalIncome.toFixed(2)}\nExpenses: $${data.totalExpenses.toFixed(2)}\nNet: ${netSign}$${Math.abs(data.netCashFlow).toFixed(2)}\n${data.topCategory ? `Top category: ${data.topCategory} ($${data.topCategoryAmount.toFixed(2)})\n` : ""}\nOpen the app: ${appUrl}`;
  return { subject: `Your weekly summary — ${data.weekLabel}`, html, text };
}
