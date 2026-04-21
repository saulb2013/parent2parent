import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SearchBar({ className = '', defaultSearch = '', defaultCategory = '' }) {
  const [search, setSearch] = useState(defaultSearch);
  const [category, setCategory] = useState(defaultCategory);
  const [categories, setCategories] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
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
          placeholder="Search prams, toys, clothing..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>
      <select
        value={category}
        onChange={e => setCategory(e.target.value)}
        className="input-field sm:w-52"
      >
        <option value="">All Categories</option>
        {categories.map(c => (
          <option key={c.id} value={c.slug}>{c.emoji} {c.name}</option>
        ))}
      </select>
      <button type="submit" className="btn-primary whitespace-nowrap">
        Search
      </button>
    </form>
  );
}
