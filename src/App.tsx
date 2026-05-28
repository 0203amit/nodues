import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Navbar from "./components/shared/Navbar";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import BillsPage from "./pages/BillsPage";
import TodosPage from "./pages/TodosPage";
import SettingsPage from "./pages/SettingsPage";

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
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/bills" element={<BillsPage />} />
          <Route path="/todos" element={<TodosPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
