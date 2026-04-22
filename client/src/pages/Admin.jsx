import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/formatPrice';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function daysAgo(d) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
}
function daysUntil(d) {
  if (!d) return '';
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'now';
  if (diff === 1) return 'in 1 day';
  return `in ${diff} days`;
}

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('payouts');
  const [payouts, setPayouts] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [escrows, setEscrows] = useState({ holds: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(null);
  const [payoutFilter, setPayoutFilter] = useState('pending');

  useEffect(() => {
    fetch('/api/admin/revenue', { credentials: 'include' })
      .then(r => {
        if (!r.ok) { setAuthorized(false); return null; }
        setAuthorized(true);
        return r.json();
      })
      .then(data => { if (data) setRevenue(data); })
      .catch(() => setAuthorized(false))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!authorized) return;
    if (tab === 'payouts') {
      fetch(`/api/admin/payouts?status=${payoutFilter}`, { credentials: 'include' })
        .then(r => r.json()).then(d => setPayouts(d.payouts || []));
    } else if (tab === 'disputes') {
      fetch('/api/admin/disputes', { credentials: 'include' })
        .then(r => r.json()).then(d => setDisputes(d.disputes || []));
    } else if (tab === 'escrow') {
      fetch('/api/admin/escrow', { credentials: 'include' })
        .then(r => r.json()).then(d => setEscrows(d));
    }
  }, [authorized, tab, payoutFilter]);

  const markPaid = async (id) => {
    const adminNotes = prompt('Enter EFT reference (e.g. "FNB ref 12345"):');
    if (adminNotes === null) return;
    const res = await fetch(`/api/admin/payouts/${id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ adminNotes }),
    });
    if (res.ok) {
      setPayouts(prev => prev.filter(p => p.id !== id));
    }
  };

  const resolveDispute = async (id, resolution) => {
    const label = resolution === 'refund'
      ? 'This will refund the FULL amount to the buyer via Yoco. Add notes:'
      : 'This will resume the escrow timer and release funds to the seller. Add notes:';
    const adminNotes = prompt(label);
    if (adminNotes === null) return;
    if (resolution === 'refund' && !confirm('CONFIRM: Issue a full Yoco refund to the buyer\'s card?')) return;
    const res = await fetch(`/api/admin/disputes/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ resolution, adminNotes }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    // Refresh disputes
    fetch('/api/admin/disputes', { credentials: 'include' })
      .then(r => r.json()).then(d => setDisputes(d.disputes || []));
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="font-display text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-gray-500 mt-2">You need to be logged in as an admin to view this page.</p>
        <a href="/login" className="btn-primary mt-4 inline-block">Log In</a>
      </div>
    );
  }

  const pendingPayoutCount = payoutFilter === 'pending' ? payouts.length : 0;
  const activeDisputeCount = disputes.filter(d => ['awaiting_address', 'open', 'return_shipping', 'return_received', 'admin_review'].includes(d.status)).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">All amounts are what buyers paid. Yoco takes ~2.6% processing fee before it reaches your bank.</p>

      {/* Revenue Summary */}
      {revenue && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Buyer Protection Collected</p>
              <p className="text-2xl font-bold text-primary">{formatPrice(Number(revenue.total_revenue))}</p>
              <p className="text-xs text-gray-400 mt-1">Total fees charged to buyers</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Yoco Fees (est.)</p>
              <p className="text-2xl font-bold text-red-500">-{formatPrice(Number(revenue.estimated_yoco_fees))}</p>
              <p className="text-xs text-gray-400 mt-1">~2.99% of all buyer payments</p>
            </div>
            <div className="card p-4 border-primary/30">
              <p className="text-xs text-primary uppercase tracking-wider font-semibold mb-1">Your Net Revenue</p>
              <p className="text-2xl font-bold text-primary">{formatPrice(Number(revenue.net_revenue))}</p>
              <p className="text-xs text-gray-400 mt-1">What you actually keep</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">In Escrow</p>
              <p className="text-2xl font-bold text-blue-600">{formatPrice(Number(revenue.holding_for_sellers))}</p>
              <p className="text-xs text-gray-400 mt-1">Awaiting delivery + 48 hours</p>
            </div>
            <div className="card p-4 border-orange-200">
              <p className="text-xs text-orange-600 uppercase tracking-wider font-semibold mb-1">You Need to EFT</p>
              <p className="text-2xl font-bold text-orange-600">{formatPrice(Number(revenue.owed_to_sellers))}</p>
              <p className="text-xs text-gray-400 mt-1">Escrow released, sellers waiting</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Already Paid Out</p>
              <p className="text-2xl font-bold text-green-600">{formatPrice(Number(revenue.paid_to_sellers))}</p>
              <p className="text-xs text-gray-400 mt-1">EFTs completed</p>
            </div>
          </div>
        </>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: 'payouts', label: 'Seller Payouts' },
          { key: 'disputes', label: 'Disputes' },
          { key: 'escrow', label: 'Escrow Holds' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
            {t.key === 'disputes' && activeDisputeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{activeDisputeCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ───── PAYOUTS TAB ───── */}
      {tab === 'payouts' && (
        <div>
          <div className="flex gap-2 mb-4">
            {['pending', 'paid'].map(f => (
              <button key={f} onClick={() => setPayoutFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${payoutFilter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f}
              </button>
            ))}
          </div>

          {payouts.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-500 font-medium">{payoutFilter === 'pending' ? 'No pending payouts' : 'No completed payouts yet'}</p>
              <p className="text-xs text-gray-400 mt-1">{payoutFilter === 'pending' ? 'When a buyer\'s 48-hour escrow expires or they confirm receipt, the seller\'s payout will appear here.' : 'Once you EFT a seller and mark it paid, it moves here.'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payouts.map(p => (
                <div key={p.id} className={`card p-5 ${p.status === 'pending' ? 'border-l-4 border-l-orange-400' : ''}`}>
                  {/* Step indicator */}
                  {p.status === 'pending' && (
                    <div className="bg-orange-50 rounded-lg px-4 py-3 mb-4 text-sm">
                      <p className="font-semibold text-orange-800 mb-1">Action required: EFT this seller</p>
                      <ol className="text-orange-700 text-xs space-y-1 list-decimal list-inside">
                        <li>Open your banking app</li>
                        <li>EFT <strong>{formatPrice(p.amount)}</strong> to <strong>{p.seller_name}</strong> (get their bank details from them)</li>
                        <li>Click "Mark as Paid" below and paste the EFT reference</li>
                      </ol>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-lg">{p.listing_title}</p>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm"><span className="text-gray-500">Pay to:</span> <strong>{p.seller_name}</strong></p>
                        <p className="text-sm text-gray-500">{p.seller_email}</p>
                        {p.seller_phone && <p className="text-sm text-gray-500">{p.seller_phone}</p>}
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                        <span>Order #{p.order_id}</span>
                        <span>Sold {fmtDate(p.created_at)}</span>
                        {p.status === 'pending' && <span className="text-orange-600 font-medium">Waiting {daysAgo(p.created_at)}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold text-primary">{formatPrice(p.amount)}</p>
                      <p className="text-xs text-gray-400 mt-1">Buyer protection: {formatPrice(p.platform_fee)}</p>
                    </div>
                  </div>

                  {p.status === 'pending' && (
                    <button onClick={() => markPaid(p.id)} className="btn-accent mt-4 w-full text-sm !py-3 font-semibold">
                      I've Sent the EFT — Mark as Paid
                    </button>
                  )}
                  {p.status === 'paid' && (
                    <div className="mt-3 bg-green-50 border border-green-100 rounded-lg p-3">
                      <p className="text-sm text-green-700 font-medium">Paid on {fmtDate(p.paid_at)}</p>
                      {p.admin_notes && <p className="text-xs text-green-600 mt-1">Ref: {p.admin_notes}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───── DISPUTES TAB ───── */}
      {tab === 'disputes' && (
        <div>
          {disputes.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-500 font-medium">No disputes</p>
              <p className="text-xs text-gray-400 mt-1">If a buyer reports a problem within 48 hours of delivery, it appears here. You'll mediate and decide whether to refund.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {disputes.map(d => {
                const isActive = ['awaiting_address', 'open', 'return_shipping', 'return_received', 'admin_review'].includes(d.status);
                const returnShippingDays = d.return_shipped_at ? Math.floor((Date.now() - new Date(d.return_shipped_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                const returnShippingStale = d.status === 'return_shipping' && returnShippingDays >= 7;
                const returnReceivedDays = d.seller_confirmed_return_at ? Math.floor((Date.now() - new Date(d.seller_confirmed_return_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                const needsYourAction = ['return_received', 'admin_review'].includes(d.status) || returnShippingStale;

                return (
                  <div key={d.id} className={`card p-5 ${needsYourAction ? 'border-l-4 border-l-red-400' : isActive ? 'border-l-4 border-l-yellow-400' : ''}`}>
                    {/* Action needed: return_received or admin_review */}
                    {d.status === 'return_received' && (
                      <div className="bg-red-50 rounded-lg px-4 py-3 mb-4 text-sm">
                        <p className="font-semibold text-red-800 mb-1">Action required: Process refund</p>
                        <p className="text-red-700 text-xs">The seller has received the returned item{returnReceivedDays > 0 ? ` (${returnReceivedDays} day${returnReceivedDays === 1 ? '' : 's'} ago)` : ''}. Issue a full Yoco refund to the buyer, or resolve without refund if the claim was invalid.</p>
                      </div>
                    )}

                    {d.status === 'admin_review' && (
                      <div className="bg-red-50 rounded-lg px-4 py-3 mb-4 text-sm">
                        <p className="font-semibold text-red-800 mb-1">Action required: Escalated dispute</p>
                        <p className="text-red-700 text-xs">This dispute was auto-escalated because a deadline was missed. Review the situation and decide: refund the buyer or release payment to the seller.</p>
                      </div>
                    )}

                    {/* Waiting states with time indicators */}
                    {d.status === 'awaiting_address' && (
                      <div className="bg-yellow-50 rounded-lg px-4 py-3 mb-4 text-sm">
                        <p className="font-semibold text-yellow-800 mb-1">Waiting: Seller to provide return address</p>
                        <p className="text-yellow-700 text-xs">Opened {daysAgo(d.created_at)}. Auto-escalates to you if no address within 48 hours{d.created_at ? ` (${daysUntil(new Date(new Date(d.created_at).getTime() + 48 * 60 * 60 * 1000))})` : ''}.</p>
                      </div>
                    )}

                    {d.status === 'open' && (
                      <div className="bg-yellow-50 rounded-lg px-4 py-3 mb-4 text-sm">
                        <p className="font-semibold text-yellow-800 mb-1">Waiting: Buyer to ship the return</p>
                        <p className="text-yellow-700 text-xs">Seller provided address {daysAgo(d.seller_address_provided_at)}. Buyer must ship within 72 hours{d.return_deadline ? ` (${daysUntil(new Date(d.return_deadline))})` : ''}. Auto-escalates if missed.</p>
                      </div>
                    )}

                    {d.status === 'return_shipping' && !returnShippingStale && (
                      <div className="bg-blue-50 rounded-lg px-4 py-3 mb-4 text-sm">
                        <p className="font-semibold text-blue-800 mb-1">Waiting: Seller to confirm return received</p>
                        <p className="text-blue-700 text-xs">Buyer shipped {daysAgo(d.return_shipped_at)}. Waiting for seller to confirm they got it.
                          {d.return_tracking && <span className="block mt-1">Tracking: <strong>{d.return_tracking}</strong></span>}
                        </p>
                      </div>
                    )}

                    {d.status === 'return_shipping' && returnShippingStale && (
                      <div className="bg-red-50 rounded-lg px-4 py-3 mb-4 text-sm">
                        <p className="font-semibold text-red-800 mb-1">Action required: Seller hasn't confirmed return ({returnShippingDays} days)</p>
                        <p className="text-red-700 text-xs">The buyer shipped the return {daysAgo(d.return_shipped_at)} but the seller hasn't confirmed receipt. You may need to follow up or make a decision.
                          {d.return_tracking && <span className="block mt-1">Tracking: <strong>{d.return_tracking}</strong></span>}
                        </p>
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{d.listing_title}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Buyer: <strong>{d.buyer_name}</strong> vs Seller: <strong>{d.seller_name}</strong>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {d.total_price && <p className="font-bold">{formatPrice(d.total_price)}</p>}
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          d.status === 'awaiting_address' ? 'bg-orange-100 text-orange-800' :
                          d.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                          d.status === 'admin_review' ? 'bg-red-100 text-red-800' :
                          d.status === 'return_shipping' ? 'bg-blue-100 text-blue-800' :
                          d.status === 'return_received' ? 'bg-purple-100 text-purple-800' :
                          d.status === 'refunded' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {d.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 text-sm mb-3">
                      <p className="text-gray-700"><strong>Reason:</strong> {d.reason}</p>
                      {d.description && <p className="text-gray-500 mt-1">{d.description}</p>}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                      <span>Order #{d.order_id}</span>
                      <span>Opened {fmtDateTime(d.created_at)} ({daysAgo(d.created_at)})</span>
                      {d.payment_reference && <span>Yoco: <code className="bg-gray-100 px-1 rounded">{d.payment_reference}</code></span>}
                    </div>

                    {isActive && (
                      <div className="flex gap-2 pt-3 border-t border-gray-100">
                        <button onClick={() => resolveDispute(d.id, 'refund')}
                          className="text-sm bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition-colors font-medium">
                          Issue Full Refund
                        </button>
                        <button onClick={() => resolveDispute(d.id, 'no_refund')}
                          className="text-sm btn-outline !py-2.5 !px-5">
                          No Refund — Release to Seller
                        </button>
                      </div>
                    )}

                    {d.status === 'refunded' && (
                      <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-green-700">
                        Refunded on {fmtDate(d.resolved_at)}
                        {d.admin_notes && <span className="block text-xs mt-1">{d.admin_notes}</span>}
                      </div>
                    )}

                    {d.status === 'resolved_no_refund' && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
                        Resolved without refund on {fmtDate(d.resolved_at)}
                        {d.admin_notes && <span className="block text-xs mt-1">{d.admin_notes}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ───── ESCROW TAB ───── */}
      {tab === 'escrow' && (
        <div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 text-sm text-gray-700">
            <strong>What is this?</strong> Every buyer payment is held for 48 hours after delivery before being released to the seller.
            This protects buyers if something goes wrong. You don't need to do anything here — escrows release automatically.
            When they do, the seller appears in the <strong>Payouts</strong> tab for you to EFT.
          </div>

          {escrows.summary && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">Holding: {escrows.summary.holding || 0}</span>
              <span className="px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">Paused (dispute): {escrows.summary.paused || 0}</span>
              <span className="px-3 py-1.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">Released: {escrows.summary.released || 0}</span>
              <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">Refunded: {escrows.summary.refunded || 0}</span>
            </div>
          )}

          <div className="space-y-3">
            {(escrows.holds || []).length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-gray-500 font-medium">No escrow holds</p>
                <p className="text-xs text-gray-400 mt-1">When a buyer makes a purchase, their payment hold appears here.</p>
              </div>
            ) : (escrows.holds || []).map(h => (
              <div key={h.id} className={`card p-4 ${h.status === 'holding' ? 'border-l-4 border-l-blue-400' : h.status === 'paused' ? 'border-l-4 border-l-yellow-400' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{h.listing_title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">Seller: {h.seller_name} — Buyer: {h.buyer_name}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
                      <span>Paid {fmtDate(h.hold_started_at)}</span>
                      {h.released_at && <span>Released {fmtDate(h.released_at)}</span>}
                      {h.buyer_confirmed_at && <span className="text-green-600">Buyer confirmed early</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-lg">{formatPrice(h.item_amount)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      h.status === 'holding' ? 'bg-blue-100 text-blue-700' :
                      h.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                      h.status === 'released' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {h.status}
                    </span>
                    {h.platform_fee > 0 && <p className="text-xs text-gray-400 mt-1">Fee: {formatPrice(h.platform_fee)}</p>}
                    {h.courier_fee > 0 && <p className="text-xs text-gray-400">Courier: {formatPrice(h.courier_fee)}</p>}
                  </div>
                </div>

                {h.status === 'holding' && (
                  <div className="mt-3 bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
                    {h.order_status === 'delivered' || h.delivered_at ? (
                      <>Releases automatically on <strong>{fmtDateTime(h.release_due_at)}</strong> ({daysUntil(h.release_due_at)}) — then the seller will appear in the Payouts tab for you to EFT.</>
                    ) : (
                      <>Waiting for delivery. The 7-day countdown starts once The Courier Guy delivers the item.</>
                    )}
                  </div>
                )}
                {h.status === 'paused' && (
                  <div className="mt-3 bg-yellow-50 rounded-lg px-3 py-2 text-xs text-yellow-700">
                    Timer paused — check the Disputes tab for details.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
