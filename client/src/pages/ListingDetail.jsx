import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatPrice } from '../utils/formatPrice';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import ListingCard from '../components/ListingCard';

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
  const whatsappNumber = listing.seller_phone?.replace(/[^0-9]/g, '');
  const whatsappMessage = encodeURIComponent(`Hi! I'm interested in your ${listing.title} on Parent2Parent.`);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

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
                {whatsappNumber && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 flex-1 ${listing.status === 'active' ? 'btn-outline' : 'btn-primary'}`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Contact via WhatsApp
                  </a>
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
