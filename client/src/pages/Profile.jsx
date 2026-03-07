import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ListingCard from '../components/ListingCard';
import { formatPrice } from '../utils/formatPrice';

const provinces = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
];

export default function Profile() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState({ active_count: 0, sold_count: 0, hidden_count: 0, total_count: 0 });
  const [tab, setTab] = useState('active');
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const newListingId = searchParams.get('new');
  const [mode, setMode] = useState(viewParam === 'buyer' ? 'buyer' : viewParam === 'seller' ? 'seller' : 'seller');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileRef = useRef();

  // Buyer state
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [buyerTab, setBuyerTab] = useState('purchases');
  const [buyerLoading, setBuyerLoading] = useState(false);

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

  const fetchBuyerData = () => {
    if (!isOwn) return;
    setBuyerLoading(true);
    Promise.all([
      fetch('/api/orders', { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/users/${id}/saved`, { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([ordersData, savedData]) => {
        setOrders(ordersData.orders || []);
        setWishlist(savedData.listings || []);
      })
      .finally(() => setBuyerLoading(false));
  };

  // Sync mode when URL search param changes (from navbar navigation)
  useEffect(() => {
    if (viewParam === 'buyer') setMode('buyer');
    else if (viewParam === 'seller') setMode('seller');
  }, [viewParam]);

  useEffect(() => { fetchProfile(); }, [id]);

  useEffect(() => {
    if (mode === 'buyer' && isOwn) {
      fetchBuyerData();
    }
  }, [mode, id]);

  const startEditing = () => {
    setEditForm({
      name: profile.name || '',
      bio: profile.bio || '',
      phone: profile.phone || '',
      province: profile.province || '',
      city: profile.city || '',
    });
    setAvatarPreview(null);
    setAvatarFile(null);
    setEditing(true);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', editForm.name);
      formData.append('bio', editForm.bio);
      formData.append('phone', editForm.phone);
      formData.append('province', editForm.province);
      formData.append('city', editForm.city);
      if (avatarFile) formData.append('avatar', avatarFile);

      await fetch(`/api/users/${id}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });
      setEditing(false);
      fetchProfile();
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (listingId, status) => {
    await fetch(`/api/listings/${listingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    fetchProfile();
  };

  const removeFromWishlist = async (listingId) => {
    await fetch(`/api/listings/${listingId}/save`, {
      method: 'DELETE',
      credentials: 'include',
    });
    setWishlist(prev => prev.filter(l => l.id !== listingId));
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

  const avatarSrc = avatarPreview || profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`;

  const filtered = listings.filter(l => {
    if (tab === 'active') return l.status === 'active';
    if (tab === 'sold') return l.status === 'sold';
    if (tab === 'hidden') return l.status === 'hidden';
    return true;
  });

  const sellerTabs = [
    { key: 'active', label: 'Active Listings' },
    { key: 'sold', label: 'Sold' },
  ];
  if (isOwn) {
    sellerTabs.push({ key: 'hidden', label: `Hidden (${stats.hidden_count || 0})` });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Profile Header */}
      <div className="card p-6 sm:p-8">
        {editing ? (
          /* ===== EDIT MODE ===== */
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Avatar upload */}
              <div className="relative group">
                <img src={avatarSrc} alt="" className="w-24 h-24 rounded-full bg-gray-100 object-cover" />
                <button
                  type="button"
                  onClick={() => fileRef.current.click()}
                  className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </div>

              <div className="flex-1 w-full space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={editForm.bio}
                    onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                    placeholder="Tell other parents a bit about yourself..."
                    rows={3}
                    maxLength={300}
                    className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">{editForm.bio.length}/300</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone (for WhatsApp)</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="e.g., 27821234567"
                    className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <p className="text-xs text-gray-400 mt-1">Include country code (27) for WhatsApp to work</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Province</label>
                    <select
                      value={editForm.province}
                      onChange={e => setEditForm({ ...editForm, province: e.target.value })}
                      className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                    >
                      <option value="">Select province</option>
                      {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">City / Area</label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                      placeholder="e.g., Seapoint"
                      className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setEditing(false)} className="btn-outline text-sm !py-2 !px-5">
                    Cancel
                  </button>
                  <button onClick={saveProfile} disabled={saving} className="btn-accent text-sm !py-2 !px-5 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ===== VIEW MODE ===== */
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <img
              src={avatarSrc}
              alt={profile.name}
              className="w-24 h-24 rounded-full bg-gray-100 object-cover"
            />
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="font-display text-2xl font-bold text-gray-900">{profile.name}</h1>
                  <p className="text-gray-500 text-sm mt-1">
                    {profile.city && profile.province
                      ? `${profile.city}, ${profile.province}`
                      : profile.province || 'South Africa'}
                    {' '}&middot; Member since {new Date(profile.created_at).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {isOwn && (
                  <button onClick={startEditing} className="btn-outline text-sm !py-2 !px-4 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Profile
                  </button>
                )}
              </div>

              {profile.bio && <p className="text-gray-600 mt-3 text-sm leading-relaxed">{profile.bio}</p>}

              {profile.phone && isOwn && (
                <p className="text-gray-400 text-xs mt-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  {profile.phone}
                </p>
              )}

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
        )}
      </div>

      {/* Buyer / Seller Toggle — only on own profile */}
      {isOwn && (
        <div className="flex justify-center mt-6">
          <div className="inline-flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => { setMode('buyer'); setBuyerTab('purchases'); }}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'buyer'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Buyer
            </button>
            <button
              onClick={() => setMode('seller')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'seller'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Seller
            </button>
          </div>
        </div>
      )}

      {/* ===== BUYER MODE ===== */}
      {isOwn && mode === 'buyer' && (
        <>
          <div className="flex gap-1 mt-6 border-b border-border">
            <button
              onClick={() => setBuyerTab('purchases')}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                buyerTab === 'purchases'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              My Purchases
            </button>
            <button
              onClick={() => setBuyerTab('wishlist')}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                buyerTab === 'wishlist'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Wishlist ({wishlist.length})
            </button>
          </div>

          <div className="mt-6">
            {buyerLoading ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : buyerTab === 'purchases' ? (
              /* Purchases */
              orders.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-4xl mb-3">
                    <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </p>
                  <p className="text-gray-500">No purchases yet</p>
                  <Link to="/browse" className="btn-primary mt-4 inline-block">
                    Browse Listings
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map(order => (
                    <Link
                      key={order.id}
                      to={`/orders/${order.id}`}
                      className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
                    >
                      {order.listing_image ? (
                        <img src={order.listing_image} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{order.listing_title}</h3>
                        <p className="text-sm text-gray-500">
                          From {order.seller_name} &middot; {new Date(order.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-gray-900">{formatPrice(order.total_price)}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          order.status === 'paid' ? 'bg-green-100 text-green-700' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          order.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            ) : (
              /* Wishlist */
              wishlist.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <p className="text-gray-500">Your wishlist is empty</p>
                  <Link to="/browse" className="btn-primary mt-4 inline-block">
                    Browse Listings
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {wishlist.map(listing => (
                    <div key={listing.id} className="relative">
                      <ListingCard listing={listing} />
                      <button
                        onClick={(e) => { e.preventDefault(); removeFromWishlist(listing.id); }}
                        className="absolute top-3 right-3 z-10 bg-white/90 hover:bg-red-50 rounded-full p-2 shadow-sm transition-colors"
                        title="Remove from wishlist"
                      >
                        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* ===== SELLER MODE (or viewing someone else's profile) ===== */}
      {(mode === 'seller' || !isOwn) && (
        <>
          {/* New listing success banner */}
          {newListingId && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-green-700 font-medium">Your listing has been published!</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mt-6 border-b border-border">
            {sellerTabs.map(t => (
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
                  <div key={listing.id} className={`relative ${newListingId && listing.id === parseInt(newListingId) ? 'ring-2 ring-amber-300 rounded-2xl' : ''}`}>
                    {newListingId && listing.id === parseInt(newListingId) && (
                      <span className="absolute -top-2 -left-2 z-20 bg-amber-400 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        Latest
                      </span>
                    )}
                    {tab === 'hidden' && (
                      <div className="absolute inset-0 bg-gray-900/10 rounded-2xl z-10 pointer-events-none flex items-end justify-center pb-4">
                        <span className="text-xs font-medium text-gray-500 bg-white/80 px-3 py-1 rounded-full">Hidden from buyers</span>
                      </div>
                    )}
                    <ListingCard listing={listing} />
                    {isOwn && (
                      <>
                        {/* Edit icon - top right of card */}
                        {(listing.status === 'active' || listing.status === 'hidden') && (
                          <Link
                            to={`/listings/${listing.id}/edit`}
                            className="absolute top-3 right-3 z-20 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white hover:shadow-md transition-all"
                            title="Edit listing"
                          >
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                        )}
                        {/* Hide/Unhide toggle */}
                        {listing.status === 'active' && (
                          <button
                            onClick={() => updateStatus(listing.id, 'hidden')}
                            className="absolute top-3 right-12 z-20 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white hover:shadow-md transition-all group"
                            title="Hide from buyers"
                          >
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.05 6.05m3.828 3.828l4.242 4.242M6.05 6.05l-1.414-1.414M6.05 6.05L3 3m3.05 3.05l4.243 4.243" />
                            </svg>
                          </button>
                        )}
                        {listing.status === 'hidden' && (
                          <button
                            onClick={() => updateStatus(listing.id, 'active')}
                            className="absolute top-3 right-12 z-20 w-8 h-8 bg-primary/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-primary hover:shadow-md transition-all"
                            title="Make visible to buyers"
                          >
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        )}
                        {listing.status === 'sold' && (
                          <button
                            onClick={() => updateStatus(listing.id, 'active')}
                            className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 text-xs py-1.5 px-4 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white hover:shadow-md transition-all text-gray-600 font-medium"
                          >
                            Relist
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
