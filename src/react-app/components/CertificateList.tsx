import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Trash2, Eye, Award, Calendar, Ban, Briefcase } from "lucide-react";
import { Button } from "./ui/button";
import { certificatesApi } from "@/react-app/lib/api";
import type { Certificate } from "@/shared/types";
import HolographicCard from "./HolographicCard";
import SkeletonCard from "./SkeletonCard";

interface CertificateListProps {
  refreshTrigger?: number;
  onRefresh?: () => void;
  certificatesOverride?: Certificate[] | undefined;
  isSearching?: boolean;
  isAdmin?: boolean;
}

export default function CertificateList({ refreshTrigger, onRefresh, certificatesOverride, isSearching = false, isAdmin = false }: CertificateListProps) {
  const reduceMotion = useReducedMotion();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 3; // Show 3 cards per page/slide

  // Determine if we're using the override (search results) or loading from API
  const displayCertificates = certificatesOverride !== undefined ? certificatesOverride : certificates;
  const usingOverride = certificatesOverride !== undefined;

  const loadCertificates = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await certificatesApi.getAll({ page, limit });
      if (response.success && response.data) {
        setCertificates(response.data.items);
        setTotal(response.data.total);
      } else {
        setError(response.error || "Failed to load certificates");
      }
    } catch (err) {
      setError("Failed to load certificates");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, [refreshTrigger, page]);


  // Auto-go to previous page if current page becomes empty (but stay on page 1 if it's the last page)
  useEffect(() => {
    if (certificates.length === 0 && page > 1 && !usingOverride) {
      setPage(page - 1);
    }
  }, [certificates.length, page, usingOverride]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this certificate?")) return;

    try {
      const response = await certificatesApi.delete(id);
      if (response.success) {
        // Reload current page - let pagination handle it naturally
        await loadCertificates();
        onRefresh?.();
      } else {
        alert(response.error || "Failed to delete certificate");
      }
    } catch (err) {
      alert("Failed to delete certificate");
    }
  };

  const handleRevoke = async (id: string) => {
    const reason = prompt("Revoke reason (optional):") || undefined;
    try {
      const response = await certificatesApi.revoke(id, reason);
      if (response.success) {
        // Reload current page - let pagination handle it naturally
        await loadCertificates();
        onRefresh?.();
      } else {
        alert(response.error || "Failed to revoke certificate");
      }
    } catch {
      alert("Failed to revoke certificate");
    }
  };

  // Show skeleton cards while searching
  if (isSearching && displayCertificates.length === 0) {
    return (
      <div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((index) => (
            <SkeletonCard key={`skeleton-${index}`} />
          ))}
        </div>
      </div>
    );
  }

  if (isLoading && !usingOverride) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-muted-foreground">Loading certificates...</p>
      </div>
    );
  }

  if (error && !usingOverride) {
    return (
      <div className="text-center py-12 text-destructive">
        <p>{error}</p>
        <Button onClick={loadCertificates} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (displayCertificates.length === 0) {
    return (
      <div className="text-center py-12">
        <Award className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">
          {usingOverride ? "No certificates match your search" : "No certificates yet"}
        </p>
        {!usingOverride && (
          <p className="text-muted-foreground">Upload your first batch to get started.</p>
        )}
      </div>
    );
  }

  if (selectedCert) {
    return (
      <div>
        <Button
          variant="outline"
          onClick={() => setSelectedCert(null)}
          className="mb-4"
        >
          ← Back to List
        </Button>
        <HolographicCard certificate={selectedCert} isAdmin={isAdmin} />
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={`page-${page}`}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50, filter: "blur(10px)" }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              mass: 1,
            }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {displayCertificates.map((cert, index) => (
              <motion.div
                key={cert.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        y: -4,
                        scale: 1.01,
                      }
                }
                whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                  delay: index * 0.08,
                }}
              >
                <div className="backdrop-blur-xl bg-card/40 border border-border/50 rounded-xl p-4 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{cert.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{cert.course}</p>
                  <div className="mb-2">
                    {cert.status === "revoked" ? (
                      <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                        <Ban className="w-3 h-3" />
                        Revoked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                        Issued
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {cert.date}
                    </div>
                    {cert.grade && (
                      <div className="flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        {cert.grade}
                      </div>
                    )}
                  </div>
                  {cert.internshipDomain && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <Briefcase className="w-3 h-3" />
                      {cert.internshipDomain}
                    </div>
                  )}
                  {(cert.internshipStartDate || cert.internshipEndDate) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <span className="text-xs">
                        {cert.internshipStartDate && `${cert.internshipStartDate}`}
                        {cert.internshipStartDate && cert.internshipEndDate && ' → '}
                        {cert.internshipEndDate && `${cert.internshipEndDate}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCert(cert)}
                  className="flex-1"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={cert.status === "revoked"}
                  onClick={() => handleRevoke(cert.id)}
                  className="text-destructive hover:text-destructive"
                  title={cert.status === "revoked" ? "Already revoked" : "Revoke certificate"}
                >
                  <Ban className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(cert.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="mt-2 text-xs text-muted-foreground font-mono">
                ID: {cert.id}
              </div>
            </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {!usingOverride && (
        <motion.div 
          className="mt-8 flex items-center justify-between text-sm text-muted-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="font-medium">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </div>
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="min-w-20"
              >
                ← Prev
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                disabled={page * limit >= total}
                onClick={() => setPage((p) => p + 1)}
                className="min-w-20"
              >
                Next →
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
