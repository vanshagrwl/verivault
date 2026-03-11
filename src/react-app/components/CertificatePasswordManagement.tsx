import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, Eye, EyeOff, RefreshCw, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { certificatesApi } from "@/react-app/lib/api";
import type { Certificate } from "@/shared/types";

export default function CertificatePasswordManagement() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [copiedCertId, setCopiedCertId] = useState<string | null>(null);

  useEffect(() => {
    loadCertificates();
  }, []);

  const loadCertificates = async () => {
    setIsLoading(true);
    try {
      const response = await certificatesApi.getAll();
      if (response.success && response.data?.items) {
        setCertificates(response.data.items);
      }
    } catch (error) {
      console.error("Failed to load certificates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (certId: string) => {
    const newVisible = new Set(visiblePasswords);
    if (newVisible.has(certId)) {
      newVisible.delete(certId);
    } else {
      newVisible.add(certId);
    }
    setVisiblePasswords(newVisible);
  };

  const copyToClipboard = (text: string, certId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCertId(certId);
    setTimeout(() => setCopiedCertId(null), 2000);
  };

  const filteredCertificates = certificates.filter((cert) => {
    const query = searchQuery.toLowerCase();
    return (
      cert.id.toLowerCase().includes(query) ||
      cert.name.toLowerCase().includes(query) ||
      cert.course.toLowerCase().includes(query) ||
      (cert.ownerEmail?.toLowerCase().includes(query) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-amber-700 dark:text-amber-400">Certificate Passwords</h3>
            <p className="text-sm text-amber-600/80 dark:text-amber-300/80 mt-1">
              View and manage verification passwords for each certificate. These passwords are used by users to verify and download certificates.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div>
        <Input
          type="text"
          placeholder="Search by Certificate ID, name, email, or course..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Refresh button */}
      <div>
        <Button
          onClick={loadCertificates}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {/* Certificates Table/List */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {filteredCertificates.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Lock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No certificates found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Certificate ID</th>
                  <th className="text-left px-4 py-3 font-semibold">Student Name</th>
                  <th className="text-left px-4 py-3 font-semibold">Owner Email</th>
                  <th className="text-left px-4 py-3 font-semibold">Course</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Verified</th>
                  <th className="text-center px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCertificates.map((cert) => (
                  <motion.tr
                    key={cert.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {cert.id.substring(0, 15)}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(cert.id, cert.id)}
                          className="p-1 hover:bg-muted rounded transition-colors"
                          title="Copy full ID"
                        >
                          <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">{cert.name}</td>
                    <td className="px-4 py-3">
                      {cert.ownerEmail ? (
                        <div className="text-xs">
                          <a href={`mailto:${cert.ownerEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline break-all">
                            {cert.ownerEmail}
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No email set</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{cert.course}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          cert.status === "revoked"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {cert.status || "issued"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {cert.verifiedAt ? (
                        <div className="text-xs">
                          <span className="text-green-600 dark:text-green-400 font-semibold">✓ Yes</span>
                          <div className="text-muted-foreground text-xs">
                            {new Date(cert.verifiedAt).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => togglePasswordVisibility(cert.id)}
                          className="p-1.5 hover:bg-muted rounded transition-colors"
                          title={visiblePasswords.has(cert.id) ? "Hide" : "Show"}
                        >
                          {visiblePasswords.has(cert.id) ? (
                            <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                        {visiblePasswords.has(cert.id) && (
                          <button
                            onClick={() => copyToClipboard(cert.id, `${cert.id}-copy`)}
                            className="p-1.5 hover:bg-muted rounded transition-colors"
                            title="Copy certificate ID"
                          >
                            {copiedCertId === `${cert.id}-copy` ? (
                              <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                            ) : (
                              <Copy className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="text-3xl font-bold text-primary">{certificates.length}</div>
          <p className="text-sm text-muted-foreground mt-1">Total Certificates</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {certificates.filter((c) => c.verifiedAt).length}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Verified</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
            {certificates.filter((c) => !c.verifiedAt).length}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Pending Verification</p>
        </motion.div>
      </div>
    </div>
  );
}
