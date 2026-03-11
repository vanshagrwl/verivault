import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Search, AlertCircle, Mail, ShieldCheck, X, Clock, TrendingUp } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import HolographicCard from "@/react-app/components/HolographicCard";
import ThemeToggle from "@/react-app/components/ThemeToggle";
import { Link } from "react-router";
import { certificatesApi } from "@/react-app/lib/api";
import { Badge } from "@/react-app/components/ui/badge";
import type { Certificate } from "@/shared/types";

interface SearchSuggestion {
  type: "recent" | "keyword" | "certificate";
  value: string;
  label: string;
  icon?: React.ReactNode;
  certificate?: Certificate;
}

export default function Verify() {
  const [certificateId, setCertificateId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [certificate, setCertificate] = useState<any>(null);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [otpStep, setOtpStep] = useState<"none" | "request" | "verify">("none");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isRequestingOTP, setIsRequestingOTP] = useState(false);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const toErrorMessage = (err: unknown, fallback: string): string => {
    if (!err) return fallback;
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message || fallback;
    try {
      const json = JSON.stringify(err);
      return json === "{}" ? fallback : json;
    } catch {
      return String(err) || fallback;
    }
  };

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("certificateVerifyHistory");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Real-time search suggestions
  useEffect(() => {
    const trimmed = certificateId.trim();

    if (!trimmed) {
      const recentSuggestions: SearchSuggestion[] = recentSearches.map((search) => ({
        type: "recent",
        value: search,
        label: search,
        icon: <Clock className="w-4 h-4" />,
      }));
      setSuggestions(recentSuggestions);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await certificatesApi.searchPublic(trimmed);
        if (response.success && response.data) {
          const results = response.data as Certificate[];

          // Generate keyword suggestions
          const suggestionSet = new Set<string>();
          results.forEach((cert) => {
            if (cert.name) {
              const nameParts = cert.name.toLowerCase().split(/\s+/);
              nameParts.forEach((part) => {
                if (part.startsWith(trimmed.toLowerCase())) {
                  suggestionSet.add(part);
                }
              });
              suggestionSet.add(cert.name);
            }
            if (cert.id?.toLowerCase().includes(trimmed.toLowerCase())) {
              suggestionSet.add(cert.id);
            }
            if (cert.rollNo?.toLowerCase().includes(trimmed.toLowerCase())) {
              suggestionSet.add(cert.rollNo);
            }
          });

          const keywordSuggestions: SearchSuggestion[] = Array.from(suggestionSet)
            .slice(0, 3)
            .map((keyword) => ({
              type: "keyword" as const,
              value: keyword,
              label: keyword,
              icon: <TrendingUp className="w-4 h-4" />,
            }));

          const certificateSuggestions: SearchSuggestion[] = results.slice(0, 3).map((cert) => ({
            type: "certificate" as const,
            value: cert.id,
            label: `${cert.name} - ${cert.rollNo || "N/A"}`,
            certificate: cert,
          }));

          const allSuggestions = [...keywordSuggestions, ...certificateSuggestions];
          setSuggestions(allSuggestions);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      }
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [certificateId, recentSearches]);

  // Check for certificate ID in URL params (for QR code verification)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      setCertificateId(id);
      // Auto-verify if ID is in URL
      const verifyId = async () => {
        setIsSearching(true);
        try {
          const { certificatesApi } = await import("@/react-app/lib/api");
          const response = await certificatesApi.verify(id);
          if (response.success && response.data) {
            setCertificate(response.data);
          } else {
            setError(response.error || "Certificate not found");
          }
        } catch (err) {
          setError("Failed to verify certificate");
        } finally {
          setIsSearching(false);
        }
      };
      verifyId();
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certificateId.trim()) {
      setError("Please enter a Certificate ID or Roll Number");
      return;
    }

    setError("");
    setCertificate(null);
    setIsSearching(true);
    setShowSuggestions(false);
    addRecentSearch(certificateId.trim());

    try {
      // Try direct verify first (by certificate ID)
      let response = await certificatesApi.verify(certificateId.trim().toUpperCase());
      
      // If not found, try public search (by rollNo or name)
      if (!response.success || !response.data) {
        const searchRes = await certificatesApi.searchPublic(certificateId.trim());
        if (searchRes.success && searchRes.data && searchRes.data.length > 0) {
          // Use the first match
          response = await certificatesApi.verify(searchRes.data[0].id);
        }
      }

      if (response.success && response.data) {
        setCertificate(response.data);
        if ((response.data as any).status === "revoked") {
          setError("This certificate has been revoked.");
        }
        if ((response.data as any).verifiedAt) {
          setIsVerified(true);
        }
      } else {
        setError(toErrorMessage(response.error, "Certificate not found. Please check the Certificate ID or Roll No."));
        // Shake animation trigger
        const input = document.getElementById("certificate-input");
        if (input) {
          input.classList.add("animate-shake");
          setTimeout(() => input.classList.remove("animate-shake"), 500);
        }
      }
    } catch (error) {
      setError("Failed to verify certificate. Please try again.");
      const input = document.getElementById("certificate-input");
      if (input) {
        input.classList.add("animate-shake");
        setTimeout(() => input.classList.remove("animate-shake"), 500);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const addRecentSearch = (search: string) => {
    const updated = [search, ...recentSearches.filter((s) => s !== search)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("certificateVerifyHistory", JSON.stringify(updated));
  };

  const handleSuggestionClick = async (suggestion: SearchSuggestion) => {
    if (suggestion.type === "certificate" && suggestion.certificate) {
      setCertificateId(suggestion.certificate.id);
      addRecentSearch(suggestion.certificate.id);
      setShowSuggestions(false);
      // Trigger search with the certificate
      const formEvent = new Event("submit", { bubbles: true }) as unknown as React.FormEvent;
      formEvent.preventDefault = () => {};
      await new Promise((resolve) => {
        setTimeout(() => {
          const input = document.getElementById("certificate-input") as HTMLInputElement;
          if (input) {
            input.value = suggestion.certificate!.id;
            setCertificateId(suggestion.certificate!.id);
            // Trigger search
            handleSearch(formEvent);
            resolve(null);
          }
        }, 0);
      });
    } else {
      setCertificateId(suggestion.value);
      addRecentSearch(suggestion.value);
      inputRef.current?.focus();
    }
  };

  const handleClearSearch = () => {
    setCertificateId("");
    setError("");
    setCertificate(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const getStatusColor = (status?: string) => {
    if (status === "revoked") return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  };

  const getStatusText = (status?: string) => {
    if (status === "revoked") return "Revoked";
    return "Issued";
  };

  const handleRequestOTP = async () => {
    if (!certificate || !email.trim()) {
      setError("Please enter your registered email");
      return;
    }
    setIsRequestingOTP(true);
    setError("");
    try {
      const response = await certificatesApi.requestOTP(certificate.id, email.trim());
      if (response.success) {
        setOtpStep("verify");
      } else {
        setError(toErrorMessage(response.error, "Failed to send OTP"));
      }
    } catch (err) {
      setError("Failed to send OTP. Please try again.");
    } finally {
      setIsRequestingOTP(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!certificate || !otp.trim() || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }
    setIsVerifyingOTP(true);
    setError("");
    try {
      const response = await certificatesApi.verifyOTP(certificate.id, email.trim(), otp.trim());
      if (response.success && response.data) {
        setIsVerified(true);
        setCertificate(response.data);
        setOtpStep("none");
        setOtp("");
      } else {
        setError(toErrorMessage(response.error, "Invalid OTP"));
      }
    } catch (err) {
      setError("Failed to verify OTP. Please try again.");
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Background decorations */}
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
          style={{ top: "20%", left: "10%" }}
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
          style={{ bottom: "20%", right: "10%" }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-card/40">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
          <Link to="/" className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent truncate">
            VeriVault
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6 sm:py-8 md:py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto mb-6 sm:mb-8 md:mb-12 text-center"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
            Verify Certificate
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground px-4">
            Enter a Certificate ID or Roll No to verify its authenticity
          </p>
        </motion.div>

        {/* Search form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl mx-auto mb-6 sm:mb-8 md:mb-12"
          ref={searchBoxRef}
        >
          <form onSubmit={handleSearch} className="relative">
            <div className="backdrop-blur-xl bg-card/40 border border-border/50 rounded-2xl p-4 sm:p-6 shadow-xl">
              <div className="relative">
                <Input
                  ref={inputRef}
                  id="certificate-input"
                  type="text"
                  value={certificateId}
                  onChange={(e) => {
                    setCertificateId(e.target.value);
                    setError("");
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    setIsFocused(true);
                    setShowSuggestions(true);
                  }}
                  onBlur={() => {
                    setIsFocused(false);
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  placeholder="Search by Certificate ID, Roll No, or Name..."
                  className={`h-12 sm:h-14 pl-10 sm:pl-12 pr-10 text-base sm:text-lg bg-background/50 border-2 transition-all ${
                    error
                      ? "border-red-500 text-red-500"
                      : isFocused
                      ? "border-primary"
                      : "border-border/50"
                  }`}
                  autoComplete="off"
                />
                
                {/* Search icon with scan animation */}
                <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2">
                  <motion.div
                    animate={
                      isFocused || isSearching
                        ? {
                            scale: [1, 1.2, 1],
                            opacity: [1, 0.5, 1],
                          }
                        : {}
                    }
                    transition={{
                      duration: 2,
                      repeat: isFocused || isSearching ? Infinity : 0,
                    }}
                  >
                    <Search className={`w-4 h-4 sm:w-5 sm:h-5 ${error ? "text-red-500" : "text-primary"}`} />
                  </motion.div>
                </div>

                {/* Clear button */}
                {certificateId && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 hover:text-muted-foreground"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}

                {/* Animated bottom border */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-purple-500"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: isFocused ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ transformOrigin: "left" }}
                />
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 4 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute z-20 w-full mt-2 bg-card border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto left-0 right-0"
                >
                  {/* Recent Searches */}
                  {!certificateId && suggestions.length > 0 && (
                    <>
                      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border sticky top-0 bg-card/50">
                        Recent Searches
                      </div>
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={`suggestion-${index}`}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSuggestionClick(suggestion);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-accent transition-colors duration-100 border-b border-border last:border-b-0 flex items-center gap-2 text-sm"
                        >
                          {suggestion.icon && <span className="text-muted-foreground">{suggestion.icon}</span>}
                          <span className="text-foreground">{suggestion.label}</span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Keyword Suggestions */}
                  {certificateId && suggestions.some((s) => s.type === "keyword") && (
                    <>
                      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border sticky top-0 bg-card/50">
                        Suggestions
                      </div>
                      {suggestions
                        .filter((s) => s.type === "keyword")
                        .map((suggestion, index) => (
                          <button
                            key={`keyword-${index}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSuggestionClick(suggestion);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-accent transition-colors duration-100 border-b border-border flex items-center gap-2 text-sm"
                          >
                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground">{suggestion.label}</span>
                          </button>
                        ))}
                    </>
                  )}

                  {/* Certificate Results */}
                  {certificateId && suggestions.some((s) => s.type === "certificate") && (
                    <>
                      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border sticky top-0 bg-card/50">
                        Matching Certificates
                      </div>
                      {suggestions
                        .filter((s) => s.type === "certificate")
                        .map((suggestion, index) => (
                          <button
                            key={`cert-${index}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSuggestionClick(suggestion);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-accent transition-colors duration-100 border-b border-border last:border-b-0 text-sm"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="font-semibold text-foreground truncate">{suggestion.certificate?.name}</p>
                              <Badge className={`${getStatusColor(suggestion.certificate?.status)} text-xs whitespace-nowrap`}>
                                {getStatusText(suggestion.certificate?.status)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{suggestion.certificate?.rollNo && `Roll No: ${suggestion.certificate.rollNo}`}</p>
                          </button>
                        ))}
                    </>
                  )}

                  {/* No Results */}
                  {certificateId && suggestions.length === 0 && (
                    <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                      <p className="font-medium">No results for "{certificateId}"</p>
                      <p className="text-xs mt-1">Try different keywords</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Error message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 flex items-center gap-2 text-red-500"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isSearching}
                className="w-full mt-4 sm:mt-6 h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-primary to-purple-500 hover:shadow-lg hover:shadow-primary/50 transition-all relative overflow-hidden"
              >
                {/* Liquid fill animation */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-t from-purple-600 to-primary"
                  initial={{ y: "100%" }}
                  whileHover={{ y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
                
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isSearching ? (
                    <>
                      <motion.div
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Verify Certificate
                    </>
                  )}
                </span>
              </Button>
            </div>
          </form>
        </motion.div>

        {/* Certificate result */}
        <AnimatePresence>
          {certificate && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              {/* OTP Verification Flow */}
              {!isVerified && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="backdrop-blur-xl bg-card/40 border border-border/50 rounded-2xl p-4 sm:p-6 shadow-xl"
                >
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    <h3 className="text-lg sm:text-xl font-semibold">Verify Certificate</h3>
                  </div>
                  
                  {otpStep === "none" && (
                    <div className="space-y-3 sm:space-y-4">
                      <p className="text-sm sm:text-base text-muted-foreground">
                        To verify and download this certificate, please enter your registered email address.
                      </p>
                      <div className="space-y-2">
                        <label className="text-xs sm:text-sm font-medium">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                          <Input
                            type="email"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setError("");
                            }}
                            placeholder="your.email@example.com"
                            className="pl-9 sm:pl-10 h-10 sm:h-11 text-sm sm:text-base"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleRequestOTP}
                        disabled={isRequestingOTP || !email.trim()}
                        className="w-full h-10 sm:h-11 text-sm sm:text-base"
                      >
                        {isRequestingOTP ? "Sending OTP..." : "Request OTP"}
                      </Button>
                    </div>
                  )}

                  {otpStep === "verify" && (
                    <div className="space-y-3 sm:space-y-4">
                      <div className="p-3 sm:p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <p className="text-xs sm:text-sm text-green-600">
                          ✓ OTP sent to <strong>{email}</strong>. Please check your email.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs sm:text-sm font-medium">Enter 6-digit OTP</label>
                        <Input
                          type="text"
                          value={otp}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                            setOtp(val);
                            setError("");
                          }}
                          placeholder="000000"
                          className="text-center text-xl sm:text-2xl font-mono tracking-widest h-12 sm:h-14"
                          maxLength={6}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                        <span>Didn't receive OTP?</span>
                        <button
                          type="button"
                          onClick={handleRequestOTP}
                          disabled={isRequestingOTP}
                          className="text-primary hover:underline disabled:opacity-60"
                        >
                          {isRequestingOTP ? "Resending..." : "Resend OTP"}
                        </button>
                      </div>
                      <div className="flex gap-2 pt-1 sm:pt-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setOtpStep("none");
                            setOtp("");
                          }}
                          className="flex-1 h-10 sm:h-11 text-sm sm:text-base"
                        >
                          Back
                        </Button>
                        <Button
                          onClick={handleVerifyOTP}
                          disabled={isVerifyingOTP || otp.length !== 6}
                          className="flex-1 h-10 sm:h-11 text-sm sm:text-base"
                        >
                          {isVerifyingOTP ? "Verifying..." : "Verify OTP"}
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Verified Certificate Display */}
              {isVerified && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="backdrop-blur-xl bg-green-500/10 border border-green-500/20 rounded-2xl p-4 mb-4"
                >
                  <div className="flex items-center gap-2 text-green-600">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="font-medium">Certificate verified! You can now download it.</span>
                  </div>
                </motion.div>
              )}

              <HolographicCard certificate={certificate} showDownload={isVerified} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Help text */}
        {!certificate && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="max-w-2xl mx-auto text-center text-muted-foreground"
          >
            <p className="text-sm">
              Don't have a certificate ID? Contact your institution for assistance.
            </p>
          </motion.div>
        )}
      </main>

      {/* Add shake animation to global styles */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
          20%, 40%, 60%, 80% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.5s;
        }
      `}</style>
    </div>
  );
}
