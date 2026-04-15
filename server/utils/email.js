async function sendBrevoEmail({ to, subject, html }) {
  if (!process.env.BREVO_API_KEY) {
    console.log(`[EMAIL-SKIP] No BREVO_API_KEY — would send "${subject}" to ${to}`);
    return null;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        name: 'Parent2Parent',
        email: process.env.SMTP_FROM || 'noreply@parent2parent.co.za',
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo API error ${res.status}: ${err}`);
  }

  return res.json();
}

function formatCents(cents) {
  return 'R ' + (cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 0 });
}

function emailWrapper(content) {
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #fafafa;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 22px; font-weight: bold; color: #2D6A4F;">Parent</span><span style="font-size: 22px; font-weight: bold; color: #F4A261;">2</span><span style="font-size: 22px; font-weight: bold; color: #2D6A4F;">Parent</span>
      </div>
      <div style="background: white; border-radius: 12px; padding: 28px; border: 1px solid #eee;">
        ${content}
      </div>
      <p style="color: #bbb; font-size: 11px; text-align: center; margin-top: 20px;">
        Parent2Parent &mdash; Previously loved. Ready for more.
      </p>
    </div>
  `;
}

async function sendSellerNotification({ sellerEmail, sellerName, buyerName, listingTitle, orderId, totalPrice, deliveryMethod, deliveryCity, clientUrl }) {
  const orderUrl = `${clientUrl}/orders/${orderId}`;
  const isCollect = deliveryMethod === 'collect';

  const html = emailWrapper(`
    <h2 style="color: #2D6A4F; font-size: 20px; margin: 0 0 16px;">You made a sale!</h2>
    <p style="color: #555; line-height: 1.6; margin: 0 0 8px;">Hi ${sellerName},</p>
    <p style="color: #555; line-height: 1.6; margin: 0 0 20px;">
      Great news &mdash; <strong>${buyerName}</strong> just purchased your listing <strong>"${listingTitle}"</strong> for <strong>${formatCents(totalPrice)}</strong>.
    </p>
    <div style="background: #f0fdf4; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
      <p style="margin: 0; color: #166534; font-size: 14px;">
        ${isCollect
          ? 'The buyer chose <strong>collection</strong>. Get in touch using the contact details on the order page to arrange pickup.'
          : `The buyer chose <strong>delivery</strong> to ${deliveryCity || 'their address'}. The Courier Guy will handle shipping.`
        }
      </p>
    </div>
    <div style="text-align: center; margin: 24px 0 8px;">
      <a href="${orderUrl}" style="background: #2D6A4F; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">View Order</a>
    </div>
  `);

  await sendBrevoEmail({
    to: sellerEmail,
    subject: `You sold "${listingTitle}" on Parent2Parent!`,
    html,
  });
}

async function sendBuyerConfirmation({ buyerEmail, buyerName, sellerName, listingTitle, orderId, totalPrice, deliveryMethod, clientUrl, trackingReference, trackingToken }) {
  const isCollect = deliveryMethod === 'collect';
  // Prefer the public tracking URL if we have a token — works even if
  // the buyer opens the email on a device where they're not logged in.
  // Falls back to the authenticated order page for collection orders
  // (no courier to track) or when the token is missing.
  const trackUrl = !isCollect && trackingToken
    ? `${clientUrl}/track/${orderId}?t=${trackingToken}`
    : `${clientUrl}/orders/${orderId}`;
  const ctaLabel = isCollect ? 'View order details' : 'Track my order';

  const html = emailWrapper(`
    <h2 style="color: #2D6A4F; font-size: 20px; margin: 0 0 16px;">Payment confirmed!</h2>
    <p style="color: #555; line-height: 1.6; margin: 0 0 8px;">Hi ${buyerName},</p>
    <p style="color: #555; line-height: 1.6; margin: 0 0 20px;">
      Your payment of <strong>${formatCents(totalPrice)}</strong> for <strong>"${listingTitle}"</strong> has been confirmed.
    </p>
    <div style="background: ${isCollect ? '#eff6ff' : '#f0fdf4'}; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
      <p style="margin: 0; color: ${isCollect ? '#1e40af' : '#166534'}; font-size: 14px;">
        ${isCollect
          ? `<strong>Next step:</strong> ${sellerName} has been notified and will be in touch to arrange collection.`
          : `<strong>Next step:</strong> The Courier Guy will collect from the seller and deliver to you.${trackingReference ? ` Your tracking number is <strong>${trackingReference}</strong>.` : ''}`
        }
      </p>
    </div>
    ${!isCollect ? `
    <p style="color: #666; font-size: 13px; line-height: 1.6; margin: 0 0 20px;">
      We'll email you when your parcel is shipped and again when it arrives. You can also check the live status any time using the button below.
    </p>` : ''}
    <div style="text-align: center; margin: 24px 0 8px;">
      <a href="${trackUrl}" style="background: #2D6A4F; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">${ctaLabel}</a>
    </div>
    ${!isCollect ? `
    <p style="color: #999; font-size: 11px; text-align: center; margin: 12px 0 0;">
      Tracking powered by The Courier Guy
    </p>` : ''}
  `);

  await sendBrevoEmail({
    to: buyerEmail,
    subject: `Payment confirmed for "${listingTitle}"`,
    html,
  });
}

// Send an operational alert to the site owner. Used for things that need
// human intervention — e.g. a paid order where shipment creation failed
// and a courier won't be dispatched unless someone steps in. Falls back
// to the hardcoded default if ADMIN_ALERT_EMAIL is not set.
async function sendAdminAlert({ subject, body, context = {} }) {
  const to = process.env.ADMIN_ALERT_EMAIL || 'saul.bloch13@gmail.com';
  const contextRows = Object.entries(context)
    .map(([k, v]) => `
      <tr>
        <td style="padding: 6px 10px; color: #666; font-size: 12px; border-bottom: 1px solid #eee; vertical-align: top;">${k}</td>
        <td style="padding: 6px 10px; color: #111; font-size: 13px; border-bottom: 1px solid #eee; font-family: ui-monospace, monospace; word-break: break-all;">${String(v ?? '—')}</td>
      </tr>
    `)
    .join('');

  const html = emailWrapper(`
    <p style="margin: 0 0 8px; color: #b91c1c; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">Action needed</p>
    <h2 style="color: #111; font-size: 20px; margin: 0 0 16px;">${subject}</h2>
    <p style="color: #555; line-height: 1.6; margin: 0 0 16px; font-size: 14px;">${body}</p>
    ${contextRows ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        ${contextRows}
      </table>
    ` : ''}
  `);

  try {
    await sendBrevoEmail({
      to,
      subject: `[Parent2Parent] ${subject}`,
      html,
    });
    console.log(`[ALERT] Admin notified: ${subject}`);
  } catch (err) {
    console.error('[ALERT] Failed to send admin alert:', err.message);
  }
}

module.exports = { sendBrevoEmail, sendSellerNotification, sendBuyerConfirmation, sendAdminAlert };
