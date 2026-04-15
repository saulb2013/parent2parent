// Self-test for the Yoco webhook signature verification (Standard Webhooks).
//
// Spins up a minimal Express app with only the payments router mounted,
// injects a mock DB pool, and POSTs several crafted webhook requests:
//   1. Valid signature                  → accepted
//   2. Invalid signature                → rejected
//   3. Missing headers                  → rejected
//   4. Stale timestamp (>5 min old)     → rejected
//   5. Multiple signatures, one valid   → accepted
//   6. Non-payment event with valid sig → accepted but ignored (no DB lookup)
//
// Run: node scripts/test-webhook.js

const crypto = require('crypto');
const express = require('express');

// Generate a test secret in the same `whsec_<base64>` shape Yoco uses.
const testKeyBytes = crypto.randomBytes(32);
const TEST_SECRET = `whsec_${testKeyBytes.toString('base64')}`;
process.env.YOCO_WEBHOOK_SECRET = TEST_SECRET;
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test/test';

const paymentsRouter = require('../routes/payments');

const app = express();
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

const mockPool = { query: async () => ({ rows: [] }) };
app.set('db', mockPool);
app.use('/api/payments', paymentsRouter);

// Capture log output so we can assert against it
const logs = [];
const origLog = console.log;
const origWarn = console.warn;
const origErr = console.error;
console.log = (...a) => { logs.push(['log', a.join(' ')]); origLog(...a); };
console.warn = (...a) => { logs.push(['warn', a.join(' ')]); origWarn(...a); };
console.error = (...a) => { logs.push(['error', a.join(' ')]); origErr(...a); };

// Produce a Standard Webhooks v1 signature header for a given payload.
function signBody({ id, timestamp, body, keyBytes = testKeyBytes }) {
  const signedPayload = `${id}.${timestamp}.${body}`;
  const sig = crypto.createHmac('sha256', keyBytes).update(signedPayload).digest('base64');
  return `v1,${sig}`;
}

const server = app.listen(0, async () => {
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/api/payments/webhook`;
  let pass = 0;
  let fail = 0;

  function check(name, ok, detail) {
    if (ok) {
      pass++;
      origLog(`  PASS  ${name}`);
    } else {
      fail++;
      origLog(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
    }
  }

  async function send(headers, body) {
    logs.length = 0;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    });
    await new Promise(r => setTimeout(r, 100));
    return { status: res.status, logs: [...logs] };
  }

  const logsContain = (captured, needle) =>
    captured.some(([, msg]) => msg.includes(needle));

  try {
    const now = String(Math.floor(Date.now() / 1000));

    // --- Test 1: valid signature ---
    origLog('\nTest 1: valid v1 signature');
    const body1 = JSON.stringify({
      type: 'payment.succeeded',
      id: 'evt_1',
      payload: { id: 'p_1', status: 'succeeded', checkoutId: 'ch_abc', metadata: { orderId: '42' } },
    });
    const r1 = await send({
      'webhook-id': 'evt_1',
      'webhook-timestamp': now,
      'webhook-signature': signBody({ id: 'evt_1', timestamp: now, body: body1 }),
    }, body1);
    check('responds 200', r1.status === 200);
    check('signature accepted', !logsContain(r1.logs, 'verification failed'));
    check('event processed (mock DB returns no order)',
      logsContain(r1.logs, 'No order found'));

    // --- Test 2: invalid signature ---
    origLog('\nTest 2: invalid signature');
    const body2 = JSON.stringify({ type: 'payment.succeeded', payload: { status: 'succeeded' } });
    const r2 = await send({
      'webhook-id': 'evt_2',
      'webhook-timestamp': now,
      'webhook-signature': 'v1,' + Buffer.from('wrong').toString('base64'),
    }, body2);
    check('still responds 200', r2.status === 200);
    check('verification rejected', logsContain(r2.logs, 'verification failed'));

    // --- Test 3: missing headers ---
    origLog('\nTest 3: missing headers');
    const body3 = JSON.stringify({ type: 'payment.succeeded' });
    const r3 = await send({}, body3);
    check('still responds 200', r3.status === 200);
    check('missing header logged', logsContain(r3.logs, 'Missing webhook-id'));

    // --- Test 4: stale timestamp ---
    origLog('\nTest 4: stale timestamp (>5 minutes)');
    const stale = String(Math.floor(Date.now() / 1000) - 600);
    const body4 = JSON.stringify({ type: 'payment.succeeded' });
    const r4 = await send({
      'webhook-id': 'evt_4',
      'webhook-timestamp': stale,
      'webhook-signature': signBody({ id: 'evt_4', timestamp: stale, body: body4 }),
    }, body4);
    check('still responds 200', r4.status === 200);
    check('stale timestamp rejected', logsContain(r4.logs, 'Stale timestamp'));

    // --- Test 5: multiple signatures, one valid ---
    origLog('\nTest 5: multiple signatures, one valid');
    const body5 = JSON.stringify({
      type: 'payment.succeeded',
      payload: { status: 'succeeded', checkoutId: 'ch_5', metadata: { orderId: '5' } },
    });
    const bogus = 'v1,' + Buffer.from('nope').toString('base64');
    const good = signBody({ id: 'evt_5', timestamp: now, body: body5 });
    const r5 = await send({
      'webhook-id': 'evt_5',
      'webhook-timestamp': now,
      'webhook-signature': `${bogus} ${good}`,
    }, body5);
    check('responds 200', r5.status === 200);
    check('at least one valid sig accepted', !logsContain(r5.logs, 'verification failed'));

    // --- Test 6: non-payment event ignored ---
    origLog('\nTest 6: non-payment event (valid sig, but ignored)');
    const body6 = JSON.stringify({
      type: 'payment.failed',
      payload: { status: 'failed', checkoutId: 'ch_6' },
    });
    const r6 = await send({
      'webhook-id': 'evt_6',
      'webhook-timestamp': now,
      'webhook-signature': signBody({ id: 'evt_6', timestamp: now, body: body6 }),
    }, body6);
    check('responds 200', r6.status === 200);
    check('non-success event ignored',
      logsContain(r6.logs, 'Ignoring event') && !logsContain(r6.logs, 'No order found'));

    origLog(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  } catch (err) {
    origErr('Test runner crashed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
