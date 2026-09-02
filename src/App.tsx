import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TenantProvider } from './context/TenantContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Superadmin
import { SuperAdminDashboard } from './pages/odc/SuperAdminDashboard';

// Admin Portal
import { AdminLayout } from './layouts/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ProductsPage } from './pages/admin/ProductsPage';
import { WarehousePage } from './pages/admin/WarehousePage';
import { StockTransfersPage } from './pages/admin/StockTransfersPage';
import { AgentsTrucksPage } from './pages/admin/AgentsTrucksPage';
import { MicroStoresPage } from './pages/admin/MicroStoresPage';
import { SalesPage } from './pages/admin/SalesPage';
import { ReturnablesPundoPage } from './pages/admin/ReturnablesPundoPage';
import { PurchasingPage } from './pages/admin/PurchasingPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { SettingsPage } from './pages/admin/SettingsPage';

// Agent Portal
import { AgentLayout } from './layouts/AgentLayout';
import { AgentDashboard } from './pages/agent/AgentDashboard';
import { AgentDeliveryFlow } from './pages/agent/AgentDeliveryFlow';
import { AgentTruckStock } from './pages/agent/AgentTruckStock';
import { AgentPundoView } from './pages/agent/AgentPundoView';
import { AgentReconciliation } from './pages/agent/AgentReconciliation';

// Auth
import { LoginPage } from './pages/auth/LoginPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <TenantProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Platform Superadmin ODC Route (Protected for Superadmin only) */}
            <Route
              path="/odc"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Desktop Admin Portal Routes (Protected for Auth users) */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Routes>
                      <Route index element={<AdminDashboard />} />
                      <Route path="products" element={<ProductsPage />} />
                      <Route path="warehouse" element={<WarehousePage />} />
                      <Route path="transfers" element={<StockTransfersPage />} />
                      <Route path="agents-trucks" element={<AgentsTrucksPage />} />
                      <Route path="stores" element={<MicroStoresPage />} />
                      <Route path="sales" element={<SalesPage />} />
                      <Route path="pundo" element={<ReturnablesPundoPage />} />
                      <Route path="purchasing" element={<PurchasingPage />} />
                      <Route path="reports" element={<ReportsPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                    </Routes>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* Tablet/Mobile Agent Routes (Protected for Auth users) */}
            <Route
              path="/agent/*"
              element={
                <ProtectedRoute>
                  <AgentLayout>
                    <Routes>
                      <Route index element={<AgentDashboard />} />
                      <Route path="deliver" element={<AgentDeliveryFlow />} />
                      <Route path="truck" element={<AgentTruckStock />} />
                      <Route path="pundo" element={<AgentPundoView />} />
                      <Route path="reconcile" element={<AgentReconciliation />} />
                    </Routes>
                  </AgentLayout>
                </ProtectedRoute>
              }
            />

            {/* Fallback redirect */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </TenantProvider>
    </AuthProvider>
  );
};

export default App;
