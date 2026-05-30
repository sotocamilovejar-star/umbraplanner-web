/**
 * Lemon Squeezy webhook — POST /api/webhook
 *
 * Variables de entorno requeridas en Vercel:
 *   SUPABASE_SERVICE_KEY  → Supabase → Settings → API → service_role key
 *   LS_WEBHOOK_SECRET     → Lemon Squeezy → Settings → Webhooks → signing secret
 */

const crypto = require('crypto');
const https  = require('https');

const SUPABASE_HOST   = 'fwlotorqfujhziojocey.supabase.co';
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const WEBHOOK_SECRET  = process.env.LS_WEBHOOK_SECRET;

// Lemon Squeezy firma el payload con HMAC-SHA256
function verifySignature(rawBody, signature) {
  if (!WEBHOOK_SECRET || !signature) return !WEBHOOK_SECRET; // en dev sin secret, dejar pasar
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); }
  catch { return false; }
}

function supabaseUpdate(deviceId, plan) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ plan });
    const opts = {
      hostname: SUPABASE_HOST,
      path:     `/rest/v1/devices?device_id=eq.${encodeURIComponent(deviceId)}`,
      method:   'PATCH',
      headers: {
        'apikey':         SUPABASE_KEY,
        'Authorization':  `Bearer ${SUPABASE_KEY}`,
        'Content-Type':   'application/json',
        'Prefer':         'return=minimal',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function supabaseUpdateUser(userId, plan) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify([{
      user_id:    userId,
      key:        'plan',
      value:      plan,
      updated_at: new Date().toISOString(),
    }]);
    const opts = {
      hostname: SUPABASE_HOST,
      path:     '/rest/v1/user_data?on_conflict=user_id,key',
      method:   'POST',
      headers: {
        'apikey':         SUPABASE_KEY,
        'Authorization':  `Bearer ${SUPABASE_KEY}`,
        'Content-Type':   'application/json',
        'Prefer':         'resolution=merge-duplicates,return=minimal',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', chunk => buf += chunk.toString());
    req.on('end',  () => resolve(buf));
    req.on('error', reject);
  });
}

// Eventos que activan plan Pro
const ACTIVE_EVENTS = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_resumed',
  'subscription_unpaused',
  'subscription_payment_success',
]);

// Eventos que revocan plan Pro
const CANCELLED_EVENTS = new Set([
  'subscription_cancelled',
  'subscription_expired',
  'subscription_paused',
]);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody  = await getRawBody(req);
  const signature = req.headers['x-signature'] || '';

  if (!verifySignature(rawBody, signature)) {
    console.warn('[webhook] firma inválida');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const event    = payload?.meta?.event_name            || '';
  const deviceId = payload?.meta?.custom_data?.device_id || '';
  const userId   = payload?.meta?.custom_data?.user_id   || '';
  const status   = payload?.data?.attributes?.status     || '';

  console.log(`[webhook] event=${event} device=${deviceId} user=${userId} status=${status}`);

  if (!deviceId && !userId) return res.status(200).json({ ok: true, note: 'no identifier' });
  if (!SUPABASE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not set' });

  let newPlan = null;
  if (ACTIVE_EVENTS.has(event) && status !== 'cancelled' && status !== 'expired') newPlan = 'pro';
  else if (CANCELLED_EVENTS.has(event)) newPlan = 'free';

  if (newPlan) {
    try {
      if (deviceId) {
        const r = await supabaseUpdate(deviceId, newPlan);
        console.log(`[webhook] device ${deviceId} → ${newPlan} (HTTP ${r.status})`);
      }
      if (userId) {
        const r = await supabaseUpdateUser(userId, newPlan);
        console.log(`[webhook] user ${userId} → ${newPlan} (HTTP ${r.status})`);
      }
    } catch (err) {
      console.error('[webhook] Supabase error:', err.message);
      return res.status(500).json({ error: 'db update failed' });
    }
  }

  return res.status(200).json({ ok: true, event, plan: newPlan });
};

// Desactivar body parser de Vercel para poder leer el raw body
module.exports.config = { api: { bodyParser: false } };
