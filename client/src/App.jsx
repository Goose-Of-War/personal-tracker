import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import LoginSignup from "./pages/LoginSignup.jsx";
import Home from "./pages/Home.jsx";
import Accounts from "./pages/Accounts.jsx";
import Transactions from "./pages/Transactions.jsx";
import Profile from "./pages/Profile.jsx";
import Legal from "./pages/Legal.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginSignup />} />
          <Route path="/legal" element={<Legal />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts"
            element={
              <ProtectedRoute>
                <Accounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <Transactions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
