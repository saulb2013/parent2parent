import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const provinces = [
  'All Provinces', 'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
];

export default function SearchBar({ className = '', defaultSearch = '', defaultProvince = '' }) {
  const [search, setSearch] = useState(defaultSearch);
  const [province, setProvince] = useState(defaultProvince);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (province && province !== 'All Provinces') params.set('province', province);
    navigate(`/browse?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col sm:flex-row gap-3 ${className}`}>
      <div className="flex-1 relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search prams, toys, clothing…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>
      <select
        value={province}
        onChange={e => setProvince(e.target.value)}
        className="input-field sm:w-48"
      >
        {provinces.map(p => (
          <option key={p} value={p === 'All Provinces' ? '' : p}>{p}</option>
        ))}
      </select>
      <button type="submit" className="btn-primary whitespace-nowrap">
        Find what you need
      </button>
    </form>
  );
}
