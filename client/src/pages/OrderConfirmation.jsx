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

  const whatsappNumber = order.seller_phone?.replace(/[^0-9]/g, '');
  const whatsappMessage = encodeURIComponent(
    `Hi ${order.seller_name}! I just purchased your "${order.listing_title}" (Order #${order.id}) on Parent2Parent. I'd like to arrange ${isCollect ? 'collection' : 'the pickup for delivery'}.`
  );
  const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${whatsappMessage}` : null;

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
                  WhatsApp the seller to arrange a time and exact location.
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
              {order.tracking_reference ? (
                <div className="bg-blue-50 rounded-xl p-3 mt-3">
                  <p className="text-xs text-blue-700">
                    Shipment booked with The Courier Guy. Tracking: <strong>{order.tracking_reference}</strong>
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 rounded-xl p-3 mt-3">
                  <p className="text-xs text-amber-700">
                    Delivery by The Courier Guy. Shipment will be booked shortly.
                  </p>
                </div>
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

        {/* Tracking Info */}
        {order.tracking_reference && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
              Courier Tracking
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700">Tracking Number</span>
                <span className="text-sm font-bold text-blue-800">{order.tracking_reference}</span>
              </div>

              {tracking?.status && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Status</span>
                  <span className="text-sm font-medium text-blue-800 capitalize">{tracking.status.replace(/-/g, ' ')}</span>
                </div>
              )}

              {tracking?.estimatedDelivery && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Estimated Delivery</span>
                  <span className="text-sm font-medium text-blue-800">
                    {new Date(tracking.estimatedDelivery).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>

            {tracking?.events?.length > 0 && (
              <div className="mt-4 pt-3 border-t border-blue-200">
                <p className="text-xs font-medium text-blue-700 mb-2">Tracking History</p>
                <div className="space-y-2">
                  {tracking.events.slice(0, 5).map((event, i) => (
                    <div key={i} className="text-xs text-blue-600 flex gap-2">
                      <span className="text-blue-400 shrink-0">
                        {new Date(event.timestamp || event.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                      </span>
                      <span>{event.description || event.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <a
              href={`https://www.shiplogic.com/tracking/${order.tracking_reference}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full py-2.5 flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Track on The Courier Guy
            </a>
          </div>
        )}

        {/* WhatsApp seller */}
        {whatsappUrl && order.buyer_id === user?.id && (
          <div className="mt-4">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full py-3 flex items-center justify-center gap-2 rounded-xl font-medium transition-colors ${
                isCollect
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'btn-outline'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {isCollect ? 'WhatsApp Seller to Arrange Collection' : 'WhatsApp Seller'}
            </a>
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
