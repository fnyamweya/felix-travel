import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context.js';
import { DashboardLayout } from './components/DashboardLayout.js';
import { LoginPage } from './pages/Login.js';
import { ForgotPasswordPage } from './pages/ForgotPassword.js';
import { ResetPasswordPage } from './pages/ResetPassword.js';

// Admin pages
import { AdminDashboard } from './pages/admin/Dashboard.js';
import { AdminBookings } from './pages/admin/Bookings.js';
import { AdminCustomers } from './pages/admin/Customers.js';
import { AdminProviders } from './pages/admin/Providers.js';
import { AdminRefunds } from './pages/admin/Refunds.js';
import { AdminPayouts } from './pages/admin/Payouts.js';
import { AdminAuditLog } from './pages/admin/AuditLog.js';
import { AdminCharges } from './pages/admin/Charges.js';
import { AdminChargeSimulator } from './pages/admin/ChargeSimulator.js';

// Provider pages
import { ProviderDashboard } from './pages/provider/Dashboard.js';
import { ProviderBookings } from './pages/provider/Bookings.js';
import { ProviderListings } from './pages/provider/Listings.js';
import { ProviderAccounts } from './pages/provider/Accounts.js';
import { ProviderPayouts } from './pages/provider/Payouts.js';
import { ProviderSettlement } from './pages/provider/Settlement.js';

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role && user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'service_provider') return <Navigate to="/provider" replace />;
  return <Navigate to="/admin" replace />;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<RoleRedirect />} />

          {/* Admin & Agent routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/bookings" element={<AdminBookings />} />
          <Route path="/admin/customers" element={<AdminCustomers />} />
          <Route path="/admin/providers" element={<AdminProviders />} />
          <Route path="/admin/refunds" element={<AdminRefunds />} />
          <Route path="/admin/payouts" element={<AdminPayouts />} />
          <Route path="/admin/charges" element={<AdminCharges />} />
          <Route path="/admin/charges/simulate" element={<AdminChargeSimulator />} />
          <Route path="/admin/audit" element={<AdminAuditLog />} />

          {/* Provider routes */}
          <Route path="/provider" element={<ProviderDashboard />} />
          <Route path="/provider/bookings" element={<ProviderBookings />} />
          <Route path="/provider/listings" element={<ProviderListings />} />
          <Route path="/provider/accounts" element={<ProviderAccounts />} />
          <Route path="/provider/payouts" element={<ProviderPayouts />} />
          <Route path="/provider/settlement" element={<ProviderSettlement />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
