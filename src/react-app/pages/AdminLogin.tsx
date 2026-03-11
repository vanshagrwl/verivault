import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { Lock, Mail, AlertCircle, Shield, User } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import ThemeToggle from "@/react-app/components/ThemeToggle";
import { authApi } from "@/react-app/lib/api";

export default function AdminLogin() {
  const [resetKey, setResetKey] = useState(0);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setEmail("");
    setPassword("");
    setName("");
    setError("");

    const t = window.setTimeout(() => {
      setEmail("");
      setPassword("");
      setResetKey((k) => k + 1);
    }, 150);

    return () => window.clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    setIsSubmitting(true);
    const res =
      mode === "login"
        ? await authApi.loginAdmin({
            email: email.trim().toLowerCase(),
            password: password.trim(),
          })
        : await authApi.registerAdmin({
            email: email.trim().toLowerCase(),
            password: password.trim(),
            name: name.trim() || undefined,
          });

    if (res.success) {
      navigate("/admin");
      return;
    }

    setIsSubmitting(false);
    setError(res.error || (mode === "login" ? "Admin login failed" : "Admin signup failed"));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden relative">
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="container mx-auto px-4 h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg"
        >
          <div className="relative backdrop-blur-xl bg-card/40 border border-white/10 rounded-2xl p-8 shadow-2xl">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-purple-500/5 pointer-events-none" />

            <div className="relative z-10">
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                  {mode === "login" ? "Admin Login" : "Create Admin Account"}
                </h1>
                <p className="text-muted-foreground mt-2">
                  {mode === "login"
                    ? "Sign in with your admin account"
                    : "Create an admin account"}
                </p>
              </div>

              <div className="flex gap-2 mb-6 p-1 bg-muted/30 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    mode === "login"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                  }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    mode === "signup"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off" key={`admin-${resetKey}-${mode}`}>
                {/* Autofill trap (hidden) */}
                <input type="text" name="username" autoComplete="username" className="hidden" />
                <input type="password" name="password" autoComplete="current-password" className="hidden" />

                {mode === "signup" && (
                  <div className="relative">
                    <label className="block text-sm font-medium mb-2 text-foreground/80">
                      Full Name (optional)
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setError("");
                        }}
                        placeholder="Admin Name"
                        className="pl-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                )}

                <div className="relative">
                  <label className="block text-sm font-medium mb-2 text-foreground/80">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      placeholder="admin@verivault.com"
                      className="pl-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      required
                      name="verivault_admin_email"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium mb-2 text-foreground/80">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      placeholder="Enter your password"
                      className="pl-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      required
                      name="verivault_admin_password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-red-500 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-gradient-to-r from-primary to-purple-500 hover:shadow-lg hover:shadow-primary/50 transition-shadow"
                >
                  {isSubmitting
                    ? mode === "login"
                      ? "Signing in..."
                      : "Creating..."
                    : mode === "login"
                      ? "Sign In (Admin)"
                      : "Create Admin Account"}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                <span>Are you a user? </span>
                <Link to="/login/user" className="text-primary hover:underline font-medium">
                  User Login
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

