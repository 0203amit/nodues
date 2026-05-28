import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { BootstrapProvider } from "./contexts/BootstrapContext";
import BootstrapGuard from "./components/bootstrap/BootstrapGuard";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Navbar from "./components/shared/Navbar";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import BillsPage from "./pages/BillsPage";
import TodosPage from "./pages/TodosPage";
import SettingsPage from "./pages/SettingsPage";
import PropertiesPage from "./pages/PropertiesPage";

function BootstrapLayout() {
  return (
    <BootstrapProvider>
      <BootstrapGuard>
        <Outlet />
      </BootstrapGuard>
    </BootstrapProvider>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {isAuthenticated && <Navbar />}
      <main>
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LandingPage />
              )
            }
          />
          <Route element={<BootstrapLayout />}>
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/bills" element={<ProtectedRoute><BillsPage /></ProtectedRoute>} />
            <Route path="/todos" element={<ProtectedRoute><TodosPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/settings/properties" element={<ProtectedRoute><PropertiesPage /></ProtectedRoute>} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}
