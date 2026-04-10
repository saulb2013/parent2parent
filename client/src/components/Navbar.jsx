import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Derive mode from current route
  const sellRoutes = ['/sell'];
  const isSellRoute = sellRoutes.some(r => location.pathname.startsWith(r)) ||
    (location.pathname.startsWith('/profile') && location.search.includes('view=seller'));
  const mode = isSellRoute ? 'sell' : 'buy';

  // Active nav item based on route
  const isOnBrowse = location.pathname === '/browse';
  const isOnOrders = location.pathname.startsWith('/profile') && location.search.includes('view=buyer');
  const isOnListings = location.pathname.startsWith('/profile') && location.search.includes('view=seller');
  const isOnSell = location.pathname === '/sell';

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleMyProfile = () => {
    setProfileOpen(false);
    navigate(`/profile/${user.id}`);
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    setProfileOpen(false);
    await logout();
    navigate('/');
  };

  const closeDropdown = () => {
    setProfileOpen(false);
    setShowLogoutConfirm(false);
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
    setShowLogoutConfirm(false);
  }, [location.pathname, location.search]);

  const avatarSrc = user?.avatar_url || (user ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}` : null);

  const navLinkClass = (active) =>
    `text-sm font-medium transition-colors ${
      active
        ? 'text-primary'
        : 'text-gray-500 hover:text-gray-700'
    }`;

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
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                {/* Buy / Sell Toggle */}
                <div className="inline-flex bg-gray-100 rounded-lg p-0.5 mr-2">
                  <button
                    onClick={() => navigate('/browse')}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      mode === 'buy'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Buying
                  </button>
                  <button
                    onClick={() => navigate('/sell')}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      mode === 'sell'
                        ? 'bg-white text-accent shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Selling
                  </button>
                </div>

                {mode === 'buy' ? (
                  <>
                    <Link to="/browse" className={`btn-primary text-sm !py-2 !px-4 ${isOnBrowse ? 'ring-2 ring-primary/30' : ''}`}>
                      Shop
                    </Link>
                    <Link to={`/profile/${user.id}?view=buyer`} className={navLinkClass(isOnOrders)}>
                      My Orders
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/sell" className={`btn-accent text-sm !py-2 !px-4 ${isOnSell ? 'ring-2 ring-accent/30' : ''}`}>
                      + List Item
                    </Link>
                    <Link to={`/profile/${user.id}?view=seller`} className={navLinkClass(isOnListings)}>
                      My Listings
                    </Link>
                  </>
                )}

                {/* Profile avatar with dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="shrink-0 focus:outline-none"
                    title="Profile menu"
                  >
                    <img
                      src={avatarSrc}
                      alt={user.name}
                      className={`w-9 h-9 rounded-full bg-gray-100 object-cover border-2 transition-colors ${
                        profileOpen ? 'border-primary' : 'border-transparent hover:border-primary'
                      }`}
                    />
                  </button>

                  {(profileOpen || showLogoutConfirm) && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={closeDropdown} />
                      {!showLogoutConfirm ? (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-border py-2 z-50">
                          <div className="px-4 py-2 border-b border-border">
                            <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                          <button
                            onClick={handleMyProfile}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            My Profile
                          </button>
                          <button
                            onClick={() => setShowLogoutConfirm(true)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Log out
                          </button>
                        </div>
                      ) : (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-border py-4 px-4 z-50">
                          <p className="text-sm font-medium text-gray-900 mb-3">Are you sure you want to log out?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={closeDropdown}
                              className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleLogout}
                              className="flex-1 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                            >
                              Log out
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/browse" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">
                  Shop
                </Link>
                <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">
                  Log in
                </Link>
                <Link to="/register" className="btn-primary text-sm !py-2 !px-4">
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-3">
            {user && (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="shrink-0"
                >
                  <img
                    src={avatarSrc}
                    alt={user.name}
                    className={`w-8 h-8 rounded-full bg-gray-100 object-cover border-2 transition-colors ${
                      profileOpen ? 'border-primary' : 'border-transparent'
                    }`}
                  />
                </button>

                {(profileOpen || showLogoutConfirm) && !mobileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={closeDropdown} />
                    {!showLogoutConfirm ? (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-border py-2 z-50">
                        <div className="px-4 py-2 border-b border-border">
                          <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                        </div>
                        <button
                          onClick={handleMyProfile}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit Profile
                        </button>
                        <button
                          onClick={() => setShowLogoutConfirm(true)}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Log out
                        </button>
                      </div>
                    ) : (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-border py-4 px-4 z-50">
                        <p className="text-sm font-medium text-gray-900 mb-3">Are you sure you want to log out?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={closeDropdown}
                            className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleLogout}
                            className="flex-1 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                          >
                            Log out
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
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
          <div className="md:hidden pb-4 border-t border-border mt-2 pt-4">
            {user ? (
              <>
                {/* Mobile Buy/Sell Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-0.5 mb-4">
                  <button
                    onClick={() => navigate('/browse')}
                    className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                      mode === 'buy'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-500'
                    }`}
                  >
                    Buying
                  </button>
                  <button
                    onClick={() => navigate('/sell')}
                    className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                      mode === 'sell'
                        ? 'bg-white text-accent shadow-sm'
                        : 'text-gray-500'
                    }`}
                  >
                    Selling
                  </button>
                </div>

                <div className="space-y-3">
                  {mode === 'buy' ? (
                    <>
                      <Link to="/browse" className="btn-primary text-sm !py-2 text-center">
                        Shop
                      </Link>
                      <Link to={`/profile/${user.id}?view=buyer`} className={`block text-sm font-medium ${isOnOrders ? 'text-primary' : 'text-gray-600 hover:text-primary'}`}>
                        My Orders
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link to="/sell" className={`block text-sm font-medium ${isOnSell ? 'text-accent' : 'text-accent hover:text-accent-dark'}`}>
                        + List an Item
                      </Link>
                      <Link to={`/profile/${user.id}?view=seller`} className={`block text-sm font-medium ${isOnListings ? 'text-primary' : 'text-gray-600 hover:text-primary'}`}>
                        My Listings
                      </Link>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <Link to="/browse" className="block text-sm font-medium text-gray-600 hover:text-primary">
                  Shop
                </Link>
                <Link to="/login" className="block text-sm font-medium text-gray-600 hover:text-primary">
                  Log in
                </Link>
                <Link to="/register" className="block text-sm font-medium text-primary">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
