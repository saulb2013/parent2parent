import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AGE_STAGES } from '../constants/ageStages';
import { PARCEL_SIZES, DEFAULT_PARCEL_SIZE } from '../constants/parcelSizes';

// Fields the courier needs for collection. If any are missing, sellers
// can't list — we gate the Sell page rather than letting them fill out
// the form only to fail at POST time.
const REQUIRED_PROFILE_FIELDS = [
  { key: 'street_address', label: 'Street address' },
  { key: 'city',           label: 'City' },
  { key: 'province',       label: 'Province' },
  { key: 'postal_code',    label: 'Postal code' },
  { key: 'phone',          label: 'Mobile number' },
];

function getMissingProfileFields(user) {
  if (!user) return [];
  return REQUIRED_PROFILE_FIELDS.filter(f => !user[f.key] || !String(user[f.key]).trim());
}

const provinces = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
];

// Words that suggest a safety or quality issue. We don't block the listing
// but we ask the seller to confirm they've explained the issue clearly so
// buyers aren't surprised after delivery.
const RISKY_WORDS = [
  'broken', 'cracked', 'recalled', 'fake', 'replica',
  'missing', 'no brakes', 'damaged', 'unsafe',
];

function detectRiskyWords(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  return RISKY_WORDS.filter(w => lower.includes(w));
}

// Category-specific things the seller should mention in their description.
// Keyed by category slug — falls through if no match.
const CATEGORY_DISCLOSURES = {
  'clothing': [
    'Size and brand',
    'Stains, marks, or fading',
    'Name labels written or sewn in',
    'Missing buttons, broken zips, or holes',
    'Whether the item has shrunk in the wash',
  ],
  'prams-strollers': [
    'Brand and model',
    'Whether the brakes work',
    'Folding mechanism (smooth or stiff)',
    'Wheel condition',
    'Accessories included (rain cover, cup holder, etc.)',
    'Any known faults',
  ],
  'cots-beds': [
    'Dimensions',
    'Whether all screws/parts are present',
    'Stability when assembled',
    'Any damage, scratches, or marks',
    'Whether it will be sold disassembled',
  ],
  'carriers-slings': [
    'Brand and model',
    'Condition of straps and buckles',
    'Any tears, fraying, or worn stitching',
    'Age and weight range it supports',
  ],
  'toys-play': [
    'Whether it works (and batteries if needed)',
    'Any missing parts or pieces',
    'Battery compartment condition (corrosion, leaks)',
    'Recommended age range',
  ],
  'car-seats': [
    'Brand, model, and weight/age range',
    'Expiry date (visible on the seat)',
    'Whether it has been in any accident',
    'All harness/buckle parts present',
    'No cracks, fraying, or missing pads',
  ],
  'feeding': [
    'Whether it has been sterilised before sale',
    'All parts and accessories included',
    'Any damage, stains, or wear',
  ],
  'safety-monitors': [
    'Whether it powers on and pairs correctly',
    'All cables, mounts, and accessories included',
    'Any wear on the unit or sensors',
  ],
  'bath-changing': [
    'Any cracks, mould, or staining',
    'Whether straps and buckles work',
    'All parts and accessories included',
  ],
};

const conditions = [
  {
    value: 'new',
    label: 'New with tags / unused',
    desc: 'Never used. Packaging or tags still attached where applicable.',
    disclose: 'Disclose: missing packaging, opened box, or any storage marks.',
  },
  {
    value: 'like_new',
    label: 'Like new',
    desc: 'Used lightly but looks almost new. No visible damage, stains, missing parts or functional issues.',
    disclose: 'Disclose: any tiny scuffs, name labels, or signs of washing or storage.',
  },
  {
    value: 'good',
    label: 'Good',
    desc: 'Clearly used but fully functional and clean. Minor wear only.',
    disclose: 'Disclose: scuffs, fading, minor marks, loose threads, small cosmetic defects.',
  },
  {
    value: 'fair',
    label: 'Fair',
    desc: 'Usable but visibly worn. Buyer should expect obvious signs of use.',
    disclose: 'Disclose: all visible defects, repairs, missing accessories, stains, or heavy wear.',
  },
];

export default function CreateListing() {
  const { user, loading: authLoading } = useAuth();
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
    images: [], accuracyConfirmed: false,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories));
  }, [user, authLoading]);

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
    if (step === 1) return form.category_id && form.title && form.condition && form.description.trim().length >= 50;
    if (step === 2) return form.price && form.images.length >= 4;
    if (step === 3) return form.province && form.city && form.accuracyConfirmed;
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

  // Wait for auth resolution before deciding what to render, otherwise
  // we'd briefly flash the "complete your profile" screen for fully-
  // set-up users while /api/auth/me is in flight.
  if (authLoading || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center text-gray-500">
        Loading…
      </div>
    );
  }

  const missingFields = getMissingProfileFields(user);
  if (missingFields.length > 0) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
        <div className="card p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">
            A few details, then you're ready to sell
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed mb-5">
            Every sold item is shipped via The Courier Guy. To make sure your
            collection goes smoothly, we need a full pickup address and a mobile
            number the driver can call if they can't find you on the day. It only
            takes a minute, and you'll never have to do it again.
          </p>
          <div className="bg-badge rounded-lg p-4 mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-2">
              Still needed for courier collection
            </p>
            <ul className="text-sm text-gray-700 space-y-1">
              {missingFields.map(f => (
                <li key={f.key} className="flex items-center gap-2">
                  <span className="text-accent-dark">•</span>
                  {f.label}
                </li>
              ))}
            </ul>
          </div>
          <Link to={`/profile/${user.id}`} className="btn-primary inline-block">
            Complete profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-3xl font-bold text-gray-900 mb-2">Sell an Item</h1>
      <p className="text-gray-500 mb-6">List your pre-loved item in three easy steps</p>

      {/* Seller Protection Box */}
      <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-8 flex gap-3">
        <svg className="w-5 h-5 text-primary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-0.5">Accurate listings are protected</p>
          <p className="text-xs text-gray-700 leading-relaxed">
            If your photos and condition description are clear, buyers cannot return simply because they changed their mind or the item does not fit.
          </p>
        </div>
      </div>

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
            <div className="grid gap-3">
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
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{c.desc}</p>
                </button>
              ))}
            </div>
            {form.condition && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                <p className="text-xs text-amber-900">
                  <strong>{conditions.find(c => c.value === form.condition).disclose}</strong> Be honest in your description and photos — accurate listings are protected from returns.
                </p>
              </div>
            )}
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

          {(() => {
            const cat = categories.find(c => String(c.id) === String(form.category_id));
            const prompts = cat ? CATEGORY_DISCLOSURES[cat.slug] : null;
            if (!prompts) return null;
            return (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-800 mb-2">Please cover in your description</p>
                <ul className="space-y-1.5">
                  {prompts.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-blue-900">
                      <svg className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={e => updateForm('description', e.target.value)}
              placeholder="Describe your item - include brand, age, condition details, what's included..."
              className="input-field h-32 resize-none"
              maxLength={2000}
            />
            <div className="flex justify-between mt-1">
              <p className={`text-xs ${form.description.trim().length < 50 ? 'text-amber-600' : 'text-gray-400'}`}>
                {form.description.trim().length < 50
                  ? `${50 - form.description.trim().length} more characters needed (minimum 50)`
                  : 'Looks good'}
              </p>
              <p className="text-xs text-gray-400">{form.description.length}/2000</p>
            </div>
            {(() => {
              const risky = detectRiskyWords(form.description);
              if (risky.length === 0) return null;
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                  <p className="text-xs text-amber-900">
                    <strong>Heads up:</strong> your description mentions{' '}
                    {risky.map((w, i) => (
                      <span key={w}>
                        <span className="font-mono bg-amber-100 px-1 rounded">{w}</span>
                        {i < risky.length - 1 && ', '}
                      </span>
                    ))}
                    . If the item has this issue, make sure you've explained it clearly and shown it in the photos. If it doesn't, consider rephrasing — buyers may be put off.
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="font-display text-xl font-semibold">Photos & Price</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Photos
              <span className={`ml-2 text-xs font-normal ${form.images.length >= 4 ? 'text-primary' : 'text-amber-600'}`}>
                {form.images.length}/4 minimum &middot; 6 max
              </span>
            </label>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
              <p className="text-xs text-blue-900 leading-relaxed">
                <strong>What to photograph:</strong> front, back, close-up of the brand or size label, and a close-up of any wear, defect, or stain. Clear photos protect both you and the buyer.
              </p>
            </div>
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

          {/* Accuracy confirmation */}
          <label className="flex items-start gap-3 cursor-pointer bg-amber-50 border border-amber-200 rounded-lg p-4">
            <input
              type="checkbox"
              checked={form.accuracyConfirmed}
              onChange={e => updateForm('accuracyConfirmed', e.target.checked)}
              className="w-5 h-5 mt-0.5 text-primary rounded focus:ring-primary shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-gray-800">I confirm these photos show the actual item being sold and any flaws have been disclosed.</p>
              <p className="text-xs text-gray-600 mt-1">Accurate listings are protected from returns. Misleading listings may be removed.</p>
            </div>
          </label>

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
