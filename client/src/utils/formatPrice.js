export function formatPrice(cents) {
  const rands = Math.round(cents / 100);
  const formatted = rands.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `R${formatted}`;
}

export function formatPriceInput(cents) {
  return (cents / 100).toString();
}

export function parsePriceInput(rands) {
  return Math.round(parseFloat(rands) * 100);
}
