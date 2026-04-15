import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function CreateListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', category_id: '', condition: '',
    age_stage: '',
    parcel_size: DEFAULT_PARCEL_SIZE,
    price: '', negotiable: false, province: '', city: '',
    images: [],
  });

  useEffect(() => {
    if (!user) navigate('/login');
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories));
  }, [user]);

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleImageChange = (e) => {
    const newFiles = Array.from(e.target.files);
    const combined = [...form.images, ...newFiles].slice(0, 6);
    updateForm('images', combined);
    e.target.value = '';
  };

  const removeImage = (index) => {
    updateForm('images', form.images.filter((_, i) => i !== index));
  };

  const canProceed = () => {
    if (step === 1) return form.category_id && form.title && form.condition && form.description;
    if (step === 2) return form.price;
    if (step === 3) return form.province && form.city;
    return false;
  };

  const handleSubmit = async () => {
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
      form.images.forEach(img => formData.append('images', img));

      const res = await fetch('/api/listings', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      navigate(`/profile/${user.id}?view=seller&new=${data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-3xl font-bold text-gray-900 mb-2">Sell an Item</h1>
      <p className="text-gray-500 mb-8">List your pre-loved item in three easy steps</p>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-10">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              step >= s ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > s ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : s}
            </div>
            {s < 3 && <div className={`flex-1 h-1 mx-2 rounded ${step > s ? 'bg-primary' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm">{error}</div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="font-display text-xl font-semibold">Item Details</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
            <select
              value={form.category_id}
              onChange={e => updateForm('category_id', e.target.value)}
              className="input-field"
            >
              <option value="">Select a category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => updateForm('title', e.target.value)}
              placeholder="e.g., Bugaboo Fox 3 Complete Pram"
              className="input-field"
              maxLength={100}
            />
          </div>

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
            <p className="text-xs text-gray-400 mt-1">Helps buyers filter for the right age range.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={e => updateForm('description', e.target.value)}
              placeholder="Describe your item - include brand, age, condition details, what's included..."
              className="input-field h-32 resize-none"
              maxLength={2000}
            />
            <p className="text-xs text-gray-400 mt-1">{form.description.length}/2000</p>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="font-display text-xl font-semibold">Photos & Price</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Photos (up to 6)</label>
            {form.images.length < 6 && (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary-light transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-500">Click to upload photos</p>
                  <p className="text-xs text-gray-400 mt-1">JPEG, PNG, or WebP. Max 5MB each. {form.images.length > 0 && `(${6 - form.images.length} remaining)`}</p>
                </label>
              </div>
            )}
            {form.images.length > 0 && (
              <div className="flex gap-3 mt-4 flex-wrap">
                {form.images.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 border border-border group">
                    <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-primary/80 text-white text-[10px] text-center py-0.5">Cover</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Price (ZAR)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">R</span>
              <input
                type="number"
                value={form.price}
                onChange={e => updateForm('price', e.target.value)}
                placeholder="0"
                className="input-field pl-8 text-xl font-semibold"
                min="0"
                step="1"
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
              Pick the size that best fits your item packed. Accurate sizing keeps shipping quotes honest — the courier re-weighs parcels and bills any difference.
            </p>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="font-display text-xl font-semibold">Location & Preview</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Province</label>
            <select
              value={form.province}
              onChange={e => updateForm('province', e.target.value)}
              className="input-field"
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
              placeholder="e.g., Sandton, Cape Town CBD"
              className="input-field"
            />
          </div>

          {/* Preview */}
          <div className="card p-6 mt-6">
            <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">Preview</h3>
            {form.images.length > 0 && (
              <img
                src={URL.createObjectURL(form.images[0])}
                alt="Cover"
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
            )}
            <h4 className="font-display text-xl font-bold">{form.title || 'Your item title'}</h4>
            <p className="text-2xl font-bold text-primary mt-1">
              {form.price ? `R ${parseFloat(form.price).toLocaleString('en-ZA')}` : 'R 0'}
              {form.negotiable && <span className="text-sm text-accent-dark font-medium ml-2">Negotiable</span>}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {form.city && form.province ? `${form.city}, ${form.province}` : 'Location not set'}
            </p>
            <p className="text-sm text-gray-600 mt-3 line-clamp-3">{form.description || 'No description yet'}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-10">
        {step > 1 ? (
          <button onClick={() => setStep(step - 1)} className="btn-outline">
            Back
          </button>
        ) : <div />}

        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed() || submitting}
            className="btn-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Publishing...' : 'Publish Listing'}
          </button>
        )}
      </div>
    </div>
  );
}
