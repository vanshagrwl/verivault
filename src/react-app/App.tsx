import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router";
import { AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
import { ThemeProvider } from "@/react-app/components/ThemeProvider";
import HomePage from "@/react-app/pages/Home";
import Login from "@/react-app/pages/Login";
import AdminDashboard from "@/react-app/pages/AdminDashboard";
import Verify from "@/react-app/pages/Verify";
import UserDashboard from "@/react-app/pages/UserDashboard";

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login/user" element={<Login />} />
        <Route path="/login/admin" element={<Login />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/verify" element={<Verify />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <LazyMotion features={domAnimation}>
      <ThemeProvider>
        <Router>
          <AnimatedRoutes />
        </Router>
      </ThemeProvider>
    </LazyMotion>
  );
}
