import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Browse from './pages/Browse';
import ListingDetail from './pages/ListingDetail';
import CreateListing from './pages/CreateListing';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import About from './pages/About';
import FAQs from './pages/FAQs';
import Contact from './pages/Contact';
import EditListing from './pages/EditListing';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import PaymentReturn from './pages/PaymentReturn';
import Admin from './pages/Admin';
import RoleSelect from './pages/RoleSelect';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import TermsAcceptanceModal from './components/TermsAcceptanceModal';

const CURRENT_TERMS_VERSION = '2026-05-06';

function Layout({ children }) {
  const location = useLocation();
  const { user, loading } = useAuth();
  const hideChrome = location.pathname === '/welcome';

  // Redirect logged-in users without a role to /welcome
  if (!loading && user && !user.primary_role && !hideChrome) {
    return <Navigate to="/welcome" replace />;
  }

  // Redirect logged-in users from generic home to their role-specific page
  if (!loading && user && user.primary_role && location.pathname === '/') {
    return <Navigate to={user.primary_role === 'seller' ? '/sell' : '/browse'} replace />;
  }

  // Existing users who have not yet accepted the current Terms must do so
  // before continuing. /terms and /privacy themselves stay accessible so
  // they can read what they're agreeing to.
  const onPolicyPage = location.pathname === '/terms' || location.pathname === '/privacy';
  const needsTermsAcceptance = !loading && user
    && user.terms_version !== CURRENT_TERMS_VERSION
    && !onPolicyPage;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {!hideChrome && <Navbar />}
      <main className="flex-1">{children}</main>
      {!hideChrome && <Footer />}
      {needsTermsAcceptance && <TermsAcceptanceModal />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/listings/:id" element={<ListingDetail />} />
            <Route path="/listings/:id/edit" element={<EditListing />} />
            <Route path="/sell" element={<CreateListing />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/checkout/:id" element={<Checkout />} />
            <Route path="/orders/:id" element={<OrderConfirmation />} />
            <Route path="/payment/return" element={<PaymentReturn />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/about" element={<About />} />
            <Route path="/faqs" element={<FAQs />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/welcome" element={<RoleSelect />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}
