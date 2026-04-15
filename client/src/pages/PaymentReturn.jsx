import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { formatPrice } from '../utils/formatPrice';

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
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

          if (data.status === 'paid' || data.paymentStatus === 'PAID' || data.paymentStatus === 'SETTLED') {
            setStatus('paid');
            // Fetch full order details
            fetch(`/api/orders/${orderId}`, { credentials: 'include' })
              .then(r => r.json())
              .then(d => setOrder(d.order));
            return;
          }

          if (data.paymentStatus === 'cancelled' || data.paymentStatus === 'CANCELLED') {
            setStatus('cancelled');
            return;
          }

          if (data.paymentStatus === 'expired' || data.paymentStatus === 'EXPIRED') {
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

        {isCollect ? (
          <p className="text-sm text-gray-500 mb-6">
            The seller has your contact details and will be in touch to arrange a collection time.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-2">
              The Courier Guy will collect from the seller and deliver to you.
            </p>
            <p className="text-xs text-gray-400 mb-6">
              You'll receive a confirmation email with a live tracking link.
            </p>
          </>
        )}

        <div className="space-y-3">
          <Link to={`/orders/${orderId}`} className="btn-primary w-full block text-center">
            {isCollect ? 'View order details' : 'Track my order'}
          </Link>
          <Link to="/browse" className="btn-outline w-full block text-center">
            Continue shopping
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
