import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Upload, Search, LogOut, Plus, Command, Users, Lock } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import ThemeToggle from "@/react-app/components/ThemeToggle";
import CertificateUpload from "@/react-app/components/CertificateUpload";
import CertificateSearchNew from "@/react-app/components/CertificateSearchNew";
import CertificateList from "@/react-app/components/CertificateList";
import UserManagement from "@/react-app/components/UserManagement";
import CertificatePasswordManagement from "@/react-app/components/CertificatePasswordManagement";
import { authApi } from "@/react-app/lib/api";
import type { Certificate } from "@/shared/types";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"certificates" | "users" | "passwords">("certificates");
  const [searchResults, setSearchResults] = useState<Certificate[] | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const guard = async () => {
      const me = await authApi.me();
      if (!me.success || !me.data) {
        await authApi.logout();
        navigate("/login/admin");
        return;
      }
      if (me.data.role !== "admin") {
        navigate("/dashboard");
      }
    };
    guard();
  }, [navigate]);

  // Command palette keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if (e.key === "Escape") {
        setShowCommandPalette(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await authApi.logout();
    navigate("/login/admin");
  };

  const handleRefresh = () => {
    setSearchResults(undefined); // Clear search results so full list shows
    setRefreshTrigger((prev) => prev + 1); // Trigger reload
  };

  const handleSearchResults = (certs: Certificate[]) => {
    // If there are no results, fall back to full list
    // (CertificateSearch will also show its own empty-state dropdown)
    if (!certs || certs.length === 0) {
      setSearchResults(undefined);
    } else {
      setSearchResults(certs);
    }
  };

  const commands = [
    { label: "Upload Data", action: () => { setActiveTab("certificates"); setUploadOpen(true); setShowCommandPalette(false); }, icon: Upload },
    { label: "Search Student", action: () => { setActiveTab("certificates"); window.setTimeout(() => document.getElementById("certificate-search-input")?.focus(), 0); setShowCommandPalette(false); }, icon: Search },
    { label: "View Passwords", action: () => { setActiveTab("passwords"); setShowCommandPalette(false); }, icon: Lock },
    { label: "Manage Users", action: () => { setActiveTab("users"); setShowCommandPalette(false); }, icon: Users },
    { label: "Logout", action: handleLogout, icon: LogOut },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Command Palette Modal */}
      {showCommandPalette && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-32 px-4"
          onClick={() => setShowCommandPalette(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: -20 }}
            animate={{ scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl backdrop-blur-xl bg-card/90 border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Command className="w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Type a command..."
                  className="border-0 focus-visible:ring-0 bg-transparent"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="p-2">
              {commands
                .filter((cmd) =>
                  cmd.label.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((command) => (
                  <button
                    key={command.label}
                    onClick={() => {
                      command.action();
                      setShowCommandPalette(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-primary/10 transition-colors text-left group"
                  >
                    <command.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="font-medium">{command.label}</span>
                  </button>
                ))}
            </div>
            <div className="p-4 border-t border-border bg-muted/50">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Navigate with ↑↓ arrows</span>
                <span className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-background rounded border">⌘</kbd>
                  <span>+</span>
                  <kbd className="px-2 py-1 bg-background rounded border">K</kbd>
                  <span>to open</span>
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-xl bg-card/40 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-4 sm:gap-8 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent truncate">
              VeriVault Admin
            </h1>
            <button
              onClick={() => setShowCommandPalette(true)}
              className="hidden md:flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-xs sm:text-sm text-muted-foreground"
            >
              <Command className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="px-1.5 sm:px-2 py-0.5 bg-background rounded border text-xs">⌘K</kbd>
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <ThemeToggle />
            <Button onClick={handleLogout} variant="outline" size="sm" className="text-xs sm:text-sm">
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6 sm:py-8 md:py-12">
        {/* Tabs */}
        <div className="mb-6 sm:mb-8">
          <div className="flex gap-2 border-b border-border overflow-x-auto">
            <button
              onClick={() => setActiveTab("certificates")}
              className={`px-6 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === "certificates"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Certificates
            </button>
            <button
              onClick={() => setActiveTab("passwords")}
              className={`px-6 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === "passwords"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Certificate Passwords
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`px-6 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === "users"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              User Management
            </button>
          </div>
        </div>

        {activeTab === "certificates" && (
          <>
            <div className="mb-6">
              <CertificateUpload
                onSuccess={handleRefresh}
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                hideTrigger
              />
            </div>

            {/* Quick actions */}
            <div className="mb-8 sm:mb-10 md:mb-12">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                {[
                  {
                    title: "Upload Certificates",
                    description: "Bulk upload from Excel or CSV",
                    icon: Upload,
                    color: "from-blue-500 to-cyan-500",
                    action: () => setUploadOpen(true),
                  },
                  {
                    title: "Search Records",
                    description: "Find and manage certificates",
                    icon: Search,
                    color: "from-purple-500 to-pink-500",
                    action: () => document.getElementById("certificate-search-input")?.focus(),
                  },
                  {
                    title: "Add Certificate",
                    description: "Create a new certificate",
                    icon: Plus,
                    color: "from-green-500 to-emerald-500",
                    action: () => {
                      setUploadOpen(true);
                    },
                  },
                ].map((action, index) => (
                  <motion.button
                    key={action.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={action.action}
                    className="group relative overflow-hidden backdrop-blur-xl bg-card/40 border border-border/50 rounded-2xl p-4 sm:p-6 hover:shadow-xl transition-all text-left"
                  >
                    <div className="relative z-10">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                        <action.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold mb-1">{action.title}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    
                    {/* Hover gradient effect */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Search Certificates</h2>
              <CertificateSearchNew
                onResults={(certs) => {
                  handleSearchResults(certs);
                }}
                onSearchingChange={setIsSearching}
              />
            </div>

            {/* Certificates list */}
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-semibold">All Certificates</h2>
                <Button variant="outline" size="sm" onClick={handleRefresh} className="text-xs sm:text-sm">
                  Refresh
                </Button>
              </div>
              
              <CertificateList
                refreshTrigger={refreshTrigger}
                onRefresh={handleRefresh}
                certificatesOverride={searchResults}
                isSearching={isSearching}
                isAdmin={true}
              />
            </div>
          </>
        )}

        {activeTab === "users" && (
          <UserManagement />
        )}

        {activeTab === "passwords" && (
          <CertificatePasswordManagement />
        )}
      </main>
    </div>
  );
}
