import { useState, useEffect } from 'react';

export function useListings(params = {}) {
  const [listings, setListings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.set(key, val);
      }
    });

    fetch(`/api/listings?${query.toString()}`)
      .then(res => res.json())
      .then(data => {
        setListings(data.listings);
        setPagination(data.pagination);
        setError(null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  return { listings, pagination, loading, error };
}
