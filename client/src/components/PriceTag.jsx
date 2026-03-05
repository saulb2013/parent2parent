import { formatPrice } from '../utils/formatPrice';

export default function PriceTag({ price, negotiable, size = 'md' }) {
  const sizes = {
    sm: 'text-lg font-bold',
    md: 'text-2xl font-bold',
    lg: 'text-3xl font-bold',
  };

  return (
    <div className="flex items-baseline gap-2">
      <span className={`${sizes[size]} text-primary`}>{formatPrice(price)}</span>
      {negotiable ? (
        <span className="text-xs text-accent-dark font-medium bg-badge px-2 py-0.5 rounded-full">Negotiable</span>
      ) : null}
    </div>
  );
}
