import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/formatPrice';

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
    // Check admin access
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

  const markPaid = async (id, notes) => {
    const adminNotes = prompt('EFT reference or notes:', notes || '');
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
    const adminNotes = prompt(`Notes for ${resolution} resolution:`, '');
    if (adminNotes === null) return;
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
      <h1 className="font-display text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      {/* Revenue Summary */}
      {revenue && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">P2P Revenue</p>
            <p className="text-xl font-bold text-primary mt-1">{formatPrice(Number(revenue.total_revenue))}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">In Escrow</p>
            <p className="text-xl font-bold text-blue-600 mt-1">{formatPrice(Number(revenue.holding_for_sellers))}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Owed to Sellers</p>
            <p className="text-xl font-bold text-orange-600 mt-1">{formatPrice(Number(revenue.owed_to_sellers))}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Paid to Sellers</p>
            <p className="text-xl font-bold text-green-600 mt-1">{formatPrice(Number(revenue.paid_to_sellers))}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: 'payouts', label: 'Payouts' },
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

      {/* Payouts Tab */}
      {tab === 'payouts' && (
        <div>
          <div className="flex gap-2 mb-4">
            {['pending', 'paid'].map(f => (
              <button key={f} onClick={() => setPayoutFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${payoutFilter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                {f}
              </button>
            ))}
          </div>

          {payouts.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">No {payoutFilter} payouts</div>
          ) : (
            <div className="space-y-3">
              {payouts.map(p => (
                <div key={p.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{p.listing_title}</p>
                      <p className="text-sm text-gray-500">Seller: {p.seller_name} ({p.seller_email})</p>
                      {p.seller_phone && <p className="text-xs text-gray-400">{p.seller_phone}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{formatPrice(p.amount)}</p>
                      <p className="text-xs text-gray-400">Fee: {formatPrice(p.platform_fee)}</p>
                    </div>
                  </div>
                  {p.status === 'pending' && (
                    <button onClick={() => markPaid(p.id)} className="btn-primary mt-3 text-sm !py-2">
                      Mark as Paid (EFT)
                    </button>
                  )}
                  {p.status === 'paid' && (
                    <p className="text-xs text-green-600 mt-2">
                      Paid {new Date(p.paid_at).toLocaleDateString('en-ZA')}
                      {p.admin_notes && ` — ${p.admin_notes}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disputes Tab */}
      {tab === 'disputes' && (
        <div className="space-y-3">
          {disputes.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">No disputes</div>
          ) : disputes.map(d => (
            <div key={d.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-900">{d.listing_title}</p>
                  <p className="text-xs text-gray-500">Order #{d.order_id} — {d.buyer_name} vs {d.seller_name}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                  d.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                  d.status === 'admin_review' ? 'bg-red-100 text-red-800' :
                  d.status === 'refunded' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {d.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-sm text-gray-600"><strong>Reason:</strong> {d.reason}</p>
              {d.description && <p className="text-sm text-gray-500 mt-1">{d.description}</p>}
              <p className="text-xs text-gray-400 mt-1">Opened {new Date(d.created_at).toLocaleDateString('en-ZA')}</p>

              {['open', 'return_received', 'admin_review'].includes(d.status) && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => resolveDispute(d.id, 'refund')} className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
                    Issue Refund
                  </button>
                  <button onClick={() => resolveDispute(d.id, 'no_refund')} className="text-sm btn-outline !py-2 !px-4">
                    Resolve (No Refund)
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Escrow Tab */}
      {tab === 'escrow' && (
        <div>
          {escrows.summary && (
            <div className="flex gap-3 mb-4 text-xs">
              <span className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 font-medium">Holding: {escrows.summary.holding || 0}</span>
              <span className="px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">Paused: {escrows.summary.paused || 0}</span>
              <span className="px-3 py-1.5 rounded-full bg-green-100 text-green-800 font-medium">Released: {escrows.summary.released || 0}</span>
              <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 font-medium">Refunded: {escrows.summary.refunded || 0}</span>
            </div>
          )}

          <div className="space-y-3">
            {(escrows.holds || []).length === 0 ? (
              <div className="card p-8 text-center text-gray-500">No escrow holds</div>
            ) : (escrows.holds || []).map(h => (
              <div key={h.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{h.listing_title}</p>
                    <p className="text-xs text-gray-500">{h.seller_name} → {h.buyer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(h.item_amount)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      h.status === 'holding' ? 'bg-blue-100 text-blue-700' :
                      h.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                      h.status === 'released' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {h.status}
                    </span>
                  </div>
                </div>
                {h.status === 'holding' && h.release_due_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    Auto-release: {new Date(h.release_due_at).toLocaleString('en-ZA')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
