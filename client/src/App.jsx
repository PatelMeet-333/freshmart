import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Footer } from './components/Footer.jsx';
import { Header } from './components/Header.jsx';
import { ProtectedRoute, WakeBanner } from './components/Misc.jsx';
import Auth from './pages/Auth.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import MockPay from './pages/MockPay.jsx';
import OrderStatus from './pages/OrderStatus.jsx';
import Payment from './pages/Payment.jsx';
import Shop from './pages/Shop.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="narrow empty">
      <h1 className="page-title">Page not found</h1>
      <p className="muted">That page doesn’t exist or has moved.</p>
      <Link to="/" className="btn btn-primary">
        Back to shop
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ScrollToTop />
      <WakeBanner />
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<Shop />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
          <Route path="/order/:id" element={<ProtectedRoute><OrderStatus /></ProtectedRoute>} />
          <Route path="/pay/:id" element={<ProtectedRoute><MockPay /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </MotionConfig>
  );
}
