import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';

// Public, token-gated tracking page. Linked from the buyer's
// "Track my order" email button so they don't need to be logged in.
// Only shows shipment-relevant info — never price, never full buyer
// or seller details — per the /public-track API's contract.
export default function PublicTrack() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Tracking link is missing a token — use the link from your confirmation email.');
      setLoading(false);
      return;
    }
    fetch(`/api/shipping/public-track/${id}?token=${encodeURIComponent(token)}`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error || 'Lookup failed')))
      .then(setData)
      .catch(err => setError(typeof err === 'string' ? err : 'Could not load tracking'))
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading) {
    return <div className="max-w-xl mx-auto px-4 py-20 text-center text-gray-500">Loading tracking…</div>;
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">Unable to load tracking</h1>
        <p className="text-gray-500 text-sm mb-6">{error}</p>
        <Link to="/" className="btn-primary inline-block">Go home</Link>
      </div>
    );
  }

  const isCollect = data.deliveryMethod === 'collect';
  const friendlyStatus = data.status ? data.status.replace(/-/g, ' ') : null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Tracking by The Courier Guy</p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
          {data.listingTitle}
        </h1>
      </div>

      {/* Live tracking panel */}
      {isCollect ? (
        <div className="card p-5 bg-blue-50 border-blue-100">
          <p className="text-sm text-blue-800">
            This is a collection order — the seller is arranging a time and location directly with the buyer. No courier tracking.
          </p>
        </div>
      ) : data.trackingReference ? (
        <TrackingPanel data={data} friendlyStatus={friendlyStatus} />
      ) : (
        <div className="card p-5 bg-amber-50 border-amber-100">
          <p className="text-sm text-amber-800">
            Shipment is being booked with The Courier Guy. Tracking details will appear here shortly — check back soon or wait for the confirmation email.
          </p>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-8">
        Need the full receipt?{' '}
        <Link to={`/orders/${id}`} className="text-primary hover:underline">Sign in to view your order</Link>.
      </p>
    </div>
  );
}

function TrackingPanel({ data, friendlyStatus }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-blue-200">
        <div>
          <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Tracking number</p>
          <p className="text-base font-bold text-blue-900 tabular">{data.trackingReference}</p>
        </div>
        {friendlyStatus && (
          <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-blue-600 text-white capitalize">
            {friendlyStatus}
          </span>
        )}
      </div>

      {data.estimatedDelivery && (
        <div className="mb-4">
          <p className="text-xs text-blue-700 mb-0.5">Estimated delivery</p>
          <p className="text-sm font-medium text-blue-900">
            {new Date(data.estimatedDelivery).toLocaleDateString('en-ZA', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            })}
          </p>
        </div>
      )}

      {data.events?.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-blue-700 mb-2">Tracking history</p>
          <div className="space-y-2">
            {data.events.slice(0, 8).map((event, i) => (
              <div key={i} className="text-xs text-blue-800 flex gap-2">
                <span className="text-blue-500 shrink-0 w-16">
                  {new Date(event.timestamp || event.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                </span>
                <span>{event.description || event.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-blue-700">No scan events yet. Check back after collection.</p>
      )}

      <p className="mt-4 pt-4 border-t border-blue-200 text-center text-xs text-blue-600">
        Live tracking provided by The Courier Guy.
      </p>
    </div>
  );
}
