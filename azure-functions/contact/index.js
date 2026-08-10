'use strict';

const CONTACT_RECIPIENT =
  process.env.CONTACT_RECIPIENT || 'info@unistarchemical.com';
const CONTACT_SENDER = process.env.CONTACT_SENDER || CONTACT_RECIPIENT;

const ALLOWED_INQUIRIES = new Set([
  'Quote Request',
  'SDS Request',
  'TDS Request',
  'Technical Guidance',
  'Sample Request',
  'General Inquiry'
]);

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const requestHistory = new Map();

function jsonResponse(status, body) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function parsePayload(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const rawBody = req.rawBody || req.body || '';
  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(String(rawBody)).entries());
  }

  try {
    return JSON.parse(String(rawBody));
  } catch {
    return {};
  }
}

function clean(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  return String(forwarded || req.headers?.['client-ip'] || 'unknown')
    .split(',')[0]
    .trim();
}

function isRateLimited(key) {
  const now = Date.now();
  const recent = (requestHistory.get(key) || []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  if (recent.length >= RATE_LIMIT_MAX) {
    requestHistory.set(key, recent);
    return true;
  }

  recent.push(now);
  requestHistory.set(key, recent);
  return false;
}

function validate(payload) {
  const data = {
    name: clean(payload.name, 120),
    company: clean(payload.company, 160),
    email: clean(payload.email, 254),
    phone: clean(payload.phone, 80),
    product: clean(payload.product, 160),
    inquiry: clean(payload.inquiry, 80),
    message: clean(payload.message, 5000),
    website: clean(payload.website, 200)
  };

  if (data.website) return { spam: true, data };
  if (!data.name || !data.company || !data.email || !data.inquiry || !data.message) {
    return { error: 'Please complete all required fields.' };
  }
  if (!isEmail(data.email)) {
    return { error: 'Please enter a valid email address.' };
  }
  if (!ALLOWED_INQUIRIES.has(data.inquiry)) {
    return { error: 'Please select a valid inquiry type.' };
  }

  return { data };
}

function tableRow(label, value) {
  if (!value) return '';
  return `<tr><th style="padding:8px 12px;text-align:left;vertical-align:top;background:#f3f7fb;border:1px solid #dbe5ef">${escapeHtml(label)}</th><td style="padding:8px 12px;border:1px solid #dbe5ef">${escapeHtml(value).replaceAll('\n', '<br>')}</td></tr>`;
}

async function getGraphToken() {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    const error = new Error('Microsoft 365 delivery is not configured.');
    error.code = 'NOT_CONFIGURED';
    throw error;
  }

  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
      signal: AbortSignal.timeout(10000)
    }
  );

  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error('Microsoft Graph authentication failed.');
  }

  return result.access_token;
}

async function sendContactEmail(data) {
  const accessToken = await getGraphToken();
  const productPrefix = data.product ? `${data.product} — ` : '';
  const subject = `[Website ${data.inquiry}] ${productPrefix}${data.company}`;
  const submittedAt = new Date().toISOString();

  const html = `
    <div style="font-family:Arial,sans-serif;color:#172b3f;line-height:1.5">
      <h2 style="margin:0 0 16px">New Unistar website inquiry</h2>
      <table style="border-collapse:collapse;width:100%;max-width:760px">
        ${tableRow('Inquiry Type', data.inquiry)}
        ${tableRow('Product', data.product)}
        ${tableRow('Name', data.name)}
        ${tableRow('Company', data.company)}
        ${tableRow('Email', data.email)}
        ${tableRow('Phone', data.phone)}
        ${tableRow('Message', data.message)}
        ${tableRow('Submitted', submittedAt)}
      </table>
      <p style="margin-top:16px;color:#52677b">Replying to this message will address the customer directly.</p>
    </div>`;

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(CONTACT_SENDER)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: 'HTML',
            content: html
          },
          toRecipients: [
            { emailAddress: { address: CONTACT_RECIPIENT } }
          ],
          replyTo: [
            { emailAddress: { address: data.email, name: data.name } }
          ]
        },
        saveToSentItems: true
      }),
      signal: AbortSignal.timeout(10000)
    }
  );

  if (!response.ok) {
    throw new Error(`Microsoft Graph send failed with status ${response.status}.`);
  }
}

module.exports = async function contact(context, req) {
  try {
    const payload = parsePayload(req);
    const validation = validate(payload);

    if (validation.spam) {
      context.res = jsonResponse(202, { ok: true });
      return;
    }
    if (validation.error) {
      context.res = jsonResponse(400, {
        ok: false,
        message: validation.error
      });
      return;
    }

    if (isRateLimited(getClientIp(req))) {
      context.res = jsonResponse(429, {
        ok: false,
        message: 'Too many requests. Please wait a few minutes and try again.'
      });
      return;
    }

    await sendContactEmail(validation.data);
    context.res = jsonResponse(202, { ok: true });
  } catch (error) {
    context.log.error('Contact form delivery failed.', {
      code: error.code || 'DELIVERY_FAILED',
      message: error.message
    });

    const notConfigured = error.code === 'NOT_CONFIGURED';
    context.res = jsonResponse(notConfigured ? 503 : 502, {
      ok: false,
      message: notConfigured
        ? 'Online form delivery is not configured yet.'
        : 'We could not send your request right now.'
    });
  }
};
