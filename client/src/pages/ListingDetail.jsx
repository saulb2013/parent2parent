import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatPrice } from '../utils/formatPrice';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import ListingCard from '../components/ListingCard';
import { AGE_STAGE_LABELS } from '../constants/ageStages';

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/listings/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setListing(data.listing);
        setSimilar(data.similar);
        setSaved(data.listing.isSaved);
        setSelectedImage(0);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const toggleSave = async () => {
    if (!user) return;
    const method = saved ? 'DELETE' : 'POST';
    await fetch(`/api/listings/${id}/save`, { method, credentials: 'include' });
    setSaved(!saved);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="aspect-square bg-gray-200 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-10 bg-gray-200 rounded w-1/3" />
            <div className="h-20 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="font-display text-2xl font-bold">Listing not found</h2>
        <Link to="/browse" className="btn-primary mt-4 inline-block">Browse Listings</Link>
      </div>
    );
  }

  const isOwnListing = user?.id === listing.seller_id;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-primary">Home</Link>
        <span>/</span>
        <Link to={`/browse?category=${listing.category_slug}`} className="hover:text-primary">
          {listing.category_emoji} {listing.category_name}
        </Link>
        <span>/</span>
        <span className="text-gray-800 truncate">{listing.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image Gallery */}
        <div>
          <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4">
            <img
              src={listing.images?.[selectedImage]?.url || 'https://picsum.photos/seed/default/800/600'}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          </div>
          {listing.images?.length > 1 && (
            <div className="flex gap-3">
              {listing.images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(i)}
                  className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    i === selectedImage ? 'border-primary ring-2 ring-primary-light' : 'border-border hover:border-gray-300'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge type="condition" value={listing.condition} className="mb-3" />
              <h1 className="font-display text-3xl font-bold text-gray-900">{listing.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              {isOwnListing && (
                <Link
                  to={`/listings/${id}/edit`}
                  className="p-2 rounded-full text-gray-400 hover:text-primary transition-colors"
                  title="Edit listing"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </Link>
              )}
              {!isOwnListing && (
                <button
                  onClick={toggleSave}
                  className={`p-2 rounded-full transition-colors ${saved ? 'text-accent-dark' : 'text-gray-400 hover:text-accent-dark'}`}
                  title={saved ? 'Unsave' : 'Save listing'}
                >
                  <svg className="w-7 h-7" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-baseline gap-3 mt-4">
            <span className="text-4xl font-bold text-primary">{formatPrice(listing.price)}</span>
            {listing.negotiable ? (
              <span className="text-sm text-accent-dark font-medium bg-badge px-3 py-1 rounded-full">Negotiable</span>
            ) : null}
            {listing.age_stage && AGE_STAGE_LABELS[listing.age_stage] && (
              <span className="text-sm text-gray-600 font-medium bg-gray-100 px-3 py-1 rounded-full">{AGE_STAGE_LABELS[listing.age_stage]}</span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {listing.city}, {listing.province}
            </span>
            <span>{listing.views} views</span>
          </div>

          <hr className="my-6 border-border" />

          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Description</h3>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
          </div>

          {!isOwnListing && (
            <>
              <hr className="my-6 border-border" />

              {/* Seller Card */}
              <div className="card p-5">
                <div className="flex items-center gap-4">
                  <img
                    src={listing.seller_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${listing.seller_id}`}
                    alt={listing.seller_name}
                    className="w-14 h-14 rounded-full bg-gray-100"
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">{listing.seller_name}</h4>
                    <p className="text-xs text-gray-500">
                      {listing.seller_city}, {listing.seller_province} &middot; Member since {new Date(listing.seller_since).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <Link to={`/profile/${listing.seller_id}`} className="text-sm text-primary font-medium hover:underline">
                    View Profile
                  </Link>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                {listing.status === 'active' && (
                  <Link
                    to={`/checkout/${id}`}
                    className="btn-primary flex items-center justify-center gap-2 flex-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                    Buy Now
                  </Link>
                )}
                <button onClick={toggleSave} className="btn-outline flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {saved ? 'Saved' : 'Save Listing'}
                </button>
              </div>
            </>
          )}

          {isOwnListing && (
            <div className="flex gap-3 mt-6">
              <Link to={`/listings/${id}/edit`} className="btn-primary flex items-center justify-center gap-2 flex-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Listing
              </Link>
              <Link to={`/profile/${user.id}?view=seller`} className="btn-outline flex items-center justify-center gap-2 flex-1">
                Back to My Listings
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Similar Listings - only for other people's listings */}
      {!isOwnListing && similar.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold text-gray-900 mb-6">Similar Listings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {similar.map(item => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
