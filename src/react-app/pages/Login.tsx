import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router";
import { Lock, Mail, CheckCircle2, AlertCircle, User, UserPlus, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Link } from "react-router";
import ShieldMascot from "@/react-app/components/ShieldMascot";

type AuthMode = "login" | "signup";
type UserType = "user" | "admin";

export default function Login() {
  const location = useLocation();
  const [resetKey, setResetKey] = useState(0);
  const [userType, setUserType] = useState<UserType>(location.pathname.includes("/admin") ? "admin" : "user");
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [focusedField, setFocusedField] = useState<"none" | "email" | "password" | "name" | "confirmPassword">("none");
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const getRedirectUrl = () => {
    const redirect = searchParams.get("redirect");
    return redirect && redirect.startsWith("/") ? redirect : null;
  };

  useEffect(() => {
    // Update userType based on URL
    const isAdmin = location.pathname.includes("/admin");
    setUserType(isAdmin ? "admin" : "user");
  }, [location.pathname]);

  useEffect(() => {
    // Ensure fields are empty on mount
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setError("");

    // Some browsers inject autofill values *after* initial render of controlled inputs.
    // Force a re-mount shortly after mount to wipe any injected values.
    const t = window.setTimeout(() => {
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setName("");
      setResetKey((k) => k + 1);
    }, 150);
    
    return () => {
      window.clearTimeout(t);
    };
  }, []);

  // Mascot eye-tracking based on mouse position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Clear form when switching modes or user types
  useEffect(() => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setError("");
    setSuccess(false);
  }, [mode, userType]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }
    
    setIsSubmitting(true);
    setError("");

    try {
      const { authApi } = await import("@/react-app/lib/api");
      const response = userType === "admin" 
        ? await authApi.loginAdmin({ 
            email: email.trim().toLowerCase(), 
            password: password.trim() 
          })
        : await authApi.loginUser({ 
            email: email.trim().toLowerCase(), 
            password: password.trim() 
          });

      if (response.success && response.data) {
        setSuccess(true);
        setTimeout(() => {
          const redirectUrl = getRedirectUrl();
          navigate(redirectUrl || (userType === "admin" ? "/admin" : "/dashboard"));
        }, 800);
      } else {
        setError(response.error || "Invalid email or password. Please try again.");
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      setError("Login failed. Please check your connection and try again.");
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setIsSubmitting(true);
    setError("");

    try {
      const { authApi } = await import("@/react-app/lib/api");
      const response = userType === "admin"
        ? await authApi.registerAdmin({ 
            email: email.trim().toLowerCase(), 
            password: password.trim(),
            name: name.trim() || undefined
          })
        : await authApi.register({ 
            email: email.trim().toLowerCase(), 
            password: password.trim(),
            name: name.trim() || undefined
          });

      if (response.success && response.data) {
        setSuccess(true);
        setTimeout(() => {
          const redirectUrl = getRedirectUrl();
          navigate(redirectUrl || (userType === "admin" ? "/admin" : "/dashboard"));
        }, 800);
      } else {
        setError(response.error || "Registration failed. Please try again.");
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      setError("Registration failed. Please check your connection and try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-primary/10 blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{ top: "10%", left: "20%" }}
        />
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-purple-500/10 blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{ bottom: "10%", right: "20%" }}
        />
      </div>

      <div className="container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
        <div className="w-full max-w-6xl grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-8 items-center">
          <div className="w-full max-w-lg my-auto">
            {/* Back to Home Button */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-4 sm:mb-6"
            >
              <Link to="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </motion.div>

            {/* Login Form */}
            <motion.div
              key={userType}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative"
            >
              {/* Glassmorphism container */}
              <div className="relative backdrop-blur-xl bg-card/40 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
              {/* Gradient overlay */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-purple-500/5 pointer-events-none" />

              <div className="relative z-10">
                {/* Logo and title */}
                <div className="text-center mb-6 sm:mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg"
                  >
                    {userType === "admin" ? (
                      <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    ) : mode === "login" ? (
                      <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    ) : (
                      <UserPlus className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    )}
                  </motion.div>
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                    VeriVault
                  </h1>
                  <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
                    {userType === "admin" 
                      ? (mode === "login" ? "Admin Authentication" : "Create Admin Account")
                      : (mode === "login" ? "User Authentication" : "Create Your Account")
                    }
                  </p>
                </div>

                {/* Toggle between User and Admin */}
                <div className="flex gap-2 mb-3 sm:mb-4 p-1 bg-muted/30 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setUserType("user");
                      navigate("/login/user");
                    }}
                    className={`flex-1 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-all ${
                      userType === "user"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <User className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                    User
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserType("admin");
                      navigate("/login/admin");
                    }}
                    className={`flex-1 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-all ${
                      userType === "admin"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Shield className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                    Admin
                  </button>
                </div>

                {/* Toggle between Login and Sign Up */}
                <div className="flex gap-2 mb-4 sm:mb-6 p-1 bg-muted/30 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
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
                    onClick={() => setMode("signup")}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                      mode === "signup"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Login form */}
                <AnimatePresence mode="wait">
                  {mode === "login" ? (
                    <motion.form
                      key={`login-${resetKey}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3 }}
                      onSubmit={handleLogin}
                      className="space-y-4 sm:space-y-6"
                      autoComplete="off"
                    >
                      {/* Autofill trap (hidden) */}
                      <input type="text" name="username" autoComplete="username" className="hidden" />
                      <input type="password" name="password" autoComplete="current-password" className="hidden" />

                  {/* Email field */}
                  <div className="relative">
                    <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-foreground/80">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setError(""); // Clear error when user types
                        }}
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => setFocusedField("none")}
                        placeholder="Email or Student ID / Roll No"
                        className="pl-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        required
                        name="verivault_email"
                        autoComplete="off"
                        autoFocus={false}
                      />
                      <motion.div
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-purple-500"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: focusedField === "email" ? 1 : 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ transformOrigin: "left" }}
                      />
                    </div>
                  </div>

                      {/* Password field */}
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
                            onFocus={() => setFocusedField("password")}
                            onBlur={() => setFocusedField("none")}
                            placeholder="Enter your password"
                            className="pl-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            required
                            name="verivault_password"
                            autoComplete="new-password"
                          />
                          <motion.div
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-purple-500"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: focusedField === "password" ? 1 : 0 }}
                            transition={{ duration: 0.3 }}
                            style={{ transformOrigin: "left" }}
                          />
                        </div>
                      </div>

                      {/* Error message */}
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-red-500 text-sm mb-4 flex items-center gap-2"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {error}
                        </motion.div>
                      )}

                      {/* Submit button */}
                      <div className="relative group">
                        <Button
                          type="submit"
                          disabled={isSubmitting || success}
                          className="w-full h-11 sm:h-12 text-sm sm:text-base relative overflow-hidden bg-gradient-to-r from-primary to-purple-500 hover:shadow-lg hover:shadow-primary/50 transition-shadow"
                        >
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-t from-purple-600 to-primary"
                            initial={{ y: "100%" }}
                            whileHover={{ y: 0 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                          />
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {success ? (
                              <>
                                <CheckCircle2 className="w-5 h-5" />
                                Success!
                              </>
                        ) : isSubmitting ? (
                          <>
                            <motion.div
                              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                            {mode === "login" 
                              ? (userType === "admin" ? "Signing in as Admin..." : "Signing in...")
                              : (userType === "admin" ? "Creating admin account..." : "Creating account...")
                            }
                          </>
                        ) : (
                          mode === "login" 
                            ? (userType === "admin" ? "Sign In (Admin)" : "Sign In")
                            : (userType === "admin" ? "Create Admin Account" : "Create Account")
                        )}
                          </span>
                        </Button>
                      </div>
                    </motion.form>
                  ) : (
                    <motion.form
                      key={`signup-${resetKey}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3 }}
                      onSubmit={handleSignup}
                      className="space-y-4 sm:space-y-6"
                      autoComplete="off"
                    >
                      {/* Autofill trap (hidden) */}
                      <input type="text" name="username" autoComplete="username" className="hidden" />
                      <input type="password" name="password" autoComplete="current-password" className="hidden" />

                      {/* Name field - only for signup */}
                      {mode === "signup" && (
                        <div className="relative">
                          <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-foreground/80">
                            Full Name {userType === "admin" ? "(Optional)" : "(Optional)"}
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
                            onFocus={() => setFocusedField("name")}
                            onBlur={() => setFocusedField("none")}
                            placeholder="John Doe"
                            className="pl-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            name="verivault_name"
                            autoComplete="off"
                          />
                          <motion.div
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-purple-500"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: focusedField === "name" ? 1 : 0 }}
                            transition={{ duration: 0.3 }}
                            style={{ transformOrigin: "left" }}
                          />
                        </div>
                        </div>
                      )}

                      {/* Email field */}
                      <div className="relative">
                        <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-foreground/80">
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
                            onFocus={() => setFocusedField("email")}
                            onBlur={() => setFocusedField("none")}
                            placeholder="your.email@example.com"
                            className="pl-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            required
                            name="verivault_email"
                            autoComplete="off"
                          />
                          <motion.div
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-purple-500"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: focusedField === "email" ? 1 : 0 }}
                            transition={{ duration: 0.3 }}
                            style={{ transformOrigin: "left" }}
                          />
                        </div>
                      </div>

                      {/* Password field */}
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
                            onFocus={() => setFocusedField("password")}
                            onBlur={() => setFocusedField("none")}
                            placeholder="At least 6 characters"
                            className="pl-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            required
                            name="verivault_password"
                            autoComplete="new-password"
                            minLength={6}
                          />
                          <motion.div
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-purple-500"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: focusedField === "password" ? 1 : 0 }}
                            transition={{ duration: 0.3 }}
                            style={{ transformOrigin: "left" }}
                          />
                        </div>
                      </div>

                      {/* Confirm Password field */}
                      <div className="relative">
                        <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-foreground/80">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              setError("");
                            }}
                            onFocus={() => setFocusedField("confirmPassword")}
                            onBlur={() => setFocusedField("none")}
                            placeholder="Confirm your password"
                            className="pl-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            required
                            name="verivault_confirm_password"
                            autoComplete="new-password"
                          />
                          <motion.div
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-purple-500"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: focusedField === "confirmPassword" ? 1 : 0 }}
                            transition={{ duration: 0.3 }}
                            style={{ transformOrigin: "left" }}
                          />
                        </div>
                      </div>

                      {/* Error message */}
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-red-500 text-sm mb-4 flex items-center gap-2"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {error}
                        </motion.div>
                      )}

                      {/* Submit button */}
                      <div className="relative group">
                        <Button
                          type="submit"
                          disabled={isSubmitting || success}
                          className="w-full h-11 sm:h-12 text-sm sm:text-base relative overflow-hidden bg-gradient-to-r from-primary to-purple-500 hover:shadow-lg hover:shadow-primary/50 transition-shadow"
                        >
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-t from-purple-600 to-primary"
                            initial={{ y: "100%" }}
                            whileHover={{ y: 0 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                          />
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {success ? (
                              <>
                                <CheckCircle2 className="w-5 h-5" />
                                Account Created!
                              </>
                            ) : isSubmitting ? (
                              <>
                                <motion.div
                                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                />
                                Creating Account...
                              </>
                            ) : (
                              <>
                                {userType === "admin" ? (
                                  <>
                                    <Shield className="w-5 h-5" />
                                    Create Admin Account
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="w-5 h-5" />
                                    Create Account
                                  </>
                                )}
                              </>
                            )}
                          </span>
                        </Button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Footer */}
                <div className="text-center mt-4 sm:mt-6">
                  {mode === "login" ? (
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Don't have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("signup")}
                        className="text-primary hover:underline font-medium transition-colors"
                      >
                        Create Account
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="text-primary hover:underline font-medium transition-colors"
                      >
                        Sign In
                      </button>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1.5 sm:mt-2">
                    Secured by VeriVault Authentication
                  </p>
                </div>
              </div>
              </div>
            </motion.div>
          </div>

          {/* Animated mascot on large screens */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:flex items-center justify-center"
          >
            <ShieldMascot
              watchingField={
                focusedField === "password"
                  ? "password"
                  : focusedField === "email"
                  ? "email"
                  : "none"
              }
              mouseX={mousePosition.x}
              mouseY={mousePosition.y}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
