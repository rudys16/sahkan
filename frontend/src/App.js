import "@/App.css";
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth, homeFor } from "@/context/AuthContext";
import { SealStamp } from "@/components/SealStamp";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AdminLogin from "@/pages/AdminLogin";
import OwnerSubmit from "@/pages/OwnerSubmit";
import OwnerDocs from "@/pages/OwnerDocs";
import AuthorityQueue from "@/pages/AuthorityQueue";
import AuthorityReview from "@/pages/AuthorityReview";
import AuthorityHistory from "@/pages/AuthorityHistory";
import Admin from "@/pages/Admin";
import VerifyPublic from "@/pages/VerifyPublic";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse opacity-60"><SealStamp status="PENDING" size={120} /></div>
    </div>
  );
}

function Guard({ role, children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) return <Splash />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster theme="light" position="top-right" toastOptions={{ style: { background: "#FFFFFF", border: "1px solid rgba(20,52,78,0.14)", color: "#14344E", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" } }} />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/verifikasi" element={<VerifyPublic />} />
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/admin/login" element={<PublicOnly><AdminLogin /></PublicOnly>} />

          <Route path="/owner" element={<Guard role="OWNER"><OwnerSubmit /></Guard>} />
          <Route path="/owner/dokumen" element={<Guard role="OWNER"><OwnerDocs /></Guard>} />

          <Route path="/authority" element={<Guard role="AUTHORITY"><AuthorityQueue /></Guard>} />
          <Route path="/authority/antrean" element={<Guard role="AUTHORITY"><AuthorityQueue /></Guard>} />
          <Route path="/authority/review/:docId" element={<Guard role="AUTHORITY"><AuthorityReview /></Guard>} />
          <Route path="/authority/riwayat" element={<Guard role="AUTHORITY"><AuthorityHistory /></Guard>} />

          <Route path="/admin" element={<Guard role="ADMIN"><Admin view="approvals" /></Guard>} />
          <Route path="/admin/audit" element={<Guard role="ADMIN"><Admin view="audit" /></Guard>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
