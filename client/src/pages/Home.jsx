import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import ListingCard from '../components/ListingCard';
import CategoryPill from '../components/CategoryPill';

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch('/api/listings?limit=8&sort=popular')
      .then(r => r.json())
      .then(d => setFeatured(d.listings));
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => setCategories(d.categories));
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary via-primary-dark to-primary overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 bg-accent rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-60 h-60 bg-primary-light rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 relative">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-6xl font-bold text-white leading-tight">
              Made for parents. Built on trust.
            </h1>
            <p className="mt-4 text-lg text-green-100 max-w-lg mx-auto">
              Buy and sell quality pre-loved baby and kids gear. Secure payments, door-to-door delivery, and buyer protection on every order.
            </p>
            <div className="mt-8">
              <SearchBar className="max-w-2xl mx-auto" />
            </div>
            <div className="mt-6 flex flex-col items-center gap-2">
              <Link to="/browse" className="btn-accent text-lg px-10">
                Start Shopping
              </Link>
              <Link to="/sell" className="text-green-200 hover:text-white text-sm transition-colors">
                or list something for sale
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="bg-surface border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-badge flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm text-gray-800">Secure Payments</p>
              <p className="text-xs text-gray-500">Card payments via Yoco</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-badge flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm text-gray-800">Buyer Protection</p>
              <p className="text-xs text-gray-500">7-day money-back guarantee</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-badge flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm text-gray-800">Door-to-Door Delivery</p>
              <p className="text-xs text-gray-500">Tracked via The Courier Guy</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl font-bold text-gray-900">Shop by Category</h2>
          <p className="text-gray-500 mt-2">Find exactly what your little one needs</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {categories.map(cat => (
            <CategoryPill key={cat.id} name={cat.name} slug={cat.slug} emoji={cat.emoji} count={cat.listing_count} />
          ))}
        </div>
      </section>

      {/* Featured Listings */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display text-3xl font-bold text-gray-900">Featured Listings</h2>
            <p className="text-gray-500 mt-1">Hand-picked items from trusted sellers</p>
          </div>
          <Link to="/browse" className="btn-outline text-sm !py-2 !px-4 hidden sm:inline-block">
            View All
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map(listing => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
        <div className="text-center mt-8 sm:hidden">
          <Link to="/browse" className="btn-outline">View All Listings</Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="text-gray-500 mt-2">Three simple steps to buy or sell</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '1', icon: '🛒', title: 'Find or List', desc: 'Browse pre-loved items from parents near you, or list something your child has outgrown. It takes less than 3 minutes.' },
              { step: '2', icon: '🔒', title: 'Pay Securely', desc: 'Buyers pay by card through Yoco. Your money is held safely until you receive the item and confirm you are happy.' },
              { step: '3', icon: '🚚', title: 'Delivered to Your Door', desc: 'The Courier Guy collects from the seller and delivers to you with full tracking. No meetups, no awkward handovers.' },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 bg-badge rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
                  {item.icon}
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl font-bold text-gray-900">What Parents Say</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: 'Zanele M.', location: 'Johannesburg', text: 'Sold our Bugaboo in two days! The Courier Guy collected it from my door and I got paid two days later. Love that these items find new families.' },
            { name: 'James K.', location: 'Cape Town', text: 'Found an amazing Stokke high chair at half the retail price. Looks brand new. Parent2Parent is our go-to for baby gear.' },
            { name: 'Ayesha P.', location: 'Durban', text: 'As a mom of three, I both buy and sell here regularly. The community is wonderful and everything feels safe and trustworthy.' },
          ].map((t, i) => (
            <div key={i} className="card p-6">
              <div className="flex gap-1 mb-3">
                {[1,2,3,4,5].map(s => (
                  <svg key={s} className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">"{t.text}"</p>
              <div className="text-sm">
                <p className="font-semibold text-gray-800">{t.name}</p>
                <p className="text-gray-400">{t.location}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-primary to-primary-dark py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white">
            Ready to declutter the playroom?
          </h2>
          <p className="text-green-100 mt-3 text-lg">
            Join thousands of South African parents buying and selling pre-loved kids gear.
          </p>
          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <Link to="/sell" className="btn-accent text-lg">Start Selling</Link>
            <Link to="/browse" className="bg-white/20 backdrop-blur text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition-all text-lg">
              Browse Listings
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
