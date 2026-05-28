import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import ToastContainer from "./components/shared/ToastContainer";
import "./index.css";
import App from "./App";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <GoogleOAuthProvider clientId={clientId}>
        <AuthProvider>
          <ToastProvider>
            <App />
            <ToastContainer />
          </ToastProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
