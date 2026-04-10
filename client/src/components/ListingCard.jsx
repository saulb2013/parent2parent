import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/formatPrice';
import Badge from './Badge';
import { AGE_STAGE_LABELS } from '../constants/ageStages';

export default function ListingCard({ listing }) {
  const timeAgo = getTimeAgo(listing.created_at);

  return (
    <Link to={`/listings/${listing.id}`} className="card group block">
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={listing.image_url || 'https://picsum.photos/seed/default/800/600'}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute top-3 left-3">
          <Badge type="condition" value={listing.condition} />
        </div>
        {listing.negotiable ? (
          <div className="absolute top-3 right-3">
            <span className="bg-badge text-accent-dark text-xs font-semibold px-2 py-1 rounded-full">
              Negotiable
            </span>
          </div>
        ) : null}
      </div>
      <div className="p-4">
        <h3 className="font-body font-semibold text-gray-900 line-clamp-1 group-hover:text-primary transition-colors">
          {listing.title}
        </h3>
        <p className="text-xl font-bold text-primary mt-1">{formatPrice(listing.price)}</p>
        {listing.age_stage && AGE_STAGE_LABELS[listing.age_stage] && (
          <p className="text-xs text-gray-500 mt-1">{AGE_STAGE_LABELS[listing.age_stage]}</p>
        )}
        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            {listing.seller_avatar ? (
              <img src={listing.seller_avatar} alt="" className="w-5 h-5 rounded-full" />
            ) : null}
            <span className="truncate max-w-[100px]">{listing.seller_name}</span>
          </div>
          <span>{listing.city}, {listing.province?.split(' ').map(w => w[0]).join('')}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">{timeAgo}</p>
      </div>
    </Link>
  );
}

function getTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}
