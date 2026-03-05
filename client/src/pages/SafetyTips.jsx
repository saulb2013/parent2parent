export default function SafetyTips() {
  const tips = [
    { icon: '\uD83D\uDD0D', title: 'Inspect Before You Buy', desc: 'Always meet in a public place and physically inspect items, especially car seats, cots, and prams, before handing over payment.' },
    { icon: '\uD83D\uDEAB', title: 'Know What Not to Buy Second-Hand', desc: "Avoid used car seats (unknown crash history), old cot mattresses (hygiene/SIDS risk), and helmets. When in doubt, buy new." },
    { icon: '\uD83D\uDCAC', title: 'Communicate Clearly', desc: 'Use the platform messaging system. Never share personal banking details in chat.' },
    { icon: '\uD83D\uDCF8', title: 'Sellers: Photo Everything', desc: 'Upload clear, honest photos of any wear or marks. Transparency builds trust and protects you from disputes.' },
    { icon: '\uD83E\uDD1D', title: 'Meet Safely', desc: 'Choose busy, well-lit locations. A shopping centre parking lot during the day is ideal. Bring a friend if possible.' },
    { icon: '\u2705', title: 'Check Product Recalls', desc: 'Before buying, search the product name + "recall" online. South Africa follows many international recall notices.' },
    { icon: '\uD83D\uDCB3', title: 'Pay Safely', desc: "Use EFT with proof, or cash on collection. Avoid third-party payment links you didn't initiate." },
    { icon: '\uD83D\uDCE6', title: 'For Couriered Items', desc: 'Only pay once tracking details are confirmed. Screenshot all communication.' },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary-dark to-primary py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">
            Buy and Sell with Confidence
          </h1>
          <p className="mt-4 text-lg text-green-100 max-w-2xl mx-auto">
            Your child's safety is everything. Here are our guidelines to make sure every transaction on Parent2Parent is safe, smart, and stress-free.
          </p>
        </div>
      </section>

      {/* Tips Grid */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tips.map((tip, i) => (
            <div key={i} className="card p-6 flex gap-4">
              <div className="text-3xl flex-shrink-0 mt-1">{tip.icon}</div>
              <div>
                <h3 className="font-display text-lg font-semibold text-gray-900 mb-2">{tip.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
