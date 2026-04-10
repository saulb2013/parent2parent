// Self-test for the Stitch webhook signature verification.
// Spins up a minimal Express app with only the payments router mounted,
// injects a mock DB pool, and POSTs three crafted webhook requests:
//   1. Valid HMAC-SHA256 signature  -> should pass verification, then "no order found"
//   2. Invalid signature             -> should be rejected at verification
//   3. Missing signature header      -> should be rejected at verification
// Run: node scripts/test-webhook.js

const crypto = require('crypto');
const express = require('express');

const TEST_SECRET = 'test-webhook-secret-' + crypto.randomBytes(8).toString('hex');
process.env.STITCH_WEBHOOK_SECRET = TEST_SECRET;
// Avoid loading real DB / clobbering our test secret
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test/test';

const paymentsRouter = require('../routes/payments');

const app = express();
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

// Mock pool — webhook handler only calls .query()
const mockPool = {
  query: async () => ({ rows: [] }),
};
app.set('db', mockPool);
app.use('/api/payments', paymentsRouter);

// Capture log output to assert against
const logs = [];
const origLog = console.log;
const origWarn = console.warn;
const origErr = console.error;
console.log = (...a) => { logs.push(['log', a.join(' ')]); origLog(...a); };
console.warn = (...a) => { logs.push(['warn', a.join(' ')]); origWarn(...a); };
console.error = (...a) => { logs.push(['error', a.join(' ')]); origErr(...a); };

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
    // Give the async post-response handler a moment to run
    await new Promise(r => setTimeout(r, 100));
    return { status: res.status, logs: [...logs] };
  }

  function logsContain(captured, needle) {
    return captured.some(([, msg]) => msg.includes(needle));
  }

  try {
    // ---------- Test 1: valid HMAC hex signature ----------
    origLog('\nTest 1: valid HMAC-SHA256 hex signature');
    const body1 = JSON.stringify({
      type: 'payment.paid',
      data: { id: 'test-payment-ref-001', status: 'PAID' },
    });
    const sig1 = crypto.createHmac('sha256', TEST_SECRET).update(body1).digest('hex');
    const r1 = await send({ 'x-stitch-signature': sig1 }, body1);
    check('responds 200', r1.status === 200, `got ${r1.status}`);
    check('signature accepted (no "verification failed" log)',
      !logsContain(r1.logs, 'Signature verification failed'));
    check('looks up order by payment_reference (mock returns none)',
      logsContain(r1.logs, 'No order found for payment reference test-payment-ref-001'));

    // ---------- Test 2: invalid signature ----------
    origLog('\nTest 2: invalid signature');
    const body2 = JSON.stringify({
      type: 'payment.paid',
      data: { id: 'test-payment-ref-002', status: 'PAID' },
    });
    const r2 = await send({ 'x-stitch-signature': 'deadbeef'.repeat(8) }, body2);
    check('still responds 200 (always ack)', r2.status === 200);
    check('verification rejected', logsContain(r2.logs, 'Signature verification failed'));
    check('did NOT process event', !logsContain(r2.logs, 'test-payment-ref-002'));

    // ---------- Test 3: missing signature header ----------
    origLog('\nTest 3: missing signature header');
    const body3 = JSON.stringify({ type: 'payment.paid', data: { id: 'x', status: 'PAID' } });
    const r3 = await send({}, body3);
    check('still responds 200', r3.status === 200);
    check('header missing logged', logsContain(r3.logs, 'No signature header'));
    check('verification rejected', logsContain(r3.logs, 'Signature verification failed'));

    // ---------- Test 4: valid base64 signature (alt encoding) ----------
    origLog('\nTest 4: valid HMAC-SHA256 base64 signature');
    const body4 = JSON.stringify({
      type: 'payment.paid',
      data: { id: 'test-payment-ref-004', status: 'PAID' },
    });
    const sig4 = crypto.createHmac('sha256', TEST_SECRET).update(body4).digest('base64');
    const r4 = await send({ 'x-stitch-signature': sig4 }, body4);
    check('responds 200', r4.status === 200);
    check('signature accepted', !logsContain(r4.logs, 'Signature verification failed'));

    // ---------- Test 5: valid signature with sha256= prefix ----------
    origLog('\nTest 5: valid signature with "sha256=" prefix');
    const body5 = JSON.stringify({
      type: 'payment.paid',
      data: { id: 'test-payment-ref-005', status: 'PAID' },
    });
    const sig5 = 'sha256=' + crypto.createHmac('sha256', TEST_SECRET).update(body5).digest('hex');
    const r5 = await send({ 'x-stitch-signature': sig5 }, body5);
    check('responds 200', r5.status === 200);
    check('prefix stripped, signature accepted', !logsContain(r5.logs, 'Signature verification failed'));

    // ---------- Test 6: non-paid event ignored ----------
    origLog('\nTest 6: non-paid event (should be ignored even with valid signature)');
    const body6 = JSON.stringify({
      type: 'payment.cancelled',
      data: { id: 'test-payment-ref-006', status: 'CANCELLED' },
    });
    const sig6 = crypto.createHmac('sha256', TEST_SECRET).update(body6).digest('hex');
    const r6 = await send({ 'x-stitch-signature': sig6 }, body6);
    check('responds 200', r6.status === 200);
    check('event ignored (no DB lookup)', logsContain(r6.logs, 'Ignoring non-paid event'));
    check('did NOT look up order', !logsContain(r6.logs, 'No order found'));

    origLog(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  } catch (err) {
    origErr('Test runner crashed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
