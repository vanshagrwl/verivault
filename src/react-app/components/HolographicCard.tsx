import { motion } from "framer-motion";
import { useState, useEffect, memo, useCallback } from "react";
import { Download, CheckCircle2, Shield } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";

interface CertificateData {
  id: string;
  name: string;
  course: string;
  date: string;
  grade?: string;
  rollNo?: string;
  email?: string;
  ownerEmail?: string;
  internshipDomain?: string;
  internshipStartDate?: string;
  internshipEndDate?: string;
}

interface HolographicCardProps {
  certificate: CertificateData;
  showDownload?: boolean;
  isAdmin?: boolean;
}

type VerificationStep = "method" | "contact" | "otp" | "verified";

// Memoized certificate preview component - never re-renders on dialog state changes
const CertificatePreviewComponent = memo(function CertificatePreviewComponent({
  certificate,
  isVerified,
  isAdmin,
  onVerifyClick,
  onDownloadClick,
}: {
  certificate: CertificateData;
  isVerified: boolean;
  isAdmin: boolean;
  onVerifyClick: () => void;
  onDownloadClick: () => Promise<void>;
}) {
  const parseIssueDate = (value?: string): string => {
    if (!value) return "";
    const trimmed = String(value).trim();

    let d: Date;
    if (/^\d+$/.test(trimmed)) {
      const serial = Number(trimmed);
      const base = new Date(Date.UTC(1899, 11, 30));
      base.setUTCDate(base.getUTCDate() + serial);
      d = base;
    } else {
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) return trimmed;
      d = parsed;
    }

    d.setFullYear(2026);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formattedDate = parseIssueDate(certificate.date);
  const internshipDomain = certificate.internshipDomain || certificate.course;

  const formatInternshipDate = (value?: string) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = 2026;
    return `${day}-${month}-${year}`;
  };

  const internshipStart = formatInternshipDate(certificate.internshipStartDate);
  const internshipEnd = formatInternshipDate(certificate.internshipEndDate);

  const CertificatePreview = () => (
    <div
      id={`certificate-${certificate.id}`}
      className="w-full"
      style={{
        backgroundColor: "#f5f1e8",
        backgroundImage: `
          linear-gradient(45deg, rgba(212, 175, 55, 0.05) 1px, transparent 1px),
          linear-gradient(-45deg, rgba(212, 175, 55, 0.05) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
        aspectRatio: "11 / 8.5",
      }}
    >
      <div className="relative h-full w-full p-4 sm:p-6 md:p-8">
        <div
          style={{ boxShadow: "inset 0 0 0 1px #d4af37" }}
          className="h-full border border-yellow-700/80 relative flex flex-col rounded-lg"
        >
          <div className="absolute top-1 sm:top-1.5 left-1 sm:left-1.5 w-2 sm:w-3 h-2 sm:h-3 border-l border-t border-yellow-600" />
          <div className="absolute top-1 sm:top-1.5 right-1 sm:right-1.5 w-2 sm:w-3 h-2 sm:h-3 border-r border-t border-yellow-600" />
          <div className="absolute bottom-1 sm:bottom-1.5 left-1 sm:left-1.5 w-2 sm:w-3 h-2 sm:h-3 border-l border-b border-yellow-600" />
          <div className="absolute bottom-1 sm:bottom-1.5 right-1 sm:right-1.5 w-2 sm:w-3 h-2 sm:h-3 border-r border-b border-yellow-600" />

          <div className="h-full px-4 sm:px-8 py-4 sm:py-6 flex flex-col items-center justify-between text-center max-w-[90%] mx-auto">
            <h1
              style={{ fontFamily: "Georgia, serif" }}
              className="text-xs sm:text-sm md:text-base font-bold text-black tracking-wide leading-tight"
            >
              CERTIFICATE
            </h1>
            <p
              style={{ fontFamily: "Georgia, serif" }}
              className="text-[10px] sm:text-xs tracking-[0.2em] text-gray-700"
            >
              OF INTERNSHIP
            </p>

            <div className="w-6 sm:w-8 h-px bg-yellow-600" />

            <p
              style={{ fontFamily: "Georgia, serif" }}
              className="text-xs text-gray-700"
            >
              This certificate is presented to
            </p>

            <h2
              style={{ fontFamily: "Georgia, serif" }}
              className="text-xs sm:text-sm md:text-base font-bold text-black break-words"
            >
              {certificate.name}
            </h2>

            <div className="w-12 sm:w-16 h-px bg-gray-400" />

            <div className="space-y-0.5 text-center px-2">
              <p
                style={{ fontFamily: "Georgia, serif" }}
                className="text-[11px] sm:text-xs text-gray-700"
              >
                has successfully completed the internship in
              </p>
              <p
                style={{ fontFamily: "Georgia, serif" }}
                className="text-[11px] sm:text-sm font-bold text-black break-words"
              >
                {internshipDomain}
              </p>
              <p
                style={{ fontFamily: "Georgia, serif" }}
                className="text-[10px] sm:text-xs text-gray-700 leading-relaxed mt-1"
              >
                The internship duration was from{" "}
                <span className="font-semibold">{internshipStart || "_____"}</span> to{" "}
                <span className="font-semibold">{internshipEnd || "_____"}</span>.
              </p>
              <p
                style={{ fontFamily: "Georgia, serif" }}
                className="text-[10px] sm:text-xs text-gray-700 leading-relaxed mt-2 px-1"
              >
                During this internship, the candidate showed dedication, professionalism and a strong willingness to
                learn. They contributed effectively to assigned tasks and demonstrated steady growth in their technical
                and collaborative skills.
              </p>
            </div>

            <p
              style={{ fontFamily: "Georgia, serif" }}
              className="text-[10px] sm:text-xs text-gray-700 mt-1"
            >
              Issue Date: <span className="font-semibold">{formattedDate}</span>
            </p>

            <div className="flex flex-col items-center">
              <p
                style={{ fontFamily: "'Great Vibes', cursive", fontWeight: 700, fontStyle: "italic" }}
                className="text-lg sm:text-2xl text-gray-800"
              >
                vansh
              </p>
              <div className="w-16 sm:w-20 border-t border-gray-700 mt-1 mb-1" />
              <p
                style={{ fontFamily: "Georgia, serif" }}
                className="text-xs text-gray-700 font-semibold"
              >
                Authorized Signatory
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-1 px-1">
              <p
                style={{ fontFamily: "monospace" }}
                className="text-[10px] text-gray-600"
              >
                Issue Date: {formattedDate}
              </p>
              <p
                style={{ fontFamily: "monospace" }}
                className="text-[10px] text-gray-600"
              >
                Certificate ID: {certificate.id}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-6xl mx-auto px-2 sm:px-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 sm:p-6 md:p-8">
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Certificate Preview</h3>
            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-gray-300 dark:border-gray-600">
              <CertificatePreview />
            </div>
          </div>

          <div className="flex flex-col justify-center gap-4">
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Certificate Details</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      <strong>Name:</strong> {certificate.name}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      <strong>Course:</strong> {certificate.course}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      <strong>Date:</strong> {formattedDate}
                    </p>
                  </div>
                </div>
              </div>

              {!isAdmin && !isVerified ? (
                <Button
                  onClick={onVerifyClick}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg transition-all"
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Verify Certificate
                </Button>
              ) : !isAdmin ? (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-semibold text-green-700 dark:text-green-300">Verified ✓</span>
                </div>
              ) : (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 text-center font-medium">
                    Admin View - Verification Not Required
                  </p>
                </div>
              )}

              {!isAdmin && isVerified && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Button
                    onClick={onDownloadClick}
                    className="w-full bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white font-semibold py-3 rounded-lg transition-all"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download PDF
                  </Button>
                </motion.div>
              )}

              {!isAdmin && (
                <div className="text-xs text-gray-600 dark:text-gray-400 text-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  {!isVerified ? (
                    "Verify the certificate to enable download"
                  ) : (
                    "Certificate verified! Ready to download."
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

const VerificationDialog = memo(function VerificationDialog({
  open,
  verificationStep,
  userEmail,
  otp,
  isLoading,
  error,
  onEmailChange,
  onOtpChange,
  onSendOTP,
  onVerifyOTP,
  onStepChange,
  onClose,
}: {
  open: boolean;
  verificationStep: VerificationStep;
  userEmail: string;
  otp: string;
  isLoading: boolean;
  error: string;
  onEmailChange: (email: string) => void;
  onOtpChange: (otp: string) => void;
  onSendOTP: () => Promise<void>;
  onVerifyOTP: () => Promise<void>;
  onStepChange: (step: VerificationStep) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        {verificationStep === "contact" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center">Verify Certificate</DialogTitle>
              <DialogDescription>
                Enter your email address to request an OTP for verification
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Email Address</label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={userEmail}
                  onChange={(e) => onEmailChange(e.target.value)}
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={onClose} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={onSendOTP}
                  disabled={isLoading || !userEmail}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? "Sending..." : "Send OTP"}
                </Button>
              </div>
            </div>
          </>
        )}

        {verificationStep === "otp" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center">Enter OTP</DialogTitle>
              <DialogDescription>
                We've sent an OTP to your email
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Enter 6-digit OTP</label>
                <Input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => onOtpChange(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full text-center text-2xl tracking-widest font-mono"
                />
              </div>
              <div className="text-xs text-gray-600 text-center">
                Didn't receive OTP? Check your spam folder or request a new one
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => onStepChange("contact")}
                  variant="outline"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={onVerifyOTP}
                  disabled={isLoading || otp.length !== 6}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isLoading ? "Verifying..." : "Verify OTP"}
                </Button>
              </div>
            </div>
          </>
        )}

        {verificationStep === "verified" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                Certificate Verified!
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-sm text-green-700">
                  Your certificate has been successfully verified. You can now download it.
                </p>
              </div>
              <Button
                onClick={onClose}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
});

export default function HolographicCard({ certificate, isAdmin = false }: HolographicCardProps) {
  const [isVerified, setIsVerified] = useState(false);
  const [verificationStep, setVerificationStep] = useState<VerificationStep>("contact");
  const [userEmail, setUserEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);

  const VERIFIED_STORAGE_KEY = "verivault_verified_certificates";

  const normalizeApiError = (data: any, fallback: string): string => {
    const raw = data?.error ?? data?.message;
    if (!raw) return fallback;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      return trimmed && trimmed !== "[object Object]" ? trimmed : fallback;
    }
    if (raw instanceof Error) return raw.message || fallback;
    try {
      const json = JSON.stringify(raw);
      return json === "{}" ? fallback : json;
    } catch {
      return String(raw) || fallback;
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VERIFIED_STORAGE_KEY);
      if (!raw) return;
      const ids = JSON.parse(raw) as string[];
      if (Array.isArray(ids) && ids.includes(certificate.id)) {
        setIsVerified(true);
        setVerificationStep("verified");
        setError("");
      }
    } catch {
      // ignore localStorage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificate.id]);

  const markCertificateVerifiedLocally = useCallback(() => {
    try {
      const raw = localStorage.getItem(VERIFIED_STORAGE_KEY);
      const ids = raw ? ((JSON.parse(raw) as string[]) || []) : [];
      if (!Array.isArray(ids)) return;
      if (!ids.includes(certificate.id)) {
        ids.push(certificate.id);
        localStorage.setItem(VERIFIED_STORAGE_KEY, JSON.stringify(ids));
      }
    } catch {
      // ignore localStorage errors
    }
  }, [certificate.id]);

  const handleSendOTP = useCallback(async () => {
    if (!userEmail || !userEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/certificates/${encodeURIComponent(certificate.id)}/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(normalizeApiError(data, "Failed to send OTP"));
      setVerificationStep("otp");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error sending password");
    } finally {
      setIsLoading(false);
    }
  }, [certificate.id, userEmail, normalizeApiError]);

  const handleVerifyOTP = useCallback(async () => {
    if (!otp) {
      setError("Please enter the verification password");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/certificates/${encodeURIComponent(certificate.id)}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, otp }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(normalizeApiError(data, "Invalid or expired OTP"));
      setIsVerified(true);
      setVerificationStep("verified");
      setError("");
      markCertificateVerifiedLocally();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid password");
    } finally {
      setIsLoading(false);
    }
  }, [certificate.id, userEmail, otp, normalizeApiError, markCertificateVerifiedLocally]);

  const resetVerification = useCallback(() => {
    setUserEmail("");
    setOtp("");
    setError("");
    setVerificationStep("contact");
    setShowVerificationDialog(false);
  }, []);

  const handleDownload = useCallback(async () => {
    const { default: html2canvas } = await import("html2canvas");
    const { default: jsPDF } = await import("jspdf");
    
    const element = document.getElementById(`certificate-${certificate.id}`);
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#f5f1e8",
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 25;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    const imgAspect = canvas.width / canvas.height;

    let renderWidth = maxWidth;
    let renderHeight = maxWidth / imgAspect;

    if (renderHeight > maxHeight) {
      renderHeight = maxHeight;
      renderWidth = maxHeight * imgAspect;
    }

    const offsetX = (pageWidth - renderWidth) / 2;
    const offsetY = (pageHeight - renderHeight) / 2;

    pdf.addImage(imgData, "PNG", offsetX, offsetY, renderWidth, renderHeight);
    pdf.save(`certificate-${certificate.id}.pdf`);
  }, [certificate.id]);

  return (
    <>
      <CertificatePreviewComponent
        certificate={certificate}
        isVerified={isVerified}
        isAdmin={isAdmin}
        onVerifyClick={() => setShowVerificationDialog(true)}
        onDownloadClick={handleDownload}
      />
      {!isAdmin && (
        <VerificationDialog
          open={showVerificationDialog}
          verificationStep={verificationStep}
          userEmail={userEmail}
          otp={otp}
          isLoading={isLoading}
          error={error}
          onEmailChange={setUserEmail}
          onOtpChange={setOtp}
          onSendOTP={handleSendOTP}
          onVerifyOTP={handleVerifyOTP}
          onStepChange={setVerificationStep}
          onClose={resetVerification}
        />
      )}
    </>
  );
}
