// Register the Parent2Parent payment webhook with Yoco.
// Yoco returns a `secret` once when creating a subscription — store it as
// YOCO_WEBHOOK_SECRET in Render. If you lose it you have to rotate.
//
// Run: node --env-file=.env scripts/register-webhook.js [webhookUrl]
// Default URL: https://parent2parent.onrender.com/api/payments/webhook

const YOCO_BASE_URL = 'https://payments.yoco.com/api';
const DEFAULT_URL = 'https://parent2parent.onrender.com/api/payments/webhook';

(async () => {
  const webhookUrl = process.argv[2] || DEFAULT_URL;

  if (!process.env.YOCO_SECRET_KEY) {
    console.error('Missing YOCO_SECRET_KEY in env');
    process.exit(1);
  }

  console.log(`Registering webhook URL: ${webhookUrl}\n`);

  const regRes = await fetch(`${YOCO_BASE_URL}/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.YOCO_SECRET_KEY}`,
    },
    body: JSON.stringify({
      name: 'parent2parent-payments',
      url: webhookUrl,
    }),
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
  const secret = parsed.secret;

  if (secret) {
    console.log('========================================');
    console.log('WEBHOOK SECRET (save this — shown once):');
    console.log(secret);
    console.log('========================================\n');
    console.log('Next steps:');
    console.log(`  1. Render dashboard → Environment → add/update:`);
    console.log(`       YOCO_WEBHOOK_SECRET=${secret}`);
    console.log(`  2. Trigger a redeploy on Render`);
    console.log(`  3. Also set it in your local server/.env for local testing`);
  } else {
    console.warn('No secret in response — check the body above');
  }
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
