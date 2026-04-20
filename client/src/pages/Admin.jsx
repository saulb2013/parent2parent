import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/formatPrice';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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
        if (r.status === 403) { setAuthorized(false); return null; }
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
    const adminNotes = prompt('Enter EFT reference number or bank note (e.g. "FNB ref 12345"):');
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
      ? 'This will refund the buyer via Yoco. Add any notes:'
      : 'This will release funds to the seller. Add any notes:';
    const adminNotes = prompt(label);
    if (adminNotes === null) return;
    if (resolution === 'refund' && !confirm('Are you sure? This will issue a Yoco refund to the buyer\'s card.')) return;
    const res = await fetch(`/api/admin/disputes/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ resolution, adminNotes }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    setDisputes(prev => prev.map(d => d.id === id ? data.dispute : d));
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-8"><div className="animate-pulse h-64 bg-gray-200 rounded-xl" /></div>;
  }

  if (!authorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="font-display text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-gray-500 mt-2">You don't have admin access.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">Manage payouts, disputes, and escrow holds. All amounts exclude Yoco's processing fee (~2.6%).</p>

      {/* Revenue Summary */}
      {revenue && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">P2P Revenue</p>
            <p className="text-2xl font-bold text-primary">{formatPrice(Number(revenue.total_revenue))}</p>
            <p className="text-xs text-gray-400 mt-1">Your 5% platform fee</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">In Escrow</p>
            <p className="text-2xl font-bold text-blue-600">{formatPrice(Number(revenue.holding_for_sellers))}</p>
            <p className="text-xs text-gray-400 mt-1">Held for 7-day protection</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Owed to Sellers</p>
            <p className="text-2xl font-bold text-orange-600">{formatPrice(Number(revenue.owed_to_sellers))}</p>
            <p className="text-xs text-gray-400 mt-1">EFT these to sellers</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Paid to Sellers</p>
            <p className="text-2xl font-bold text-green-600">{formatPrice(Number(revenue.paid_to_sellers))}</p>
            <p className="text-xs text-gray-400 mt-1">Completed EFTs</p>
          </div>
        </div>
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
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ───── PAYOUTS TAB ───── */}
      {tab === 'payouts' && (
        <div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-800">
            <strong>How payouts work:</strong> When escrow releases (buyer confirms or 7 days pass), the seller appears here.
            EFT the amount to their bank account, then click "Mark as Paid" and enter the EFT reference.
          </div>

          <div className="flex gap-2 mb-4">
            {['pending', 'paid'].map(f => (
              <button key={f} onClick={() => setPayoutFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${payoutFilter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f}
              </button>
            ))}
          </div>

          {payouts.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">
              {payoutFilter === 'pending' ? 'No pending payouts — all sellers have been paid' : 'No completed payouts yet'}
            </div>
          ) : (
            <div className="space-y-3">
              {payouts.map(p => (
                <div key={p.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">{p.listing_title}</p>
                      <p className="text-sm text-gray-600 mt-1">Pay to: <strong>{p.seller_name}</strong></p>
                      <p className="text-sm text-gray-500">{p.seller_email}</p>
                      {p.seller_phone && <p className="text-sm text-gray-500">{p.seller_phone}</p>}
                      <p className="text-xs text-gray-400 mt-2">Order #{p.order_id} — {fmtDate(p.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold text-primary">{formatPrice(p.amount)}</p>
                      <p className="text-xs text-gray-400 mt-1">P2P fee: {formatPrice(p.platform_fee)}</p>
                    </div>
                  </div>
                  {p.status === 'pending' && (
                    <button onClick={() => markPaid(p.id)} className="btn-accent mt-4 w-full text-sm !py-2.5">
                      Mark as Paid (EFT sent)
                    </button>
                  )}
                  {p.status === 'paid' && (
                    <div className="mt-3 bg-green-50 rounded-lg p-3 text-sm text-green-700">
                      Paid on {fmtDate(p.paid_at)}
                      {p.admin_notes && <span className="text-green-600"> — {p.admin_notes}</span>}
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
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 mb-5 text-sm text-yellow-800">
            <strong>How disputes work:</strong> Buyers can raise within 48hrs of delivery. Escrow pauses.
            The buyer ships the item back, seller confirms, then you issue a Yoco refund or resolve without refund.
            Disputes auto-escalate to you after 48hrs if unresolved.
          </div>

          {disputes.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">No disputes — everything is running smoothly</div>
          ) : (
            <div className="space-y-3">
              {disputes.map(d => (
                <div key={d.id} className={`card p-5 ${['open', 'admin_review'].includes(d.status) ? 'border-l-4 border-l-yellow-400' : ''}`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{d.listing_title}</p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        <span className="text-gray-500">Buyer:</span> {d.buyer_name} — <span className="text-gray-500">Seller:</span> {d.seller_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Order #{d.order_id} — Opened {fmtDateTime(d.created_at)}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
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

                  <div className="bg-gray-50 rounded-lg p-3 text-sm mb-3">
                    <p className="text-gray-700"><strong>Reason:</strong> {d.reason}</p>
                    {d.description && <p className="text-gray-500 mt-1">{d.description}</p>}
                  </div>

                  {d.total_price && (
                    <p className="text-xs text-gray-500 mb-3">
                      Total paid: {formatPrice(d.total_price)} — Yoco checkout: <code className="text-xs bg-gray-100 px-1 rounded">{d.payment_reference || 'N/A'}</code>
                    </p>
                  )}

                  {['open', 'return_received', 'admin_review'].includes(d.status) && (
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button onClick={() => resolveDispute(d.id, 'refund')}
                        className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                        Issue Full Refund
                      </button>
                      <button onClick={() => resolveDispute(d.id, 'no_refund')}
                        className="text-sm btn-outline !py-2 !px-4">
                        Resolve — No Refund
                      </button>
                    </div>
                  )}

                  {d.status === 'return_shipping' && (
                    <p className="text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
                      Buyer has shipped the return. Waiting for seller to confirm receipt.
                      {d.return_tracking && <span className="block text-xs mt-1">Tracking: {d.return_tracking}</span>}
                    </p>
                  )}

                  {d.status === 'refunded' && d.resolved_at && (
                    <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
                      Refunded on {fmtDate(d.resolved_at)}
                      {d.admin_notes && <span className="block text-xs mt-1">{d.admin_notes}</span>}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───── ESCROW TAB ───── */}
      {tab === 'escrow' && (
        <div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 text-sm text-gray-700">
            <strong>How escrow works:</strong> When a buyer pays, funds are held for 7 days.
            If the buyer confirms receipt early, funds release immediately.
            If a dispute is opened, the timer pauses. Released escrows create a seller payout in the Payouts tab.
          </div>

          {escrows.summary && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">Holding: {escrows.summary.holding || 0}</span>
              <span className="px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">Paused: {escrows.summary.paused || 0}</span>
              <span className="px-3 py-1.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">Released: {escrows.summary.released || 0}</span>
              <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">Refunded: {escrows.summary.refunded || 0}</span>
            </div>
          )}

          <div className="space-y-3">
            {(escrows.holds || []).length === 0 ? (
              <div className="card p-8 text-center text-gray-500">No escrow holds</div>
            ) : (escrows.holds || []).map(h => (
              <div key={h.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{h.listing_title}</p>
                    <p className="text-sm text-gray-500">Seller: {h.seller_name} — Buyer: {h.buyer_name}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Created {fmtDate(h.created_at)}
                      {h.released_at && <span> — Released {fmtDate(h.released_at)}</span>}
                      {h.buyer_confirmed_at && <span> (buyer confirmed)</span>}
                    </p>
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
                {h.status === 'holding' && h.release_due_at && (
                  <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
                    Auto-releases: {fmtDateTime(h.release_due_at)}
                  </div>
                )}
                {h.status === 'paused' && (
                  <div className="mt-2 bg-yellow-50 rounded-lg px-3 py-2 text-xs text-yellow-700">
                    Timer paused — dispute in progress
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
