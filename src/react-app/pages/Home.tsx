import { motion, useScroll, useTransform } from "framer-motion";
import { Link, useNavigate } from "react-router";
import { Shield, Search, Upload, CheckCircle, Lock, Zap } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import ThemeToggle from "@/react-app/components/ThemeToggle";
import { authApi } from "@/react-app/lib/api";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/react-app/components/ui/alert-dialog";

export default function HomePage() {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  
  // Shield assembly states based on scroll
  const shieldScale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.8, 1, 1, 1.1]);
  const shieldOpacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.3, 1, 1, 1]);
  const glowIntensity = useTransform(scrollYProgress, [0.7, 1], [0, 1]);

  const handleVerifyClick = async () => {
    // Check if user is authenticated
    const me = await authApi.me();
    if (me.success && me.data) {
      // User is authenticated, proceed to verify page
      navigate("/verify");
    } else {
      // User is not authenticated, show login dialog
      setShowLoginDialog(true);
    }
  };

  const handleLoginConfirm = () => {
    setShowLoginDialog(false);
    navigate("/login/user?redirect=/verify");
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Fixed Theme Toggle */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Scrolling Guardian Shield - Fixed to right side */}
      <motion.div
        className="fixed right-8 top-1/2 -translate-y-1/2 z-40 hidden xl:block"
        style={{
          scale: shieldScale,
          opacity: shieldOpacity,
        }}
      >
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="heroShieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="dark:text-cyan-400 text-blue-500" stopColor="currentColor" />
              <stop offset="100%" className="dark:text-purple-500 text-blue-600" stopColor="currentColor" />
            </linearGradient>
            <filter id="heroGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Shield parts that assemble on scroll */}
          <motion.path
            d="M100 25 L160 50 L160 100 Q160 150 100 175 Q40 150 40 100 L40 50 Z"
            fill="url(#heroShieldGradient)"
            stroke="currentColor"
            strokeWidth="2"
            className="dark:text-cyan-400 text-blue-500"
            filter="url(#heroGlow)"
            style={{
              rotate: useTransform(scrollYProgress, [0, 0.3], [45, 0]),
              x: useTransform(scrollYProgress, [0, 0.3], [50, 0]),
            }}
          />

          {/* Checkmark - appears at 100% scroll */}
          <motion.path
            d="M80 100 L92 112 L120 80"
            stroke="white"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={{
              pathLength: useTransform(scrollYProgress, [0.7, 1], [0, 1]),
            }}
          />

          {/* Glow effect at verification */}
          <motion.circle
            cx={100}
            cy={100}
            r={80}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            className="dark:text-green-400 text-green-500"
            style={{
              opacity: glowIntensity,
              scale: useTransform(glowIntensity, [0, 1], [0.8, 1.2]),
            }}
          />
        </svg>
      </motion.div>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl relative z-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mx-auto mb-6 sm:mb-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-2xl"
          >
            <Shield className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" />
          </motion.div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6">
            <span className="bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent animate-pulse">
              VeriVault
            </span>
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-6 sm:mb-8 leading-relaxed px-4">
            Flagship Grade Certificate Verification System
          </p>

          <p className="text-base sm:text-lg text-muted-foreground/80 mb-8 sm:mb-12 max-w-2xl mx-auto px-4">
            Secure, fast, and beautiful certificate management with advanced verification technology
          </p>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center px-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full sm:w-auto"
            >
              <Button 
                size="lg" 
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg bg-gradient-to-r from-primary to-purple-500 hover:shadow-lg hover:shadow-primary/50 transition-all"
                onClick={handleVerifyClick}
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Verify Certificate
              </Button>
            </motion.div>
            <Link to="/login/user" className="w-full sm:w-auto">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full sm:w-auto"
              >
                <Button size="lg" variant="secondary" className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg">
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  User Login
                </Button>
              </motion.div>
            </Link>
            <Link to="/login/admin" className="w-full sm:w-auto">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full sm:w-auto"
              >
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg border-2 hover:bg-primary/10">
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Admin Login
                </Button>
              </motion.div>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 md:py-20 px-4 relative">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8 sm:mb-12 md:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
              Powerful Features
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Everything you need for secure certificate verification
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {[
              {
                icon: Shield,
                title: "Secure Verification",
                description: "Military-grade encryption and secure authentication to protect your certificates",
                color: "from-blue-500 to-cyan-500"
              },
              {
                icon: Upload,
                title: "Bulk Upload",
                description: "Upload hundreds of certificates at once with Excel/CSV support",
                color: "from-purple-500 to-pink-500"
              },
              {
                icon: Zap,
                title: "Instant Search",
                description: "Lightning-fast certificate lookup with real-time validation",
                color: "from-orange-500 to-red-500"
              },
              {
                icon: CheckCircle,
                title: "QR Codes",
                description: "Generate QR codes for each certificate for quick mobile verification",
                color: "from-green-500 to-emerald-500"
              },
              {
                icon: Search,
                title: "Public Verification",
                description: "Allow anyone to verify certificates without login credentials",
                color: "from-cyan-500 to-blue-500"
              },
              {
                icon: Lock,
                title: "Admin Control",
                description: "Complete CRUD operations with secure admin dashboard",
                color: "from-indigo-500 to-purple-500"
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="relative group h-full">
                  {/* Glassmorphism card */}
                  <div className="backdrop-blur-xl bg-card/40 border border-border/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all h-full">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="container mx-auto max-w-4xl"
        >
          <div className="relative backdrop-blur-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-white/10 rounded-3xl p-12 text-center shadow-2xl">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 to-purple-500/10 pointer-events-none" />
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Ready to get started?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join the future of certificate verification with VeriVault
              </p>
            <Link to="/login/user">
                <Button size="lg" className="h-14 px-10 text-lg bg-gradient-to-r from-primary to-purple-500 hover:shadow-lg hover:shadow-primary/50 transition-all">
                  Get Started Now
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/50">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 VeriVault. All rights reserved.</p>
        </div>
      </footer>

      {/* Login Required Dialog */}
      <AlertDialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Login Required</AlertDialogTitle>
            <AlertDialogDescription>
              You need to be logged in to verify certificates. Please sign in to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLoginConfirm}>
              Login Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
