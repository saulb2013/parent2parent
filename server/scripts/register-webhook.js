// Register the Parent2Parent payment webhook with Stitch Express.
// Stitch returns a `secret` once — store it as STITCH_WEBHOOK_SECRET in Render.
//
// Run: node --env-file=.env scripts/register-webhook.js [webhookUrl]
// Default URL: https://parent2parent.onrender.com/api/payments/webhook

const STITCH_BASE_URL = 'https://express.stitch.money/api/v1';
const DEFAULT_URL = 'https://parent2parent.onrender.com/api/payments/webhook';

(async () => {
  const webhookUrl = process.argv[2] || DEFAULT_URL;

  if (!process.env.STITCH_CLIENT_ID || !process.env.STITCH_CLIENT_SECRET) {
    console.error('Missing STITCH_CLIENT_ID or STITCH_CLIENT_SECRET in env');
    process.exit(1);
  }

  console.log(`Registering webhook URL: ${webhookUrl}\n`);

  // 1. Get an access token
  const tokenRes = await fetch(`${STITCH_BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.STITCH_CLIENT_ID,
      clientSecret: process.env.STITCH_CLIENT_SECRET,
      scope: 'client_paymentrequest',
    }),
  });

  if (!tokenRes.ok) {
    console.error(`Token request failed: ${tokenRes.status}`);
    console.error(await tokenRes.text());
    process.exit(1);
  }

  const tokenData = await tokenRes.json();
  const token = tokenData.data?.accessToken || tokenData.accessToken;
  console.log('OK  Got access token\n');

  // 2. Register the webhook
  const regRes = await fetch(`${STITCH_BASE_URL}/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ url: webhookUrl }),
  });

  const regBody = await regRes.text();
  console.log(`Status: ${regRes.status}`);
  console.log(`Body:   ${regBody}\n`);

  if (!regRes.ok) {
    console.error('Webhook registration failed.');
    process.exit(1);
  }

  let parsed;
  try { parsed = JSON.parse(regBody); } catch { parsed = {}; }
  const secret = parsed.data?.secret || parsed.secret;

  if (secret) {
    console.log('========================================');
    console.log('WEBHOOK SECRET (save this — shown once):');
    console.log(secret);
    console.log('========================================\n');
    console.log('Next steps:');
    console.log(`  1. Render dashboard → Environment → add:`);
    console.log(`       STITCH_WEBHOOK_SECRET=${secret}`);
    console.log(`  2. Trigger a redeploy on Render`);
    console.log(`  3. Also add it to your local server/.env if you want to test locally`);
  } else {
    console.warn('No secret in response — check the body above');
  }
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
