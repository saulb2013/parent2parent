// Build the public URL for TCG's own tracking page. Buyers get the
// courier's full UX (map, ETA, proof of delivery) which is richer
// than anything we render in-app — so this is the primary "Track
// my order" destination wherever a tracking reference exists.
export function tcgTrackingUrl(trackingReference) {
  if (!trackingReference) return null;
  return `https://www.thecourierguy.co.za/track?tracking_ref=${encodeURIComponent(trackingReference)}`;
}
