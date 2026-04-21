import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleSelect() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const selectRole = async (role) => {
    if (!user || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed to set role');
      await refreshUser();
      navigate(role === 'buyer' ? '/browse' : '/sell');
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8">
        <span className="font-display text-3xl font-bold text-[#2D6A4F]">Parent2Parent</span>
      </div>

      {/* Heading */}
      <h1 className="font-display text-4xl md:text-5xl font-bold text-gray-900 text-center mb-3">
        Welcome to Parent2Parent
      </h1>
      <p className="text-lg text-gray-500 font-body text-center mb-12 max-w-md">
        How would you like to get started?
      </p>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
        {/* Buyer card */}
        <button
          onClick={() => selectRole('buyer')}
          disabled={loading}
          className="group bg-white rounded-2xl border-2 border-gray-200 p-8 text-left transition-all duration-200 hover:border-[#2D6A4F] hover:shadow-lg focus:outline-none focus:border-[#2D6A4F] focus:shadow-lg disabled:opacity-50"
        >
          {/* Icon */}
          <div className="w-14 h-14 rounded-xl bg-[#2D6A4F]/10 flex items-center justify-center mb-5">
            <svg className="w-7 h-7 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>

          <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">I'm here to buy</h2>
          <p className="text-gray-500 font-body text-sm mb-5 leading-relaxed">
            Browse quality pre-loved baby and kids items. Every purchase is protected with our 7-day Buyer Protection guarantee.
          </p>

          <ul className="space-y-2.5">
            <li className="flex items-center gap-2.5 text-sm text-gray-600 font-body">
              <svg className="w-4 h-4 text-[#2D6A4F] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Shop trusted sellers
            </li>
            <li className="flex items-center gap-2.5 text-sm text-gray-600 font-body">
              <svg className="w-4 h-4 text-[#2D6A4F] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Delivered to your door by The Courier Guy
            </li>
            <li className="flex items-center gap-2.5 text-sm text-gray-600 font-body">
              <svg className="w-4 h-4 text-[#2D6A4F] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Full refund if something's wrong
            </li>
          </ul>
        </button>

        {/* Seller card */}
        <button
          onClick={() => selectRole('seller')}
          disabled={loading}
          className="group bg-white rounded-2xl border-2 border-gray-200 p-8 text-left transition-all duration-200 hover:border-[#2D6A4F] hover:shadow-lg focus:outline-none focus:border-[#2D6A4F] focus:shadow-lg disabled:opacity-50"
        >
          {/* Icon */}
          <div className="w-14 h-14 rounded-xl bg-[#F4A261]/15 flex items-center justify-center mb-5">
            <svg className="w-7 h-7 text-[#F4A261]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
          </div>

          <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">I'm here to sell</h2>
          <p className="text-gray-500 font-body text-sm mb-5 leading-relaxed">
            Turn outgrown baby gear into cash. List for free, we handle the courier, and you get paid once the buyer is happy.
          </p>

          <ul className="space-y-2.5">
            <li className="flex items-center gap-2.5 text-sm text-gray-600 font-body">
              <svg className="w-4 h-4 text-[#F4A261] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Free to list, no commission
            </li>
            <li className="flex items-center gap-2.5 text-sm text-gray-600 font-body">
              <svg className="w-4 h-4 text-[#F4A261] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              The Courier Guy collects from your door
            </li>
            <li className="flex items-center gap-2.5 text-sm text-gray-600 font-body">
              <svg className="w-4 h-4 text-[#F4A261] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Secure payment after delivery
            </li>
          </ul>
        </button>
      </div>

      {/* Footer note */}
      <p className="text-sm text-gray-400 font-body mt-10 text-center">
        You can always do both! This just sets your default view.
      </p>
    </div>
  );
}
