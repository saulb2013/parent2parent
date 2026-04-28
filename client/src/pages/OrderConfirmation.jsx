import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPrice, firstName } from '../utils/formatPrice';
import { tcgTrackingUrl } from '../utils/tracking';
import OrderStepper from '../components/OrderStepper';

function buyerStatusLabel(status) {
  const s = (status || '').toLowerCase().replace(/-/g, ' ');
  if (s.includes('delivered'))       return 'Delivered';
  if (s.includes('out for delivery'))return 'Out for delivery';
  if (s.includes('in transit'))      return 'On its way';
  if (s.includes('collection assigned') || s.includes('collected'))
    return 'Picked up from seller';
  if (s.includes('failed'))          return 'Delivery attempt failed';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escrowLabel(status) {
  if (status === 'holding') return 'Funds held securely';
  if (status === 'paused') return 'Dispute in progress';
  if (status === 'released') return 'Funds released to seller';
  if (status === 'refunded') return 'Refunded';
  return status;
}

function escrowColor(status) {
  if (status === 'holding') return 'bg-blue-50 border-blue-200 text-blue-800';
  if (status === 'paused') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  if (status === 'released') return 'bg-green-50 border-green-200 text-green-800';
  if (status === 'refunded') return 'bg-gray-50 border-gray-200 text-gray-600';
  return 'bg-gray-50 border-gray-200 text-gray-600';
}

function timeRemaining(releaseDate) {
  const diff = new Date(releaseDate) - new Date();
  if (diff <= 0) return 'Releasing soon...';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}, ${hours}h remaining`;
  return `${hours} hour${hours !== 1 ? 's' : ''} remaining`;
}

const DISPUTE_REASONS = [
  'Item significantly different from description or photos',
  'Item arrived damaged',
  'Wrong item received',
  'Item is counterfeit / fake',
];

const EVIDENCE_PROMPTS = {
  'Item significantly different from description or photos': 'Upload photos comparing what you received to the listing photos. Show the mismatch clearly.',
  'Item arrived damaged': 'Upload photos of the damage and the packaging it arrived in. Take these before using the item if possible.',
  'Wrong item received': 'Upload a clear photo of the item you received. We\'ll compare it to the listing.',
  'Item is counterfeit / fake': 'Upload close-up photos of brand labels, tags, stitching or any other detail that shows the item is not authentic.',
};

export default function OrderConfirmation() {
  const { id } = useParams();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [showConfirmReceipt, setShowConfirmReceipt] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputePhotos, setDisputePhotos] = useState([]);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeError, setDisputeError] = useState('');
  const [returnTracking, setReturnTracking] = useState('');
  const [sellerReturnAddress, setSellerReturnAddress] = useState('');
  const [addressSubmitting, setAddressSubmitting] = useState(false);

  const fetchOrder = () => {
    fetch(`/api/orders/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setOrder(data.order);
        if (data.order?.delivery_method === 'delivery' && data.order?.tracking_reference) {
          fetch(`/api/shipping/track/${id}`, { credentials: 'include' })
            .then(r => r.json())
            .then(t => setTracking(t))
            .catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const handleConfirmReceipt = async () => {
    setShowConfirmReceipt(false);
    setConfirming(true);
    try {
      const res = await fetch('/api/escrow/confirm-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchOrder();
    } catch (err) {
      alert(err.message || 'Failed to confirm receipt');
    } finally {
      setConfirming(false);
    }
  };

  const handleOpenDispute = async () => {
    if (!disputeReason) { setDisputeError('Please select a reason'); return; }
    if (disputePhotos.length === 0) { setDisputeError('Please upload at least one photo as evidence'); return; }
    setDisputeSubmitting(true);
    setDisputeError('');
    try {
      const formData = new FormData();
      formData.append('orderId', order.id);
      formData.append('reason', disputeReason);
      formData.append('description', disputeDesc);
      disputePhotos.forEach(file => formData.append('evidence', file));

      const res = await fetch('/api/disputes/open', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowDispute(false);
      setDisputePhotos([]);
      fetchOrder();
    } catch (err) {
      setDisputeError(err.message);
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const handleProvideAddress = async (disputeId) => {
    if (!sellerReturnAddress.trim()) { alert('Please enter your return address'); return; }
    setAddressSubmitting(true);
    try {
      const res = await fetch(`/api/disputes/${disputeId}/provide-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ returnAddress: sellerReturnAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchOrder();
    } catch (err) {
      alert(err.message || 'Failed to provide address');
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleReturnShipped = async (disputeId) => {
    if (!returnTracking.trim()) { alert('Please enter a tracking number'); return; }
    try {
      const res = await fetch(`/api/disputes/${disputeId}/return-shipped`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ returnTracking }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchOrder();
    } catch (err) {
      alert(err.message || 'Failed to update');
    }
  };

  const handleConfirmReturn = async (disputeId) => {
    if (!confirm('Confirm you received the returned item?')) return;
    try {
      const res = await fetch(`/api/disputes/${disputeId}/confirm-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchOrder();
    } catch (err) {
      alert(err.message || 'Failed to confirm return');
    }
  };

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

  const isDelivery = order.delivery_method === 'delivery';
  const isBuyer = order.buyer_id === user?.id;
  const isSeller = order.seller_id === user?.id;
  const hasEscrow = !!order.escrow_status;
  const hasDispute = !!order.dispute_id;

  // Can buyer confirm receipt?
  const canConfirm = isBuyer && hasEscrow && order.escrow_status === 'holding' && !hasDispute
    && ['paid', 'shipped', 'delivered'].includes(order.status);

  // Can buyer open dispute? (delivered, within 48hrs, escrow holding, no existing dispute)
  const canDispute = isBuyer && order.status === 'delivered' && order.escrow_status === 'holding' && !hasDispute
    && order.delivered_at && ((Date.now() - new Date(order.delivered_at).getTime()) / (1000 * 60 * 60) <= 48);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="card p-6">
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-4">{order.listing_title}</h1>
        <div className="mb-6">
          <OrderStepper status={order.status} deliveryMethod={order.delivery_method} hasTracking={!!order.tracking_reference} size="lg" />
        </div>

        {/* Item */}
        <div className="flex gap-4 p-4 bg-gray-50 rounded-xl mb-6">
          {order.listing_image && (
            <img src={order.listing_image} alt={order.listing_title} className="w-24 h-24 rounded-lg object-cover" />
          )}
          <div>
            <Link to={`/listings/${order.listing_id}`} className="font-medium text-gray-900 hover:text-primary">{order.listing_title}</Link>
            <p className="text-sm text-gray-500 mt-1">{isBuyer ? `Sold by ${firstName(order.seller_name)}` : `Bought by ${firstName(order.buyer_name)}`}</p>
          </div>
        </div>

        {/* Escrow Panel */}
        {hasEscrow && (
          <div className={`border rounded-xl p-5 mb-6 ${escrowColor(order.escrow_status)}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider">Payment Protection</p>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/60">
                {escrowLabel(order.escrow_status)}
              </span>
            </div>

            {order.escrow_status === 'holding' && (
              <>
                <p className="text-sm mt-2">
                  {order.status === 'delivered'
                    ? (isBuyer
                        ? 'Your item has been delivered. Confirm you\'re happy to release payment, or raise a problem within 48 hours.'
                        : 'The item has been delivered. Payment will release once the buyer confirms or after 48 hours.')
                    : (isBuyer
                        ? 'Your payment is held securely while your item is on its way. The 48-hour protection period starts once it\'s delivered.'
                        : 'The buyer\'s payment is held securely until their item is delivered and the protection period ends.')}
                </p>
                {order.status === 'delivered' && order.release_due_at && (
                  <p className="text-xs mt-2 opacity-75">
                    Auto-release: {timeRemaining(order.release_due_at)}
                  </p>
                )}
                {['paid', 'shipped'].includes(order.status) && (
                  <p className="text-xs mt-2 opacity-75">
                    Waiting for delivery — 7-day countdown starts then
                  </p>
                )}
              </>
            )}

            {order.escrow_status === 'paused' && (
              <p className="text-sm mt-2">
                A dispute has been raised. The hold timer is paused until the dispute is resolved.
              </p>
            )}

            {order.escrow_status === 'released' && (
              <p className="text-sm mt-2">
                {isBuyer
                  ? 'You confirmed receipt. The seller\'s payment has been released.'
                  : order.buyer_confirmed_at
                    ? 'The buyer confirmed receipt. Your payout is being processed.'
                    : 'The hold period has ended. Your payout is being processed.'}
              </p>
            )}

            {order.escrow_status === 'refunded' && (
              <p className="text-sm mt-2">This order has been refunded to the buyer.</p>
            )}
          </div>
        )}

        {/* Buyer Actions: Confirm Receipt + Report Problem */}
        {(canConfirm || canDispute) && !showConfirmReceipt && (
          <div className="flex gap-3 mb-6">
            {canConfirm && (
              <button onClick={() => setShowConfirmReceipt(true)} disabled={confirming} className="btn-primary flex-1 disabled:opacity-50">
                {confirming ? 'Confirming...' : 'Confirm Receipt'}
              </button>
            )}
            {canDispute && (
              <button onClick={() => setShowDispute(true)} className="btn-outline flex-1 !border-red-300 !text-red-600 hover:!bg-red-50 hover:!text-red-700">
                Report a Problem
              </button>
            )}
          </div>
        )}

        {/* Confirm Receipt confirmation */}
        {showConfirmReceipt && (
          <div className="border border-amber-200 rounded-xl p-5 mb-6 bg-amber-50/60">
            <h3 className="font-display text-lg font-semibold text-gray-900 mb-2">Are you sure?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Once you confirm, the payment will be <strong>released to the seller immediately</strong>. This cannot be undone.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              If something is wrong with the item, close this and tap <strong>Report a Problem</strong> instead.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmReceipt(false)} className="btn-outline flex-1">
                Go Back
              </button>
              <button onClick={handleConfirmReceipt} disabled={confirming} className="btn-primary flex-1 disabled:opacity-50">
                {confirming ? 'Releasing...' : 'Yes, Release Payment'}
              </button>
            </div>
          </div>
        )}

        {/* Dispute Form */}
        {showDispute && (
          <div className="border border-red-200 rounded-xl p-5 mb-6 bg-red-50/50">
            <h3 className="font-display text-lg font-semibold text-gray-900 mb-3">Report a Problem</h3>
            <p className="text-xs text-gray-500 mb-4">Use this only where the item is materially not as described, damaged, wrong, or fake. Please upload photos so we can resolve this fairly. Return postage is paid by the buyer.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select value={disputeReason} onChange={e => setDisputeReason(e.target.value)} className="input w-full">
                  <option value="">Select a reason...</option>
                  {DISPUTE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {disputeReason && EVIDENCE_PROMPTS[disputeReason] && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-900">
                    <strong>What to upload:</strong> {EVIDENCE_PROMPTS[disputeReason]}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Photos <span className="text-red-600">*</span>
                  <span className="text-xs font-normal text-gray-500 ml-1">(up to 6, max 5MB each)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={e => setDisputePhotos(Array.from(e.target.files).slice(0, 6))}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary-dark file:cursor-pointer"
                />
                {disputePhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {disputePhotos.map((file, i) => (
                      <div key={i} className="relative aspect-square bg-gray-100 rounded-md overflow-hidden">
                        <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Details (optional)</label>
                <textarea
                  value={disputeDesc}
                  onChange={e => setDisputeDesc(e.target.value)}
                  placeholder="Describe the issue..."
                  rows={3}
                  className="input w-full resize-none"
                />
              </div>
              {disputeError && <p className="text-sm text-red-600">{disputeError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowDispute(false)} className="btn-outline flex-1">Cancel</button>
                <button onClick={handleOpenDispute} disabled={disputeSubmitting} className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50">
                  {disputeSubmitting ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Dispute Status */}
        {hasDispute && (
          <div className="border border-yellow-200 rounded-xl p-5 mb-6 bg-yellow-50/50">
            <h3 className="font-display text-lg font-semibold text-gray-900 mb-2">Return in Progress</h3>
            <p className="text-sm text-gray-600 mb-1"><strong>Reason:</strong> {order.dispute_reason}</p>
            {order.dispute_description && <p className="text-sm text-gray-600 mb-2">{order.dispute_description}</p>}
            <p className="text-xs text-gray-400 mb-3">Opened {new Date(order.dispute_created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>

            {Array.isArray(order.dispute_evidence_photos) && order.dispute_evidence_photos.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Evidence photos</p>
                <div className="flex flex-wrap gap-2">
                  {order.dispute_evidence_photos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-md overflow-hidden bg-gray-200 hover:ring-2 hover:ring-primary">
                      <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1: Awaiting seller's return address */}
            {order.dispute_status === 'awaiting_address' && isBuyer && (
              <div className="bg-white rounded-lg p-4 border border-yellow-200">
                <p className="text-sm font-medium text-gray-800 mb-1">Waiting for the seller</p>
                <p className="text-sm text-gray-600">We've asked the seller to provide their return address. You'll get an email as soon as it's ready.</p>
              </div>
            )}

            {order.dispute_status === 'awaiting_address' && isSeller && (
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-4 border border-amber-200">
                  <p className="text-sm font-medium text-gray-800 mb-1">Provide your return address</p>
                  <p className="text-sm text-gray-600 mb-3">The buyer needs to ship the item back to you. Please provide the address where you'd like to receive it within 48 hours.</p>
                  <textarea
                    value={sellerReturnAddress}
                    onChange={e => setSellerReturnAddress(e.target.value)}
                    placeholder="Full return address (street, suburb, city, postal code)"
                    rows={3}
                    className="input w-full resize-none mb-3"
                  />
                  <button onClick={() => handleProvideAddress(order.dispute_id)} disabled={addressSubmitting} className="btn-primary w-full disabled:opacity-50">
                    {addressSubmitting ? 'Submitting...' : 'Submit Return Address'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Address provided, buyer must ship within 72 hours */}
            {order.dispute_status === 'open' && isBuyer && (
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-4 border border-gray-200 mb-3">
                  <p className="text-sm font-medium text-gray-800 mb-1">Return address</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{order.seller_return_address}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <p className="text-xs text-amber-800">
                    <strong>Ship within 72 hours.</strong> Return postage is paid by the buyer. The item must be returned in the same condition you received it.
                    {order.return_deadline && (
                      <> Deadline: {new Date(order.return_deadline).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>
                    )}
                  </p>
                </div>
                <input
                  type="text"
                  value={returnTracking}
                  onChange={e => setReturnTracking(e.target.value)}
                  placeholder="Return tracking number"
                  className="input w-full"
                />
                <button onClick={() => handleReturnShipped(order.dispute_id)} className="btn-primary w-full">
                  I've Shipped the Return
                </button>
              </div>
            )}

            {order.dispute_status === 'open' && isSeller && (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-800 mb-1">Waiting for the buyer to ship</p>
                <p className="text-sm text-gray-600">Your return address has been shared. The buyer has 72 hours to ship the item back.</p>
              </div>
            )}

            {/* Step 3: Return shipped, waiting for seller to confirm */}
            {order.dispute_status === 'return_shipping' && isSeller && (
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <p className="text-sm font-medium text-gray-800 mb-1">Return is on its way</p>
                  <p className="text-sm text-gray-600 mb-2">The buyer has shipped the item back to you.</p>
                  {order.dispute_return_tracking && (
                    <p className="text-sm text-gray-700"><strong>Tracking:</strong> {order.dispute_return_tracking}</p>
                  )}
                </div>
                <button onClick={() => handleConfirmReturn(order.dispute_id)} className="btn-primary w-full">
                  I've Received the Return
                </button>
              </div>
            )}

            {order.dispute_status === 'return_shipping' && isBuyer && (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-800 mb-1">Return shipped</p>
                <p className="text-sm text-gray-600">Waiting for the seller to confirm they received your return. Once confirmed, we'll process your refund.</p>
              </div>
            )}

            {/* Step 4: Return received, admin processes refund */}
            {order.dispute_status === 'return_received' && (
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <p className="text-sm font-medium text-gray-800 mb-1">Return received</p>
                <p className="text-sm text-gray-600">The seller has confirmed receipt. Your refund will be processed shortly — the money will go back to your original payment method.</p>
              </div>
            )}

            {order.dispute_status === 'admin_review' && (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-800 mb-1">Under review</p>
                <p className="text-sm text-gray-600">This return has been escalated to our team. We'll be in touch within 24 hours.</p>
              </div>
            )}

            {order.dispute_status === 'refunded' && (
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <p className="text-sm font-medium text-green-800">Refund issued</p>
                <p className="text-sm text-green-700">A full refund has been processed to your original payment method.</p>
              </div>
            )}

            {order.dispute_status === 'resolved_no_refund' && (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-800">Resolved</p>
                <p className="text-sm text-gray-600">This return request has been reviewed and resolved. No refund was issued.</p>
              </div>
            )}
          </div>
        )}

        {/* Tracking panel — delivery orders only, hide once delivered */}
        {isDelivery && order.status !== 'delivered' && (
          <div className="border border-gray-200 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Delivery tracking</p>
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
                <a href={tcgTrackingUrl(order.tcg_waybill)} target="_blank" rel="noopener noreferrer" className="btn-primary block w-full text-center">
                  Track on The Courier Guy
                </a>
              </>
            ) : order.tracking_reference ? (
              <div className="text-sm text-gray-600">
                <p className="mb-3">Your waybill number is being generated by The Courier Guy — it's usually ready within an hour of booking.</p>
                <p>Once it arrives, The Courier Guy will email it to you. You can then track your parcel at{' '}
                  <a href="https://www.thecourierguy.co.za/track" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">thecourierguy.co.za/track</a>
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-600">Shipment is being booked. Tracking details will appear here shortly.</p>
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
            <span className="text-gray-600">Buyer protection</span>
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
        {order.status === 'paid' && !hasEscrow && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-green-700 font-medium flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Payment Complete
            </p>
          </div>
        )}

        {order.status === 'pending' && isBuyer && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-yellow-700 font-medium mb-3">Payment Pending</p>
            <button
              onClick={() => { window.location.href = `/api/payments/redirect/${order.id}`; }}
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
