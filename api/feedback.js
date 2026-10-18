/* ==========================================================================
 * X++ website — /api/feedback  (Vercel serverless function, Node runtime)
 * --------------------------------------------------------------------------
 * Receives the feedback form POST and delivers it straight to the owner's
 * inbox (aagastyaverma6@gmail.com by default — override with CONTACT_EMAIL).
 *
 * Two delivery providers are supported; whichever one has env vars set wins:
 *
 *   1) RESEND_API_KEY          → sent with Resend's REST API (recommended,
 *                                zero dependencies, free tier 100 mails/day)
 *                                optional: FEEDBACK_FROM_EMAIL
 *                                          (default onboarding@resend.dev)
 *
 *   2) GMAIL_USER +            → sent with Gmail SMTP through nodemailer
 *      GMAIL_APP_PASSWORD        (needs a Google "App Password",
 *                                see README.md)
 *
 * Set the env vars in Vercel: Project → Settings → Environment Variables.
 * ========================================================================== */

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'aagastyaverma6@gmail.com';
const SITE_NAME = 'X++ (XPlusPlus)';
const MAX_MESSAGE = 3000;

/* best-effort in-memory rate limit (per warm instance) */
const hits = new Map();
const WINDOW_MS = 10 * 60 * 1000;      // 10 minutes
const MAX_PER_WINDOW = 5;

function rateLimited(ip) {
  const now = Date.now();
  const key = ip || 'unknown';
  const rec = hits.get(key);
  if (!rec || now - rec.start > WINDOW_MS) {
    hits.set(key, { start: now, n: 1 });
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_PER_WINDOW;
}

function clean(str, max) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
}

function json(res, code, body) {
  return res.status(code).json(body);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildEmail({ name, email, type, message, meta }) {
  const subject = `[X++ website] ${type || 'feedback'} — ${name || 'anonymous'}`;
  const text =
    `New feedback from the ${SITE_NAME} website\n` +
    `--------------------------------------------------\n` +
    `Type:     ${type || 'feedback'}\n` +
    `Name:     ${name || '(not given)'}\n` +
    `Email:    ${email || '(not given)'}\n` +
    `Sent:     ${new Date().toISOString()}\n` +
    `--------------------------------------------------\n\n` +
    `${message}\n`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#0b0a14;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#15122a;border:1px solid rgba(139,124,255,.35);border-radius:16px;overflow:hidden;">
    <tr><td style="padding:22px 26px;background:linear-gradient(135deg,#8b7cff,#6366f1);">
      <div style="color:#fff;font-size:17px;font-weight:700;letter-spacing:.01em;">X++ feedback <span style="opacity:.75;font-weight:500;">· ${esc(type || 'feedback')}</span></div>
      <div style="color:rgba(255,255,255,.8);font-size:12.5px;margin-top:3px;">from the XPlusPlus website</div>
    </td></tr>
    <tr><td style="padding:24px 26px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13.5px;color:#d9d6ec;">
        <tr><td style="padding:4px 0;color:#8f8ab5;width:78px;">Name</td><td style="padding:4px 0;">${esc(name) || '<span style="color:#6f6a92">(not given)</span>'}</td></tr>
        <tr><td style="padding:4px 0;color:#8f8ab5;">Email</td><td style="padding:4px 0;">${email ? `<a href="mailto:${esc(email)}" style="color:#b7abff;">${esc(email)}</a>` : '<span style="color:#6f6a92">(not given)</span>'}</td></tr>
        <tr><td style="padding:4px 0;color:#8f8ab5;">Sent</td><td style="padding:4px 0;">${esc(new Date().toISOString())}</td></tr>
      </table>
      <div style="margin:18px 0 0;padding:16px 18px;background:#0d0b18;border:1px solid rgba(255,255,255,.08);border-radius:12px;font-size:14px;line-height:1.65;color:#eceaf6;white-space:pre-wrap;">${esc(message)}</div>
      ${meta ? `<div style="margin-top:14px;font-size:11.5px;color:#6f6a92;">${esc(meta)}</div>` : ''}
    </td></tr>
    <tr><td style="padding:14px 26px;border-top:1px solid rgba(255,255,255,.08);color:#6f6a92;font-size:11.5px;">
      Delivered by the X++ website feedback form · GPL-3.0 · Atom Software
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

/* ------------------------------------------------------------- providers */

async function sendWithResend({ subject, text, html }, fromName) {
  const from = process.env.FEEDBACK_FROM_EMAIL || 'onboarding@resend.dev';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromName ? `${fromName} <${from}>` : from,
      to: [CONTACT_EMAIL],
      reply_to: undefined,
      subject,
      text,
      html,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && data.message) || `Resend responded ${r.status}`);
  return 'resend';
}

async function sendWithGmail({ subject, text, html }, replyTo) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  await transporter.sendMail({
    from: `${process.env.GMAIL_USER}`,
    to: CONTACT_EMAIL,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
  });
  return 'gmail';
}

/* -------------------------------------------------------------- handler */

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const configured = Boolean(
      process.env.RESEND_API_KEY ||
      (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
    );
    return json(res, 200, {
      ok: true,
      endpoint: 'feedback',
      configured,
      contact: CONTACT_EMAIL,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const ip =
    (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) ||
    (req.socket && req.socket.remoteAddress) || '';
  if (rateLimited(String(ip).split(',')[0].trim())) {
    return json(res, 429, { error: 'Too many messages from your network — please try again later.' });
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  /* honeypot — pretend success for bots */
  if (clean(body.company, 200)) {
    return json(res, 200, { sent: true, via: 'honeypot' });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const type = clean(body.type, 60) || 'feedback';
  const message = clean(body.message, MAX_MESSAGE + 100);

  if (!message) return json(res, 400, { error: 'Message is required' });
  if (message.length > MAX_MESSAGE) return json(res, 400, { error: 'Message too long' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: 'Invalid email address' });
  }

  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasGmail = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  if (!hasResend && !hasGmail) {
    return json(res, 503, {
      sent: false,
      fallback: 'mailto',
      error: 'Email delivery is not configured on this deployment. ' +
        'The site owner needs to set RESEND_API_KEY (or GMAIL_USER + GMAIL_APP_PASSWORD) in Vercel.',
    });
  }

  const mail = buildEmail({ name, email, type, message, meta: `client: ${String(ip).split(',')[0] || 'unknown'}` });

  try {
    const via = hasResend
      ? await sendWithResend(mail, `X++ Website`)
      : await sendWithGmail(mail, email || undefined);
    return json(res, 200, { sent: true, via });
  } catch (err) {
    console.error('feedback send failed:', err && err.message);
    return json(res, 502, {
      sent: false,
      fallback: 'mailto',
      error: 'Email provider error — please try again later or email directly.',
    });
  }
};
