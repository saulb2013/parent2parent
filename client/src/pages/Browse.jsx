import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ListingCard from '../components/ListingCard';
import { useListings } from '../hooks/useListings';

const provinces = [
  '', 'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
];

const conditions = [
  { value: '', label: 'All Conditions' },
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Gently used' },
  { value: 'fair', label: 'Well used' },
];

const sortOptions = [
  { value: '', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
];

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    province: searchParams.get('province') || '',
    search: searchParams.get('search') || '',
    condition: searchParams.get('condition') || '',
    sort: searchParams.get('sort') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    page: parseInt(searchParams.get('page')) || 1,
  });

  const { listings, pagination, loading } = useListings({
    ...filters,
    minPrice: filters.minPrice ? parseInt(filters.minPrice) * 100 : '',
    maxPrice: filters.maxPrice ? parseInt(filters.maxPrice) * 100 : '',
  });

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    setSearchParams(params, { replace: true });
  }, [filters]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Pre-loved items from parents near you</h1>
          <p className="text-gray-500 text-sm mt-1">{pagination.total} items found</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden btn-outline !py-2 !px-4 text-sm"
          >
            {showFilters ? 'Hide Filters' : 'Filters'}
          </button>
          <select
            value={filters.sort}
            onChange={e => updateFilter('sort', e.target.value)}
            className="input-field !w-auto text-sm"
          >
            {sortOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-64 shrink-0`}>
          <div className="card p-5 space-y-6 sticky top-20">
            {/* Search */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Search</label>
              <input
                type="text"
                placeholder="Search prams, toys, clothing…"
                value={filters.search}
                onChange={e => updateFilter('search', e.target.value)}
                className="input-field text-sm"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Category</label>
              <select
                value={filters.category}
                onChange={e => updateFilter('category', e.target.value)}
                className="input-field text-sm"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.slug}>{c.emoji} {c.name}</option>
                ))}
              </select>
            </div>

            {/* Province */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Province</label>
              <select
                value={filters.province}
                onChange={e => updateFilter('province', e.target.value)}
                className="input-field text-sm"
              >
                <option value="">All Provinces</option>
                {provinces.filter(Boolean).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Price Range (ZAR)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minPrice}
                  onChange={e => updateFilter('minPrice', e.target.value)}
                  className="input-field text-sm"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxPrice}
                  onChange={e => updateFilter('maxPrice', e.target.value)}
                  className="input-field text-sm"
                />
              </div>
            </div>

            {/* Condition */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Condition</label>
              <div className="space-y-2">
                {conditions.map(c => (
                  <label key={c.value} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="radio"
                      name="condition"
                      checked={filters.condition === c.value}
                      onChange={() => updateFilter('condition', c.value)}
                      className="text-primary focus:ring-primary"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={() => setFilters({ category: '', province: '', search: '', condition: '', sort: '', minPrice: '', maxPrice: '', page: 1 })}
              className="text-sm text-accent-dark hover:underline"
            >
              Reset all filters
            </button>
          </div>
        </aside>

        {/* Listings Grid */}
        <main className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="aspect-[4/3] bg-gray-200" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-6 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-4">🔍</p>
              <h3 className="font-display text-xl font-semibold text-gray-700">No listings found</h3>
              <p className="text-gray-500 mt-2">Try adjusting your filters or search terms</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {listings.map(listing => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex justify-center gap-2 mt-10">
                  {Array.from({ length: pagination.pages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setFilters(prev => ({ ...prev, page: i + 1 }))}
                      className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${
                        pagination.page === i + 1
                          ? 'bg-primary text-white'
                          : 'bg-surface text-gray-600 border border-border hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
