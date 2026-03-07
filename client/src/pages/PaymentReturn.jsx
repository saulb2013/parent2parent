import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/formatPrice';

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const orderId = searchParams.get('orderId');

  const [status, setStatus] = useState('checking');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      setStatus('error');
      setError('No order ID provided');
      return;
    }

    let attempts = 0;
    const maxAttempts = 10;

    function checkStatus() {
      fetch(`/api/payments/status/${orderId}`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.error) {
            setStatus('error');
            setError(data.error);
            return;
          }

          if (data.status === 'paid' || data.paymentStatus === 'PaymentInitiationRequestCompleted') {
            setStatus('paid');
            // Fetch full order details
            fetch(`/api/orders/${orderId}`, { credentials: 'include' })
              .then(r => r.json())
              .then(d => setOrder(d.order));
            return;
          }

          if (data.paymentStatus === 'cancelled') {
            setStatus('cancelled');
            return;
          }

          if (data.paymentStatus === 'expired') {
            setStatus('expired');
            return;
          }

          // Still pending — poll a few more times
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 2000);
          } else {
            setStatus('pending');
            fetch(`/api/orders/${orderId}`, { credentials: 'include' })
              .then(r => r.json())
              .then(d => setOrder(d.order));
          }
        })
        .catch(() => {
          setStatus('error');
          setError('Failed to check payment status');
        });
    }

    checkStatus();
  }, [orderId]);

  if (status === 'checking') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">Verifying Payment</h2>
        <p className="text-gray-500">Please wait while we confirm your payment...</p>
      </div>
    );
  }

  if (status === 'paid') {
    const isCollect = order?.delivery_method === 'collect';
    const whatsappNumber = order?.seller_phone?.replace(/[^0-9]/g, '');
    const whatsappMessage = encodeURIComponent(
      `Hi ${order?.seller_name}! I just paid for your "${order?.listing_title}" (Order #${order?.id}) on Parent2Parent. I'd like to arrange ${isCollect ? 'collection' : 'the pickup for delivery'}.`
    );
    const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${whatsappMessage}` : null;

    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-3xl font-bold text-green-800 mb-2">Payment Successful!</h2>
        <p className="text-gray-600 mb-2">
          {order ? `You paid ${formatPrice(order.total_price)} for "${order.listing_title}"` : 'Your payment has been confirmed.'}
        </p>

        {isCollect && (
          <p className="text-sm text-gray-500 mb-6">
            WhatsApp the seller below to arrange collection.
          </p>
        )}
        {!isCollect && (
          <p className="text-sm text-gray-500 mb-6">
            The Courier Guy will handle delivery. The seller will be notified.
          </p>
        )}

        <div className="space-y-3">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-600 text-white w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp Seller
            </a>
          )}
          <Link to={`/orders/${orderId}`} className="btn-primary w-full block text-center">
            View Order Details
          </Link>
          <Link to="/browse" className="btn-outline w-full block text-center">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-bold text-red-800 mb-2">Payment Cancelled</h2>
        <p className="text-gray-600 mb-6">Your payment was cancelled. No money has been charged.</p>
        <div className="space-y-3">
          <Link to={`/orders/${orderId}`} className="btn-primary w-full block text-center">
            Try Again
          </Link>
          <Link to="/browse" className="btn-outline w-full block text-center">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-bold text-yellow-800 mb-2">Payment Expired</h2>
        <p className="text-gray-600 mb-6">The payment session has expired. Please try again.</p>
        <div className="space-y-3">
          <Link to={`/orders/${orderId}`} className="btn-primary w-full block text-center">
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-bold text-yellow-800 mb-2">Payment Processing</h2>
        <p className="text-gray-600 mb-6">Your payment is still being processed. This may take a few minutes.</p>
        <div className="space-y-3">
          <Link to={`/orders/${orderId}`} className="btn-primary w-full block text-center">
            View Order
          </Link>
          <Link to="/browse" className="btn-outline w-full block text-center">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="font-display text-2xl font-bold text-red-800 mb-2">Something Went Wrong</h2>
      <p className="text-gray-600 mb-6">{error || 'An unexpected error occurred.'}</p>
      <Link to="/browse" className="btn-primary inline-block">Browse Listings</Link>
    </div>
  );
}
