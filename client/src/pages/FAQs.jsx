import { useState } from 'react';
import { Link } from 'react-router-dom';

const faqs = [
  { q: 'Is Parent2Parent free to use?', a: 'Listing items is free. We may introduce optional promoted listings in future, but buying and browsing will always be free.' },
  { q: 'How do I list an item for sale?', a: 'Create an account, click "Sell an Item", fill in the details, upload your photos, and publish. It takes less than 3 minutes.' },
  { q: 'How does payment work?', a: 'Buyers and sellers arrange payment directly \u2014 EFT or cash on collection are most common. We recommend always getting proof of payment.' },
  { q: "What if an item isn't as described?", a: "Contact the seller first. If unresolved, report the listing to our team and we'll investigate. Honest listings are a condition of using the platform." },
  { q: 'Can I sell anything baby/kids related?', a: "Almost everything! Clothing, toys, gear, furniture, books. We don't allow car seats with unknown history, recalled items, or anything that poses a safety risk." },
  { q: 'Is this only for babies?', a: 'No \u2014 we cover newborn all the way through to teen. If a child has outgrown it, it belongs here.' },
  { q: 'How do I stay safe meeting a stranger?', a: 'Check our Safety Tips page for full guidance. The short version: public place, daytime, bring someone if you can.' },
  { q: "I'm in a small town \u2014 can I still use this?", a: 'Absolutely. Many listings ship nationwide. Filter by location or leave it open to find buyers/sellers anywhere in SA.' },
];

export default function FAQs() {
  const [open, setOpen] = useState(null);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary-dark to-primary py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">
            Your Questions, Answered
          </h1>
        </div>
      </section>

      {/* Accordion */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="card overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-display font-semibold text-gray-900 pr-4">{faq.q}</span>
                <svg
                  className={`w-5 h-5 text-accent flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-gray-600 leading-relaxed text-sm border-t border-border pt-4">
                  {faq.a}{' '}
                  {i === 6 && <Link to="/safety-tips" className="text-accent font-semibold hover:underline">View Safety Tips</Link>}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
