export function formatPrice(cents) {
  const rands = cents / 100;
  return `R ${rands.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatPriceInput(cents) {
  return (cents / 100).toString();
}

export function parsePriceInput(rands) {
  return Math.round(parseFloat(rands) * 100);
}
