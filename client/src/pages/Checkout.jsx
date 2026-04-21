import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPrice, firstName } from '../utils/formatPrice';

const PLATFORM_FEE_PERCENT = 5;
const YOCO_RATE = 0.0299; // 2.6% + VAT

function calcBuyerProtectionFee(itemPrice, courierFee) {
  const desiredMargin = itemPrice * PLATFORM_FEE_PERCENT / 100;
  const yocoCostOnItemAndCourier = YOCO_RATE * (itemPrice + courierFee);
  const fee = (desiredMargin + yocoCostOnItemAndCourier) / (1 - YOCO_RATE);
  return Math.round(fee);
}

const PARCEL_SIZES = [
  { key: 'small',     label: 'Small box',     desc: 'Toys, shoes, bottles',          maxKg: '2 kg' },
  { key: 'medium',    label: 'Medium box',    desc: 'Car seats, disassembled chairs', maxKg: '5 kg' },
  { key: 'large',     label: 'Large box',     desc: 'Prams (folded), play mats',     maxKg: '10 kg' },
  { key: 'oversized', label: 'Oversized',     desc: 'Cots, changing tables',          maxKg: '10+ kg' },
];

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
  const deliveryMethod = 'delivery';

  const [parcelSize, setParcelSize] = useState(null); // set once listing loads
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

  // Pre-fill phone from profile once auth resolves
  useEffect(() => {
    if (user?.phone && !form.buyerPhone) {
      setForm(prev => ({ ...prev, buyerPhone: user.phone }));
    }
  }, [user]);

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
          setParcelSize(data.listing.parcel_size || 'medium');
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
    if (deliveryMethod !== 'delivery' || !form.deliveryCity || !listing || !parcelSize) return;

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
        collectionPostalCode: listing.seller_postal_code || '',
        collectionProvince: listing.province,
        deliveryAddress: form.deliveryAddress,
        deliveryCity: form.deliveryCity,
        deliveryPostalCode: form.deliveryPostalCode,
        deliveryProvince: form.deliveryProvince,
        parcelSize,
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
  }, [deliveryMethod, form.deliveryCity, form.deliveryPostalCode, listing, parcelSize]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.deliveryAddress) {
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

      submitData.deliveryAddress = form.deliveryUnit
        ? `${form.deliveryUnit}, ${form.deliveryAddress}`
        : form.deliveryAddress;
      submitData.deliveryLat = form.deliveryLat;
      submitData.deliveryLng = form.deliveryLng;
      submitData.deliveryCity = form.deliveryCity;
      submitData.deliveryProvince = form.deliveryProvince;
      submitData.deliveryPostalCode = form.deliveryPostalCode;
      submitData.courierFee = courierFee;
      submitData.serviceLevelCode = selectedRate?.code || 'ECO';
      submitData.parcelSize = parcelSize;

      // Step 1: Create the order
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(submitData),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error);

      // Step 2: Navigate to server-side redirect endpoint — the server
      // creates the Yoco checkout and responds with a 302 to Yoco's hosted
      // page. This is a clean browser navigation (not JS-initiated) so
      // Yoco's page initialises correctly.
      window.location.href = `/api/payments/redirect/${orderData.order.id}`;
      return;
    } catch (err) {
      setError(err.message || 'Failed to process checkout');
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
  const hasCourierRate = deliveryMethod === 'delivery' && selectedRate && !ratesLoading;
  const courierFee = hasCourierRate ? Math.round(selectedRate.price * 100) : 0;
  const platformFee = hasCourierRate ? calcBuyerProtectionFee(itemPrice, courierFee) : null;
  const totalPrice = hasCourierRate ? itemPrice + platformFee + courierFee : null;

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
            {/* Delivery info banner */}
            <div className="card p-5 bg-primary/5 border-primary/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Delivered by The Courier Guy</p>
                  <p className="text-sm text-gray-600">Picked up from the seller and delivered to your door. Courier fee included in total.</p>
                </div>
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

                {user?.street_address && !form.deliveryAddress && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm(prev => ({
                        ...prev,
                        deliveryAddress: user.street_address,
                        deliveryCity: user.city || '',
                        deliveryProvince: user.province || '',
                        deliveryPostalCode: user.postal_code || '',
                      }));
                      if (addressInputRef.current) addressInputRef.current.value = user.street_address;
                    }}
                    className="w-full mb-4 p-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-left hover:border-primary/50 transition-colors"
                  >
                    <p className="text-sm font-medium text-primary">Use my profile address</p>
                    <p className="text-xs text-gray-500 mt-0.5">{user.street_address}</p>
                  </button>
                )}

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

            {/* Parcel Size — buyer confirms/changes the seller's recommendation */}
            {deliveryMethod === 'delivery' && (
              <div className="card p-6">
                <h2 className="font-display text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Parcel Size
                </h2>
                <p className="text-xs text-gray-500 mb-4">
                  The seller suggests <strong>{PARCEL_SIZES.find(p => p.key === listing.parcel_size)?.label || 'Medium box'}</strong>.
                  Please confirm or change — the courier fee depends on this and an incorrect size may result in a surcharge.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PARCEL_SIZES.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setParcelSize(p.key)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        parcelSize === p.key
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-sm text-gray-900">{p.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
                      <p className="text-xs text-gray-400 mt-1">Max {p.maxKg}</p>
                    </button>
                  ))}
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
                <p className="text-xs text-gray-500 -mt-2 mb-4">
                  Courier cut-off times may push orders placed late in the day to the next business day.
                </p>

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
                    {shippingRates.map((rate, i) => {
                      const deliveryDate = rate.deliveryDateTo || rate.deliveryDateFrom;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedRate(rate)}
                          className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                            selectedRate?.code === rate.code
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-border hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-900">{rate.service}</p>
                            <span className="font-bold text-primary">
                              {formatPrice(Math.round(rate.price * 100))}
                            </span>
                          </div>
                          {deliveryDate && (
                            <p className="text-sm text-gray-500 mt-1">
                              Estimated delivery: <span className="font-medium text-gray-700">{new Date(deliveryDate).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                              {rate.estimatedDays != null && rate.estimatedDays > 0 && (
                                <span className="text-gray-400"> ({rate.estimatedDays} day{rate.estimatedDays !== 1 ? 's' : ''})</span>
                              )}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
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

                {user?.phone && !form.buyerPhone && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, buyerPhone: user.phone }))}
                    className="w-full mb-4 p-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-left hover:border-primary/50 transition-colors"
                  >
                    <p className="text-sm font-medium text-primary">Use my profile number</p>
                    <p className="text-xs text-gray-500 mt-0.5">{user.phone}</p>
                  </button>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <div className="flex items-center border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary">
                    <span className="flex items-center gap-1.5 pl-3 pr-2 text-sm text-gray-500 bg-gray-50 border-r border-border self-stretch leading-[42px]">
                      <span className="text-base">🇿🇦</span> +27
                    </span>
                    <input
                      type="tel"
                      value={form.buyerPhone.replace(/^\+?27/, '')}
                      onChange={(e) => setForm(prev => ({ ...prev, buyerPhone: '+27' + e.target.value.replace(/[^\d]/g, '').slice(0, 9) }))}
                      placeholder="82 123 4567"
                      className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                      maxLength={12}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    For delivery coordination with The Courier Guy — not shared with the seller
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
                  placeholder="Any special delivery instructions for the courier..."
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
                disabled={submitting || (!!error && error !== 'Please enter a delivery address')}
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
                    Pay {totalPrice != null ? formatPrice(totalPrice) : '...'}
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
                <h3 className="font-medium text-gray-900">{listing.title}</h3>
                <p className="text-sm text-gray-500 capitalize">{listing.condition?.replace('_', ' ')}</p>
                <p className="text-sm text-gray-500">{listing.province}</p>
              </div>
            </div>

            <hr className="border-border mb-4" />

            {/* Price Breakdown */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Item price</span>
                <span className="font-medium">{formatPrice(itemPrice)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Buyer protection</span>
                <span className="font-medium text-right">
                  {ratesLoading
                    ? <span className="text-gray-400">...</span>
                    : platformFee != null
                      ? formatPrice(platformFee)
                      : <span className="text-gray-300">--</span>
                  }
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Courier{selectedRate ? ` (${selectedRate.service})` : ''}</span>
                <span className="font-medium text-right">
                  {ratesLoading
                    ? <span className="text-gray-400">...</span>
                    : selectedRate
                      ? formatPrice(courierFee)
                      : <span className="text-gray-300">--</span>
                  }
                </span>
              </div>
              <hr className="border-border" />
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{totalPrice != null ? formatPrice(totalPrice) : <span className="text-gray-300 font-normal text-base">--</span>}</span>
              </div>
              {!selectedRate && !ratesLoading && (
                <p className="text-xs text-gray-400 text-center">Add your delivery address to see final pricing</p>
              )}
              {selectedRate && (selectedRate.deliveryDateTo || selectedRate.deliveryDateFrom) && (
                <p className="text-xs text-gray-500">
                  Est. delivery: {new Date(selectedRate.deliveryDateTo || selectedRate.deliveryDateFrom).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
              )}
              {platformFee != null && (
                <div className="bg-green-50 rounded-lg px-3 py-2.5 mt-3">
                  <p className="text-xs text-green-800 leading-relaxed">
                    <strong>Buyer protection included.</strong> Your payment is held securely for 7 days after delivery. Full refund if something is wrong.
                  </p>
                </div>
              )}
            </div>

            {/* Seller Info */}
            <hr className="border-border my-4" />
            <div className="flex items-center gap-3">
              <img
                src={listing.seller_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${listing.seller_id}`}
                alt={firstName(listing.seller_name)}
                className="w-10 h-10 rounded-full bg-gray-100"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">Sold by {firstName(listing.seller_name)}</p>
                <p className="text-xs text-gray-500">{listing.seller_province}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
