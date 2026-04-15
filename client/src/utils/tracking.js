// Build the public URL for TCG's own tracking page. Buyers get the
// courier's full UX (map, ETA, proof of delivery) which is richer
// than anything we render in-app — so this is the primary "Track
// my order" destination wherever a tracking reference exists.
//
// Note the ?ref= param — this is the one that actually pre-fills
// the waybill field on thecourierguy.co.za/track. Other obvious
// guesses (tracking_ref, waybill, tracking_reference) load the page
// but leave the field blank.
//
// TCG's public site expects a long "TCG1234567890"-format waybill,
// NOT Shiplogic's 6-char short reference. Pass the waybill if the
// order has one; otherwise returns null so callers can hide the
// Track Order button until the waybill lands.
export function tcgTrackingUrl(waybill) {
  if (!waybill) return null;
  return `https://www.thecourierguy.co.za/track?ref=${encodeURIComponent(waybill)}`;
}
