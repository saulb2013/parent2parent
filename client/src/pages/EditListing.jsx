import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AGE_STAGES } from '../constants/ageStages';
import { PARCEL_SIZES, DEFAULT_PARCEL_SIZE } from '../constants/parcelSizes';

const provinces = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
];

const conditions = [
  { value: 'new', label: 'New', desc: 'Brand new, never used' },
  { value: 'like_new', label: 'Like New', desc: 'Barely used, excellent condition' },
  { value: 'good', label: 'Gently used', desc: 'Normal wear, fully functional' },
  { value: 'fair', label: 'Well used', desc: 'Some wear, but works well' },
];

export default function EditListing() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    title: '', description: '', category_id: '', condition: '',
    age_stage: '',
    parcel_size: DEFAULT_PARCEL_SIZE,
    price: '', negotiable: false, province: '', city: '',
  });

  useEffect(() => {
    if (!user) { navigate('/login'); return; }

    Promise.all([
      fetch(`/api/listings/${id}`, { credentials: 'include' }).then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]).then(([listingData, catData]) => {
      const l = listingData.listing;
      if (!l || l.seller_id !== user.id) { navigate('/'); return; }

      setForm({
        title: l.title,
        description: l.description,
        category_id: l.category_id.toString(),
        condition: l.condition,
        age_stage: l.age_stage || '',
        parcel_size: l.parcel_size || DEFAULT_PARCEL_SIZE,
        price: (l.price / 100).toString(),
        negotiable: l.negotiable,
        province: l.province,
        city: l.city,
      });
      setExistingImages(l.images || []);
      setCategories(catData.categories);
      setLoading(false);
    });
  }, [id, user]);

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleNewImages = (e) => {
    const files = Array.from(e.target.files).slice(0, 6 - existingImages.length);
    setNewImages(prev => [...prev, ...files].slice(0, 6 - existingImages.length));
  };

  const removeExistingImage = async (imageId) => {
    await fetch(`/api/listings/${id}/images/${imageId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    setExistingImages(prev => prev.filter(img => img.id !== imageId));
  };

  const removeNewImage = (index) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('category_id', form.category_id);
      formData.append('condition', form.condition);
      formData.append('price', Math.round(parseFloat(form.price) * 100).toString());
      formData.append('negotiable', form.negotiable ? '1' : '0');
      formData.append('province', form.province);
      formData.append('city', form.city);
      if (form.age_stage) formData.append('age_stage', form.age_stage);
      if (form.parcel_size) formData.append('parcel_size', form.parcel_size);
      newImages.forEach(img => formData.append('images', img));

      const res = await fetch(`/api/listings/${id}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      navigate(`/listings/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-3xl font-bold text-gray-900 mb-2">Edit Listing</h1>
      <p className="text-gray-500 mb-8">Update your listing details, photos, and price</p>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Images */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Photos</label>
          {existingImages.length > 0 && (
            <div className="flex gap-3 mb-4 flex-wrap">
              {existingImages.map(img => (
                <div key={img.id} className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100 border border-border group">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(img.id)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                  {img.is_primary && (
                    <span className="absolute bottom-0 left-0 right-0 bg-primary text-white text-[10px] text-center py-0.5">Primary</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {newImages.length > 0 && (
            <div className="flex gap-3 mb-4 flex-wrap">
              {newImages.map((img, i) => (
                <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100 border-2 border-dashed border-primary group">
                  <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeNewImage(i)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                  <span className="absolute bottom-0 left-0 right-0 bg-accent text-white text-[10px] text-center py-0.5">New</span>
                </div>
              ))}
            </div>
          )}

          {existingImages.length + newImages.length < 6 && (
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary-light transition-colors">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleNewImages}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <svg className="w-10 h-10 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-sm text-gray-500">Add more photos ({6 - existingImages.length - newImages.length} remaining)</p>
              </label>
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={e => updateForm('title', e.target.value)}
            className="input-field"
            maxLength={100}
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
          <select
            value={form.category_id}
            onChange={e => updateForm('category_id', e.target.value)}
            className="input-field"
            required
          >
            <option value="">Select a category</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
          </select>
        </div>

        {/* Condition */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Condition</label>
          <div className="grid grid-cols-2 gap-3">
            {conditions.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => updateForm('condition', c.value)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  form.condition === c.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-gray-300'
                }`}
              >
                <p className="font-semibold text-sm">{c.label}</p>
                <p className="text-xs text-gray-500">{c.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Age / Stage */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Age / Stage <span className="text-gray-400 font-normal">(optional)</span></label>
          <select
            value={form.age_stage}
            onChange={e => updateForm('age_stage', e.target.value)}
            className="input-field"
          >
            <option value="">Not specified</option>
            {AGE_STAGES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Parcel size */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Parcel size</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PARCEL_SIZES.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => updateForm('parcel_size', s.value)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  form.parcel_size === s.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-gray-300'
                }`}
              >
                <p className="font-semibold text-sm">{s.label}</p>
                <p className="text-xs text-gray-500">{s.desc}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Pick the size that best fits your item packed. Accurate sizing keeps shipping quotes honest.
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
          <textarea
            value={form.description}
            onChange={e => updateForm('description', e.target.value)}
            className="input-field h-32 resize-none"
            maxLength={2000}
            required
          />
          <p className="text-xs text-gray-400 mt-1">{form.description.length}/2000</p>
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Price (ZAR)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">R</span>
            <input
              type="number"
              value={form.price}
              onChange={e => updateForm('price', e.target.value)}
              className="input-field pl-8 text-xl font-semibold"
              min="0"
              step="1"
              required
            />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.negotiable}
            onChange={e => updateForm('negotiable', e.target.checked)}
            className="w-5 h-5 text-primary rounded focus:ring-primary"
          />
          <div>
            <p className="text-sm font-semibold text-gray-700">Price is negotiable</p>
            <p className="text-xs text-gray-500">Let buyers know you're open to offers</p>
          </div>
        </label>

        {/* Location */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Province</label>
          <select
            value={form.province}
            onChange={e => updateForm('province', e.target.value)}
            className="input-field"
            required
          >
            <option value="">Select province</option>
            {provinces.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">City / Area</label>
          <input
            type="text"
            value={form.city}
            onChange={e => updateForm('city', e.target.value)}
            className="input-field"
            required
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(`/listings/${id}`)}
            className="btn-outline flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-accent flex-1 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
