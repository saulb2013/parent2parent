import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col bg-background">
          <Navbar />
          <main className="flex-1">
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
              <Route path="/about" element={<About />} />
              <Route path="/faqs" element={<FAQs />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
