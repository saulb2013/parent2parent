import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/formatPrice';

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

  const isCollect = order.delivery_method === 'collect';
  const isDelivery = order.delivery_method === 'delivery';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-gray-900">{order.listing_title}</h1>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              isCollect ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
            }`}>
              {isCollect ? 'Collection' : 'Delivery'}
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

        {/* Tracking panel — promoted above the receipt so buyers see
            the live courier status first. Only renders for delivery
            orders (collection is handled in the section below). */}
        {isDelivery && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              Tracking by The Courier Guy
            </p>
            {order.tracking_reference ? (
              <>
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-blue-200">
                  <div>
                    <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Tracking number</p>
                    <p className="text-base font-bold text-blue-900 tabular">{order.tracking_reference}</p>
                  </div>
                  {tracking?.status && (
                    <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-blue-600 text-white capitalize">
                      {tracking.status.replace(/-/g, ' ')}
                    </span>
                  )}
                </div>

                {tracking?.estimatedDelivery && (
                  <div className="mb-4">
                    <p className="text-xs text-blue-700 mb-0.5">Estimated delivery</p>
                    <p className="text-sm font-medium text-blue-900">
                      {new Date(tracking.estimatedDelivery).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}

                {tracking?.events?.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium text-blue-700 mb-2">Tracking history</p>
                    <div className="space-y-2">
                      {tracking.events.slice(0, 5).map((event, i) => (
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
                  <p className="text-xs text-blue-700">No scan events yet — check back after collection.</p>
                )}

                <p className="mt-4 pt-4 border-t border-blue-200 text-center text-xs text-blue-600">
                  Live tracking provided by The Courier Guy.
                </p>
              </>
            ) : (
              <p className="text-sm text-blue-800">
                Shipment is being booked. Tracking details will appear here shortly.
              </p>
            )}
          </div>
        )}

        {/* Delivery / Collection Info */}
        <div className="mb-6">
          {isCollect ? (
            <>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Collection
              </h3>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-gray-700">
                  Collect from <strong>{order.seller_name}</strong> in {order.delivery_city}, {order.delivery_province}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  The seller has your contact details and will be in touch to arrange a time and exact location.
                </p>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
                Delivery Address
              </h3>
              <p className="text-gray-600">{order.delivery_address}</p>
              {order.delivery_city && (
                <p className="text-sm text-gray-500">{order.delivery_city}, {order.delivery_province} {order.delivery_postal_code}</p>
              )}
            </>
          )}
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
          {isDelivery && (
            <div className="flex justify-between">
              <span className="text-gray-600">Courier (The Courier Guy)</span>
              <span>{order.courier_fee ? formatPrice(order.courier_fee) : 'Included'}</span>
            </div>
          )}
          {isCollect && (
            <div className="flex justify-between">
              <span className="text-gray-600">Collection</span>
              <span className="text-green-600">Free</span>
            </div>
          )}
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

        {order.status === 'pending' && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-yellow-700 font-medium">Payment Pending</p>
            <p className="text-xs text-yellow-600 mt-1">Your payment is still being processed.</p>
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
