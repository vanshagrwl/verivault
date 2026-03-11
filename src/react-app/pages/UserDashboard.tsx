import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { Award, LogOut, Search, PlusCircle } from "lucide-react";
import ThemeToggle from "@/react-app/components/ThemeToggle";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import HolographicCard from "@/react-app/components/HolographicCard";
import { authApi, certificatesApi } from "@/react-app/lib/api";
import type { Certificate } from "@/shared/types";

export default function UserDashboard() {
  const navigate = useNavigate();
  const [meChecked, setMeChecked] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [selected, setSelected] = useState<Certificate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [claimId, setClaimId] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError("");
    const res = await certificatesApi.my();
    if (res.success && res.data) {
      setCertificates(res.data);
    } else {
      setError(res.error || "Failed to load your certificates");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const boot = async () => {
      const me = await authApi.me();
      if (!me.success || !me.data) {
        await authApi.logout();
        navigate("/login/user");
        return;
      }
      if (me.data.role !== "user") {
        navigate("/admin");
        return;
      }
      setMeChecked(true);
      await load();
    };
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await authApi.logout();
    navigate("/");
  };

  const handleClaim = async () => {
    if (!claimId.trim()) return;
    setClaimBusy(true);
    setError("");
    setInfo("");
    
    // First try to search by certificate ID or rollNo
    const searchRes = await certificatesApi.searchPublic(claimId.trim());
    if (searchRes.success && searchRes.data && searchRes.data.length > 0) {
      // Found certificate(s) - pick the first one
      const cert = searchRes.data[0];
      const claimRes = await certificatesApi.claim(cert.id);
      if (claimRes.success) {
        // show preview of found certificate regardless of claimed status
        setSelected(claimRes.data || cert);
        if (claimRes.alreadyClaimed) {
          setInfo("This certificate has already been claimed by another user.");
        } else {
          setInfo("Certificate found. You can verify it using the dialog below.");
        }
        // leave claimId value intact so user can adjust or re-search
        setClaimBusy(false);
        return;
      }
    }
    
    // If search didn't work, try direct claim by ID
    const res = await certificatesApi.claim(claimId.trim().toUpperCase());
    if (!res.success) {
      setError(res.error || "Certificate not found. Please check the Certificate ID or Roll No.");
      setClaimBusy(false);
      return;
    }
    // successful direct lookup; show it in preview
    if (res.data) {
      setSelected(res.data);
      if ((res as any).alreadyClaimed) {
        setInfo("This certificate has already been claimed by another user.");
      } else {
        setInfo("Certificate found. You can verify it using the dialog below.");
      }
    }
    // do not clear claimId; user may search again
    setClaimBusy(false);
  };

  if (!meChecked) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 backdrop-blur-xl bg-card/40 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
          <Link to="/" className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent truncate">
            VeriVault
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <ThemeToggle />
            <Button onClick={handleLogout} variant="outline" size="sm" className="text-xs sm:text-sm">
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8 md:py-10">
        {selected ? (
          <>
            <Button variant="outline" onClick={() => setSelected(null)} className="mb-4 sm:mb-6 text-sm sm:text-base">
              ← Back
            </Button>
            <HolographicCard certificate={selected as any} showDownload={!!(selected as any).verifiedAt} />
          </>
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 sm:mb-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">My Certificates</h1>
                <p className="text-sm sm:text-base text-muted-foreground">View, verify, and download your certificates.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Input
                  value={claimId}
                  onChange={(e) => setClaimId(e.target.value)}
                  placeholder="Search by Certificate ID or Roll No"
                  className="w-full sm:w-auto sm:flex-1 md:w-80 h-10 sm:h-11 text-sm sm:text-base"
                />
                <Button onClick={handleClaim} disabled={claimBusy} className="shrink-0 h-10 sm:h-11 text-sm sm:text-base">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  {claimBusy ? "Claiming..." : "Search & Claim"}
                </Button>
              </div>
            </div>

            {error && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm sm:text-base">
                {error}
              </div>
            )}

            {info && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm sm:text-base">
                {info}
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-8 sm:py-12">
                <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-sm sm:text-base text-muted-foreground">Loading...</p>
              </div>
            ) : certificates.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <Award className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-base sm:text-lg font-medium">No certificates found</p>
                <p className="text-sm sm:text-base text-muted-foreground mt-1 px-4">
                  Certificates only appear after you claim them. If your institute gave you a Certificate ID, enter it in the box above to begin.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {certificates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="text-left backdrop-blur-xl bg-card/40 border border-border/50 rounded-xl p-3 sm:p-4 hover:shadow-lg transition-all"
                  >
                    <div className="font-semibold text-base sm:text-lg">{c.course}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-1">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-2 sm:mt-3 font-mono break-all">ID: {c.id}</div>
                    <div className="mt-3 sm:mt-4">
                      <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-primary">
                        <Search className="w-3 h-3 sm:w-4 sm:h-4" />
                        View & Download
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

