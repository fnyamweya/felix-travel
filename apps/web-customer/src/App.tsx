import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context.js';
import { AppLayout } from './components/layouts/AppLayout.js';
import { AuthLayout } from './components/layouts/AuthLayout.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { HomePage } from './pages/Home.js';
import { SearchPage } from './pages/Search.js';
import { ListingDetailPage } from './pages/ListingDetail.js';
import { LoginPage } from './pages/Login.js';
import { RegisterPage } from './pages/Register.js';
import { MyBookingsPage } from './pages/MyBookings.js';
import { BookingDetailPage } from './pages/BookingDetail.js';
import { CheckoutPage } from './pages/Checkout.js';
import { PaymentStatusPage } from './pages/PaymentStatus.js';
import { AccountPage } from './pages/Account.js';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* App routes (public + optional auth) */}
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/bookings" element={<MyBookingsPage />} />
            <Route path="/bookings/:id" element={<BookingDetailPage />} />
            <Route path="/checkout/:bookingId" element={<CheckoutPage />} />
            <Route path="/payment-status/:paymentId" element={<PaymentStatusPage />} />
            <Route path="/account" element={<AccountPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
