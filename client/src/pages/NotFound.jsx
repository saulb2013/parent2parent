import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl mb-4">🧸</p>
        <h1 className="font-display text-4xl font-bold text-gray-900 mb-2">Page Not Found</h1>
        <p className="text-gray-500 mb-8">
          Looks like this page has been outgrown. Let's find you something else!
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/" className="btn-primary">Go Home</Link>
          <Link to="/browse" className="btn-outline">Browse Listings</Link>
        </div>
      </div>
    </div>
  );
}
