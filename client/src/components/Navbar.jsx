import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const avatarSrc = user?.avatar_url || (user ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}` : null);

  return (
    <nav className="bg-surface border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <svg viewBox="0 0 34 36" className="w-8 h-8" fill="none">
              <path d="M10 24C10 24 2 17.5 2 11.5C2 8 5 5 8.5 5C11 5 12.5 6.5 14 8.5C15.5 6.5 17 5 19.5 5C23 5 26 8 26 11.5C26 17.5 18 24 18 24" fill="#52B788" opacity="0.7"/>
              <path d="M16 30C16 30 6 22.5 6 15.5C6 11.5 9.5 8.5 13.5 8.5C16 8.5 17.5 10 19 12C20.5 10 22 8.5 24.5 8.5C28.5 8.5 32 11.5 32 15.5C32 22.5 22 30 22 30" fill="#2D6A4F"/>
            </svg>
            <div className="flex items-baseline">
              <span className="font-display text-xl font-bold text-primary">Parent</span>
              <span className="font-display text-xl font-bold text-accent">2</span>
              <span className="font-display text-xl font-bold text-primary">Parent</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/browse" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">
              Browse
            </Link>
            {user ? (
              <>
                <Link to="/sell" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">
                  Sell
                </Link>
                <button onClick={handleLogout} className="text-sm font-medium text-gray-600 hover:text-accent-dark transition-colors">
                  Log out
                </button>
                <Link to="/sell" className="btn-accent text-sm !py-2 !px-4">
                  + Sell Item
                </Link>
                <Link to={`/profile/${user.id}`} className="shrink-0" title="My Profile">
                  <img
                    src={avatarSrc}
                    alt={user.name}
                    className="w-9 h-9 rounded-full bg-gray-100 object-cover border-2 border-transparent hover:border-primary transition-colors"
                  />
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">
                  Log in
                </Link>
                <Link to="/register" className="btn-primary text-sm !py-2 !px-4">
                  Sign up
                </Link>
                <Link to="/sell" className="btn-accent text-sm !py-2 !px-4">
                  + Sell Item
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-3">
            {user && (
              <Link to={`/profile/${user.id}`} className="shrink-0">
                <img
                  src={avatarSrc}
                  alt={user.name}
                  className="w-8 h-8 rounded-full bg-gray-100 object-cover border-2 border-transparent"
                />
              </Link>
            )}
            <button
              className="p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-border mt-2 pt-4 space-y-3">
            <Link to="/browse" className="block text-sm font-medium text-gray-600 hover:text-primary" onClick={() => setMobileOpen(false)}>
              Browse
            </Link>
            {user ? (
              <>
                <Link to="/sell" className="block text-sm font-medium text-gray-600 hover:text-primary" onClick={() => setMobileOpen(false)}>
                  Sell an Item
                </Link>
                <Link to={`/profile/${user.id}`} className="block text-sm font-medium text-gray-600 hover:text-primary" onClick={() => setMobileOpen(false)}>
                  My Profile
                </Link>
                <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="block text-sm font-medium text-gray-600 hover:text-accent-dark">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="block text-sm font-medium text-gray-600 hover:text-primary" onClick={() => setMobileOpen(false)}>
                  Log in
                </Link>
                <Link to="/register" className="block text-sm font-medium text-primary" onClick={() => setMobileOpen(false)}>
                  Sign up
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
