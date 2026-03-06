import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ListingCard from '../components/ListingCard';
import Badge from '../components/Badge';
import { formatPrice } from '../utils/formatPrice';

export default function Profile() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState({ active_count: 0, sold_count: 0, hidden_count: 0, total_count: 0 });
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);

  const isOwn = currentUser?.id === parseInt(id);

  const fetchProfile = () => {
    setLoading(true);
    fetch(`/api/users/${id}`)
      .then(r => r.json())
      .then(data => {
        setProfile(data.user);
        setListings(data.listings);
        setStats(data.stats || { active_count: 0, sold_count: 0, hidden_count: 0, total_count: 0 });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProfile(); }, [id]);

  const updateStatus = async (listingId, status) => {
    await fetch(`/api/listings/${listingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    fetchProfile();
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="animate-pulse flex gap-6">
          <div className="w-24 h-24 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-3">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <h2 className="font-display text-2xl font-bold">User not found</h2>
      </div>
    );
  }

  const filtered = listings.filter(l => {
    if (tab === 'active') return l.status === 'active';
    if (tab === 'sold') return l.status === 'sold';
    if (tab === 'hidden') return l.status === 'hidden';
    return true;
  });

  const tabs = [
    { key: 'active', label: 'Active Listings' },
    { key: 'sold', label: 'Sold' },
  ];
  if (isOwn) {
    tabs.push({ key: 'hidden', label: `Hidden (${stats.hidden_count || 0})` });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Profile Header */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <img
            src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`}
            alt={profile.name}
            className="w-24 h-24 rounded-full bg-gray-100"
          />
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-gray-900">{profile.name}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {profile.city && profile.province
                ? `${profile.city}, ${profile.province}`
                : profile.province || 'South Africa'}
              {' '}&middot; Member since {new Date(profile.created_at).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
            </p>
            {profile.bio && <p className="text-gray-600 mt-3 text-sm">{profile.bio}</p>}

            {/* Stats */}
            <div className="flex gap-6 mt-4">
              <div>
                <p className="text-xl font-bold text-primary">{stats.active_count}</p>
                <p className="text-xs text-gray-500">Active</p>
              </div>
              <div>
                <p className="text-xl font-bold text-accent">{stats.sold_count}</p>
                <p className="text-xs text-gray-500">Sold</p>
              </div>
              {isOwn && (
                <div>
                  <p className="text-xl font-bold text-gray-400">{stats.hidden_count || 0}</p>
                  <p className="text-xs text-gray-500">Hidden</p>
                </div>
              )}
              <div>
                <p className="text-xl font-bold text-gray-700">{stats.total_count}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mt-8 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Listings */}
      <div className="mt-6">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">{tab === 'hidden' ? '\uD83D\uDC41\uFE0F' : '\uD83D\uDCE6'}</p>
            <p className="text-gray-500">
              {tab === 'hidden' ? 'No hidden listings' : `No ${tab} listings yet`}
            </p>
            {isOwn && tab === 'active' && (
              <Link to="/sell" className="btn-primary mt-4 inline-block">
                List Your First Item
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(listing => (
              <div key={listing.id} className="relative">
                {tab === 'hidden' && (
                  <div className="absolute inset-0 bg-gray-900/10 rounded-2xl z-10 pointer-events-none" />
                )}
                <ListingCard listing={listing} />
                {isOwn && (
                  <div className="flex gap-2 mt-2">
                    {listing.status === 'active' && (
                      <>
                        <button
                          onClick={() => updateStatus(listing.id, 'hidden')}
                          className="flex-1 text-xs py-2 px-3 rounded-lg border border-border text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Hide
                        </button>
                        <button
                          onClick={() => updateStatus(listing.id, 'sold')}
                          className="flex-1 text-xs py-2 px-3 rounded-lg bg-accent text-white hover:bg-accent-dark transition-colors"
                        >
                          Mark Sold
                        </button>
                      </>
                    )}
                    {listing.status === 'hidden' && (
                      <>
                        <button
                          onClick={() => updateStatus(listing.id, 'active')}
                          className="flex-1 text-xs py-2 px-3 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
                        >
                          Make Active
                        </button>
                        <button
                          onClick={() => updateStatus(listing.id, 'sold')}
                          className="flex-1 text-xs py-2 px-3 rounded-lg bg-accent text-white hover:bg-accent-dark transition-colors"
                        >
                          Mark Sold
                        </button>
                      </>
                    )}
                    {listing.status === 'sold' && (
                      <button
                        onClick={() => updateStatus(listing.id, 'active')}
                        className="flex-1 text-xs py-2 px-3 rounded-lg border border-border text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Relist
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
