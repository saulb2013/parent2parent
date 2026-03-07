import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/formatPrice';

const PLATFORM_FEE_PERCENT = 5;

export default function Checkout() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState(null); // 'collect' or 'delivery'

  const [shippingRates, setShippingRates] = useState([]);
  const [selectedRate, setSelectedRate] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState('');

  const [form, setForm] = useState({
    deliveryAddress: '',
    deliveryUnit: '',
    deliveryLat: null,
    deliveryLng: null,
    deliveryCity: '',
    deliveryProvince: '',
    deliveryPostalCode: '',
    buyerPhone: user?.phone || '',
    buyerNotes: '',
  });

  // Redirect if not logged in (wait for auth to finish loading)
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { state: { from: `/checkout/${id}` } });
    }
  }, [user, authLoading, navigate, id]);

  // Load listing
  useEffect(() => {
    fetch(`/api/listings/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.listing) {
          if (data.listing.seller_id === user?.id) {
            setError('You cannot buy your own listing');
          } else if (data.listing.status !== 'active') {
            setError('This listing is no longer available');
          }
          setListing(data.listing);
        }
      })
      .catch(() => setError('Failed to load listing'))
      .finally(() => setLoading(false));
  }, [id, user]);

  // Load Google Maps Places API and initialize autocomplete
  useEffect(() => {
    if (deliveryMethod !== 'delivery') return;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key not set');
      return;
    }

    function initAutocomplete() {
      if (!addressInputRef.current || !window.google?.maps?.places) return;
      if (autocompleteRef.current) return;

      setMapsLoaded(true);
      autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        componentRestrictions: { country: 'za' },
        fields: ['formatted_address', 'geometry', 'address_components'],
        types: ['address'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (!place.geometry) return;

        let city = '';
        let province = '';
        let postalCode = '';

        for (const comp of place.address_components) {
          if (comp.types.includes('locality')) city = comp.long_name;
          if (comp.types.includes('administrative_area_level_1')) province = comp.long_name;
          if (comp.types.includes('postal_code')) postalCode = comp.long_name;
        }

        setForm(prev => ({
          ...prev,
          deliveryAddress: place.formatted_address,
          deliveryLat: place.geometry.location.lat(),
          deliveryLng: place.geometry.location.lng(),
          deliveryCity: city,
          deliveryProvince: province,
          deliveryPostalCode: postalCode,
        }));
      });
    }

    if (window.google?.maps?.places) {
      // Reset ref so it can reinitialize on a new input element
      autocompleteRef.current = null;
      setTimeout(initAutocomplete, 100);
      return;
    }

    if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__initGoogleMapsAutocomplete`;
      script.async = true;
      document.head.appendChild(script);
    }

    window.__initGoogleMapsAutocomplete = initAutocomplete;

    const interval = setInterval(() => {
      if (window.google?.maps?.places && addressInputRef.current) {
        initAutocomplete();
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [deliveryMethod, loading]);

  // Fetch shipping rates when delivery address is complete
  useEffect(() => {
    if (deliveryMethod !== 'delivery' || !form.deliveryCity || !listing) return;

    setRatesLoading(true);
    setRatesError('');
    setShippingRates([]);
    setSelectedRate(null);

    fetch('/api/shipping/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        collectionAddress: listing.city,
        collectionCity: listing.city,
        collectionPostalCode: '',
        collectionProvince: listing.province,
        deliveryAddress: form.deliveryAddress,
        deliveryCity: form.deliveryCity,
        deliveryPostalCode: form.deliveryPostalCode,
        deliveryProvince: form.deliveryProvince,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setRatesError(data.error);
        } else if (data.rates?.length) {
          setShippingRates(data.rates);
          setSelectedRate(data.rates[0]);
        } else {
          setRatesError('No delivery options available for this route');
        }
      })
      .catch(() => setRatesError('Could not fetch delivery quotes'))
      .finally(() => setRatesLoading(false));
  }, [deliveryMethod, form.deliveryCity, form.deliveryPostalCode, listing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deliveryMethod) {
      setError('Please select a delivery method');
      return;
    }
    if (deliveryMethod === 'delivery' && !form.deliveryAddress) {
      setError('Please enter a delivery address');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const submitData = {
        listingId: parseInt(id),
        deliveryMethod,
        buyerPhone: form.buyerPhone,
        buyerNotes: form.buyerNotes,
      };

      if (deliveryMethod === 'delivery') {
        submitData.deliveryAddress = form.deliveryUnit
          ? `${form.deliveryUnit}, ${form.deliveryAddress}`
          : form.deliveryAddress;
        submitData.deliveryLat = form.deliveryLat;
        submitData.deliveryLng = form.deliveryLng;
        submitData.deliveryCity = form.deliveryCity;
        submitData.deliveryProvince = form.deliveryProvince;
        submitData.deliveryPostalCode = form.deliveryPostalCode;
      } else {
        // Collection — use seller's location as address
        submitData.deliveryAddress = `Collect from ${listing.city}, ${listing.province}`;
        submitData.deliveryCity = listing.city;
        submitData.deliveryProvince = listing.province;
      }

      // Step 1: Create the order
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(submitData),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error);

      // Step 2: Immediately initiate payment — redirect to Stitch
      const payRes = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: orderData.order.id }),
      });

      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error || 'Failed to initiate payment');

      // Redirect to Stitch payment page
      window.location.href = payData.paymentUrl;
    } catch (err) {
      setError(err.message || 'Failed to process checkout');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="font-display text-2xl font-bold">Listing not found</h2>
        <Link to="/browse" className="btn-primary mt-4 inline-block">Browse Listings</Link>
      </div>
    );
  }

  const itemPrice = listing.price;
  const platformFee = Math.round(itemPrice * PLATFORM_FEE_PERCENT / 100);
  const totalPrice = itemPrice + platformFee;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-primary">Home</Link>
        <span>/</span>
        <Link to={`/listings/${id}`} className="hover:text-primary">Listing</Link>
        <span>/</span>
        <span className="text-gray-800">Checkout</span>
      </nav>

      <h1 className="font-display text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Delivery Method */}
            <div className="card p-6">
              <h2 className="font-display text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                How would you like to get your item?
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Collect Option */}
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('collect')}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${
                    deliveryMethod === 'collect'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      deliveryMethod === 'collect' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900">Collect</h3>
                  </div>
                  <p className="text-sm text-gray-500">
                    Pay online, then WhatsApp the seller to arrange collection from <strong>{listing.city}, {listing.province}</strong>
                  </p>
                  <p className="text-xs text-primary font-medium mt-2">Free — no delivery fee</p>
                </button>

                {/* Delivery Option */}
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('delivery')}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${
                    deliveryMethod === 'delivery'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      deliveryMethod === 'delivery' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900">Deliver</h3>
                  </div>
                  <p className="text-sm text-gray-500">
                    The Courier Guy picks up from seller and delivers to your door
                  </p>
                  <p className="text-xs text-amber-600 font-medium mt-2">Courier fee paid separately to The Courier Guy</p>
                </button>
              </div>
            </div>

            {/* Delivery Address — only show for delivery method */}
            {deliveryMethod === 'delivery' && (
              <div className="card p-6">
                <h2 className="font-display text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Delivery Address
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address
                    </label>
                    <input
                      ref={addressInputRef}
                      type="text"
                      placeholder="Start typing your address..."
                      defaultValue={form.deliveryAddress}
                      onChange={(e) => {
                        if (!autocompleteRef.current) {
                          setForm(prev => ({ ...prev, deliveryAddress: e.target.value }));
                        }
                      }}
                      className="input w-full"
                      required
                    />
                    {mapsLoaded && (
                      <p className="text-xs text-gray-400 mt-1">Powered by Google Maps</p>
                    )}
                    {!mapsLoaded && !import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
                      <p className="text-xs text-amber-500 mt-1">
                        Address autocomplete unavailable — type your full address manually
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit / Apartment / Building (Optional)
                    </label>
                    <input
                      type="text"
                      value={form.deliveryUnit}
                      onChange={(e) => setForm(prev => ({ ...prev, deliveryUnit: e.target.value }))}
                      placeholder="e.g. Unit 4, Block B, Sunset Heights"
                      className="input w-full"
                    />
                  </div>

                  {form.deliveryCity && (
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-gray-500 block text-xs">City</span>
                        <span className="font-medium">{form.deliveryCity}</span>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-gray-500 block text-xs">Province</span>
                        <span className="font-medium">{form.deliveryProvince}</span>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-gray-500 block text-xs">Postal Code</span>
                        <span className="font-medium">{form.deliveryPostalCode}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Shipping Rates — show after delivery address is entered */}
            {deliveryMethod === 'delivery' && form.deliveryCity && (
              <div className="card p-6">
                <h2 className="font-display text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                  </svg>
                  Delivery Options
                </h2>

                {ratesLoading && (
                  <div className="flex items-center gap-3 py-6 justify-center text-gray-500">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Getting delivery quotes...
                  </div>
                )}

                {ratesError && (
                  <div className="bg-amber-50 text-amber-700 p-4 rounded-xl text-sm">
                    {ratesError}
                  </div>
                )}

                {shippingRates.length > 0 && (
                  <div className="space-y-3">
                    {shippingRates.map((rate, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedRate(rate)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                          selectedRate?.code === rate.code
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border hover:border-gray-300'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-gray-900">{rate.service}</p>
                          {rate.estimatedDays && (
                            <p className="text-xs text-gray-500 mt-1">
                              Est. {rate.estimatedDays} business day{rate.estimatedDays !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <span className="font-bold text-primary">
                          {formatPrice(Math.round(rate.price * 100))}
                        </span>
                      </button>
                    ))}
                    <p className="text-xs text-gray-400 mt-2">
                      Courier fee is paid separately to The Courier Guy on collection/delivery.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Collection info — only show for collect method */}
            {deliveryMethod === 'collect' && (
              <div className="card p-6">
                <h2 className="font-display text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Collection Details
                </h2>
                <div className="bg-primary/5 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-gray-800">Collect from {listing.seller_name}</p>
                      <p className="text-sm text-gray-500">{listing.city}, {listing.province}</p>
                    </div>
                  </div>
                  <hr className="border-primary/10 my-3" />
                  <p className="text-sm text-gray-600">
                    After payment, you'll be able to WhatsApp the seller to arrange a convenient time and exact location for collection.
                  </p>
                </div>
              </div>
            )}

            {/* Contact Details */}
            {deliveryMethod && (
              <div className="card p-6">
                <h2 className="font-display text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Contact Details
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={form.buyerPhone}
                    onChange={(e) => setForm(prev => ({ ...prev, buyerPhone: e.target.value }))}
                    placeholder="+27 XX XXX XXXX"
                    className="input w-full"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {deliveryMethod === 'collect' ? 'For coordinating collection with the seller' : 'For delivery coordination'}
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            {deliveryMethod && (
              <div className="card p-6">
                <h2 className="font-display text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  Notes (Optional)
                </h2>

                <textarea
                  value={form.buyerNotes}
                  onChange={(e) => setForm(prev => ({ ...prev, buyerNotes: e.target.value }))}
                  placeholder={deliveryMethod === 'collect'
                    ? 'Any message for the seller about collection...'
                    : 'Any special delivery instructions or message for the seller...'
                  }
                  rows={3}
                  className="input w-full resize-none"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{error}</div>
            )}

            {deliveryMethod && (
              <button
                type="submit"
                disabled={submitting || (!!error && error !== 'Please select a delivery address' && error !== 'Please select a delivery method')}
                className="btn-primary w-full text-lg py-4 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Pay {formatPrice(totalPrice)} — Secure EFT
                  </>
                )}
              </button>
            )}
          </form>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-24">
            <h2 className="font-display text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>

            {/* Item */}
            <div className="flex gap-4 mb-6">
              <img
                src={listing.images?.[0]?.url || 'https://picsum.photos/seed/default/200/200'}
                alt={listing.title}
                className="w-20 h-20 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">{listing.title}</h3>
                <p className="text-sm text-gray-500 capitalize">{listing.condition?.replace('_', ' ')}</p>
                <p className="text-sm text-gray-500">{listing.city}, {listing.province}</p>
              </div>
            </div>

            <hr className="border-border mb-4" />

            {/* Price Breakdown */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Item price</span>
                <span className="font-medium">{formatPrice(itemPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Platform fee ({PLATFORM_FEE_PERCENT}%)</span>
                <span className="font-medium">{formatPrice(platformFee)}</span>
              </div>
              {deliveryMethod === 'delivery' && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Courier (The Courier Guy)</span>
                  <span className="font-medium text-amber-600">
                    {selectedRate ? formatPrice(Math.round(selectedRate.price * 100)) : 'Select option above'}
                  </span>
                </div>
              )}
              {deliveryMethod === 'collect' && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Collection</span>
                  <span className="font-medium text-green-600">Free</span>
                </div>
              )}
              <hr className="border-border" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatPrice(totalPrice)}</span>
              </div>
              {deliveryMethod === 'delivery' && selectedRate && (
                <p className="text-xs text-amber-600">+ {formatPrice(Math.round(selectedRate.price * 100))} courier fee ({selectedRate.service})</p>
              )}
            </div>

            {/* Seller Info */}
            <hr className="border-border my-4" />
            <div className="flex items-center gap-3">
              <img
                src={listing.seller_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${listing.seller_id}`}
                alt={listing.seller_name}
                className="w-10 h-10 rounded-full bg-gray-100"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">Sold by {listing.seller_name}</p>
                <p className="text-xs text-gray-500">{listing.seller_city}, {listing.seller_province}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
