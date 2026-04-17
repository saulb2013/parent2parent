import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/formatPrice';
import { tcgTrackingUrl } from '../utils/tracking';

// Map TCG's internal statuses to labels a buyer understands
function buyerStatusLabel(status) {
  const s = (status || '').toLowerCase().replace(/-/g, ' ');
  if (s.includes('delivered'))       return 'Delivered';
  if (s.includes('out for delivery'))return 'Out for delivery';
  if (s.includes('in transit'))      return 'On its way';
  if (s.includes('collection assigned') || s.includes('collected'))
    return 'Picked up from seller';
  if (s.includes('failed'))          return 'Delivery attempt failed';
  return s.charAt(0).toUpperCase() + s.slice(1); // fallback: title-case
}

export default function OrderConfirmation() {
  const { id } = useParams();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(null);

  useEffect(() => {
    fetch(`/api/orders/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setOrder(data.order);
        // Fetch tracking if it's a delivery order
        if (data.order?.delivery_method === 'delivery' && data.order?.tracking_reference) {
          fetch(`/api/shipping/track/${id}`, { credentials: 'include' })
            .then(r => r.json())
            .then(t => setTracking(t))
            .catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="font-display text-2xl font-bold">Order not found</h2>
        <Link to="/browse" className="btn-primary mt-4 inline-block">Browse Listings</Link>
      </div>
    );
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    shipped: 'bg-blue-100 text-blue-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-800',
  };

  const isDelivery = order.delivery_method === 'delivery';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-gray-900">{order.listing_title}</h1>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
              Delivery
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${statusColors[order.status]}`}>
              {order.status}
            </span>
          </div>
        </div>

        {/* Item */}
        <div className="flex gap-4 p-4 bg-gray-50 rounded-xl mb-6">
          {order.listing_image && (
            <img
              src={order.listing_image}
              alt={order.listing_title}
              className="w-24 h-24 rounded-lg object-cover"
            />
          )}
          <div>
            <Link to={`/listings/${order.listing_id}`} className="font-medium text-gray-900 hover:text-primary">
              {order.listing_title}
            </Link>
            <p className="text-sm text-gray-500 mt-1">Sold by {order.seller_name}</p>
          </div>
        </div>

        {/* Tracking panel — delivery orders only */}
        {isDelivery && (
          <div className="border border-gray-200 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Delivery tracking
              </p>
              {tracking?.status && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                  {buyerStatusLabel(tracking.status)}
                </span>
              )}
            </div>

            {order.tcg_waybill ? (
              <>
                <p className="text-sm text-gray-600 mb-1">Waybill number</p>
                <p className="text-lg font-semibold text-gray-900 mb-4 tabular">{order.tcg_waybill}</p>

                {tracking?.estimatedDelivery && (
                  <p className="text-sm text-gray-500 mb-4">
                    Estimated arrival:{' '}
                    <span className="font-medium text-gray-800">
                      {new Date(tracking.estimatedDelivery).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </p>
                )}

                <a
                  href={tcgTrackingUrl(order.tcg_waybill)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary block w-full text-center"
                >
                  Track on The Courier Guy
                </a>
              </>
            ) : order.tracking_reference ? (
              <div className="text-sm text-gray-600">
                <p className="mb-3">
                  Your waybill number is being generated by The Courier Guy — it's usually ready within an hour of booking.
                </p>
                <p>
                  Once it arrives, The Courier Guy will email it to you. You can then track your parcel at{' '}
                  <a href="https://www.thecourierguy.co.za/track" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                    thecourierguy.co.za/track
                  </a>
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Shipment is being booked. Tracking details will appear here shortly.
              </p>
            )}
          </div>
        )}

        {/* Delivery Info */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
            Delivering to
          </h3>
          <p className="text-gray-600">{order.delivery_city}, {order.delivery_province}</p>
        </div>

        {order.buyer_notes && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-2">Notes</h3>
            <p className="text-gray-600 text-sm">{order.buyer_notes}</p>
          </div>
        )}

        {/* Price Breakdown */}
        <hr className="border-border mb-4" />
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Item price</span>
            <span>{formatPrice(order.item_price)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Platform fee (5%)</span>
            <span>{formatPrice(order.platform_fee)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Courier</span>
            <span>{order.courier_fee ? formatPrice(order.courier_fee) : 'Included'}</span>
          </div>
          <hr className="border-border" />
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{formatPrice(order.total_price)}</span>
          </div>
        </div>

        {/* Payment status */}
        {order.status === 'paid' && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-green-700 font-medium flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Payment Complete
            </p>
          </div>
        )}

        {order.status === 'pending' && order.buyer_id === user?.id && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-yellow-700 font-medium mb-3">Payment Pending</p>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/payments/initiate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ orderId: order.id }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  const form = document.createElement('form');
                  form.method = 'GET';
                  form.action = data.paymentUrl;
                  document.body.appendChild(form);
                  form.submit();
                } catch (err) {
                  alert(err.message || 'Failed to initiate payment');
                }
              }}
              className="btn-primary w-full"
            >
              Complete Payment — {formatPrice(order.total_price)}
            </button>
          </div>
        )}

      </div>

      <div className="flex gap-3 mt-6">
        <Link to="/browse" className="btn-outline flex-1 text-center">Continue Shopping</Link>
        <Link to={`/profile/${user?.id}`} className="btn-outline flex-1 text-center">My Profile</Link>
      </div>
    </div>
  );
}
