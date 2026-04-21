import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-primary-dark text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-baseline mb-3">
              <span className="font-display text-xl font-bold text-white">Parent</span>
              <span className="font-display text-xl font-bold text-accent">2</span>
              <span className="font-display text-xl font-bold text-white">Parent</span>
            </div>
            <p className="text-sm text-green-200 leading-relaxed">
              South Africa's trusted marketplace for pre-loved baby & kids items.
            </p>
          </div>

          {/* Browse */}
          <div>
            <h4 className="font-display text-sm font-semibold mb-4 text-accent">Browse</h4>
            <ul className="space-y-2 text-sm text-green-200">
              <li><Link to="/browse?category=prams-strollers" className="hover:text-white transition-colors">Prams & Strollers</Link></li>
              <li><Link to="/browse?category=car-seats" className="hover:text-white transition-colors">Car Seats</Link></li>
              <li><Link to="/browse?category=cots-beds" className="hover:text-white transition-colors">Cots & Beds</Link></li>
              <li><Link to="/browse?category=toys-play" className="hover:text-white transition-colors">Toys & Play</Link></li>
              <li><Link to="/browse?category=clothing" className="hover:text-white transition-colors">Clothing</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-display text-sm font-semibold mb-4 text-accent">Company</h4>
            <ul className="space-y-2 text-sm text-green-200">
              <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/faqs" className="hover:text-white transition-colors">FAQs</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Sell */}
          <div>
            <h4 className="font-display text-sm font-semibold mb-4 text-accent">Sell on Parent2Parent</h4>
            <p className="text-sm text-green-200 mb-4">
              Give pre-loved items a second home. Free to list, delivery handled, payments secure.
            </p>
            <Link to="/sell" className="btn-accent text-sm !py-2 !px-4 inline-block">
              List an Item
            </Link>
          </div>
        </div>

        <div className="border-t border-green-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-green-300">
            Made with love in South Africa
          </p>
          <p className="text-xs text-green-400">
            &copy; {new Date().getFullYear()} Parent2Parent. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
