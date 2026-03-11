import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import * as XLSX from "xlsx";
import { certificatesApi } from "@/react-app/lib/api";
import type { CertificateCreate } from "@/shared/types";

interface CertificateUploadProps {
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export default function CertificateUpload({ onSuccess, open, onOpenChange, hideTrigger }: CertificateUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<CertificateCreate[]>([]);
  const [syncMode, setSyncMode] = useState(true); // Always sync mode - replace old data with new (cannot be toggled)
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess(false);
    setPreview([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      // Log detected columns for debugging
      if (jsonData.length > 0) {
        console.log("📊 Excel Columns Detected:", Object.keys(jsonData[0]));
        console.log("📊 First row data:", jsonData[0]);
      }

      // Validate and transform data with enhanced validation
      const certificates: CertificateCreate[] = [];
      const validationErrors: string[] = [];
      const seenIds = new Set<string>(); // For duplicate detection: name + course + date
      const duplicatesRemoved: string[] = [];

      jsonData.forEach((row, index) => {
        // Create a helper function for flexible header matching (case-insensitive, whitespace-tolerant)
        const findColumn = (row: any, ...variants: string[]): string | undefined => {
          const rowKeys = Object.keys(row).map(k => k.trim().toLowerCase());
          for (const variant of variants) {
            const key = rowKeys.find(k => 
              k === variant.toLowerCase() || 
              k.includes(variant.toLowerCase()) ||
              variant.toLowerCase().includes(k)
            );
            if (key) {
              // Find original key with actual casing
              return Object.keys(row).find(k => k.trim().toLowerCase() === key);
            }
          }
          return undefined;
        };

        // Try to be flexible with common header variants (case and wording)
        const nameKey = findColumn(row, "name", "student name", "student_name", "fullname", "full name");
        const name = nameKey ? row[nameKey] : undefined;

        // Use Domain instead of Course - can have multiple variants
        const courseKey = findColumn(row, "domain", "course", "internship domain", "internship_domain", "subject", "program");
        const domain = courseKey ? row[courseKey] : undefined;

        const dateKey = findColumn(row, "date", "completion date", "issue date", "issued date");
        const date = dateKey ? row[dateKey] : new Date().toISOString().split("T")[0];
        
        const gradeKey = findColumn(row, "grade", "score", "marks", "result");
        const grade = gradeKey ? row[gradeKey] : undefined;
        
        const emailKey = findColumn(row, "email", "student email", "mail", "email id", "student mail", "contact email", "e-mail");
        const email = emailKey ? row[emailKey] : undefined;

        const rollNoKey = findColumn(row, "roll", "roll no", "roll number", "student id", "enrollment id", "reg no");
        const rollNo = rollNoKey ? row[rollNoKey] : undefined;
        
        const certIdKey = findColumn(row, "certificate", "cert id", "certificate id", "cert_id");
        const certificateId = certIdKey ? row[certIdKey] : undefined;
        
        // Internship start and end dates
        const internshipStartKey = findColumn(row, "internship start", "start date", "from date", "start_date");
        const internshipStartDate = internshipStartKey ? row[internshipStartKey] : undefined;
        
        const internshipEndKey = findColumn(row, "internship end", "end date", "to date", "end_date");
        const internshipEndDate = internshipEndKey ? row[internshipEndKey] : undefined;

        // Enhanced validation
        if (!name || !String(name).trim()) {
          validationErrors.push(`Row ${index + 2}: Missing required field "Name"`);
          return;
        }
        if (!domain || !String(domain).trim()) {
          validationErrors.push(`Row ${index + 2}: Missing required field "Domain"`);
          return;
        }
        if (!date || !String(date).trim()) {
          validationErrors.push(`Row ${index + 2}: Missing required field "Date"`);
          return;
        }

        // Validate date format
        const dateStr = String(date).trim();
        if (isNaN(Date.parse(dateStr))) {
          validationErrors.push(`Row ${index + 2}: Invalid date format "${dateStr}"`);
        }

        // Validate internship dates if provided
        if (internshipStartDate && isNaN(Date.parse(String(internshipStartDate).trim()))) {
          validationErrors.push(`Row ${index + 2}: Invalid internship start date format`);
        }
        if (internshipEndDate && isNaN(Date.parse(String(internshipEndDate).trim()))) {
          validationErrors.push(`Row ${index + 2}: Invalid internship end date format`);
        }

        // Check for duplicates: name + domain + date combination
        const duplicateKey = `${String(name).trim().toLowerCase()}||${String(domain).trim().toLowerCase()}||${dateStr}`;
        if (seenIds.has(duplicateKey)) {
          duplicatesRemoved.push(`Row ${index + 2}: "${String(name).trim()}" - ${String(domain).trim()} (duplicate removed)`);
          return; // Skip this duplicate
        }
        seenIds.add(duplicateKey);

        certificates.push({
          name: String(name).trim(),
          course: String(domain).trim(), // Use domain as the course field
          date: dateStr,
          grade: grade ? String(grade).trim() : undefined,
          email: email ? String(email).trim().toLowerCase() : undefined,
          rollNo: rollNo ? String(rollNo).trim() : undefined,
          certificateId: certificateId ? String(certificateId).trim().toUpperCase() : undefined,
          internshipDomain: String(domain).trim(), // Also store in internshipDomain field
          internshipStartDate: internshipStartDate ? String(internshipStartDate).trim() : undefined,
          internshipEndDate: internshipEndDate ? String(internshipEndDate).trim() : undefined,
        });

        // Log first 3 rows for debugging
        if (index < 3) {
          console.log(`📄 Row ${index + 1}:`, {
            name: name,
            course: domain,
            date: dateStr,
            email: email || "(empty)",
            rollNo: rollNo || "(empty)",
          });
        }
      });

      if (validationErrors.length > 0) {
        throw new Error(`Validation errors:\n${validationErrors.slice(0, 10).join("\n")}${validationErrors.length > 10 ? `\n... and ${validationErrors.length - 10} more errors` : ""}`);
      }

      if (certificates.length === 0) {
        throw new Error("No valid certificates found in file");
      }

      setPreview(certificates);
      
      // Show duplicate removal info if any were removed
      if (duplicatesRemoved.length > 0) {
        console.info("Duplicates removed:", duplicatesRemoved);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const handleUpload = async () => {
    if (preview.length === 0) return;

    setIsUploading(true);
    setError("");
    setSuccess(false);

    try {
      const mode = syncMode ? "sync" : "merge";
      const response = await certificatesApi.bulkCreate(preview, mode);

      if (response.success) {
        setSuccess(true);
        // Call onSuccess immediately to refresh the list
        onSuccess?.();
        // Then close the dialog after success animation
        setTimeout(() => {
          setIsOpen(false);
          setPreview([]);
          setSuccess(false);
          setSyncMode(true);
        }, 1500);
      } else {
        setError(response.error || "Upload failed");
      }
    } catch (err) {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const actualOpen = open ?? isOpen;
  const setActualOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    if (open === undefined) setIsOpen(next);
    if (!next) {
      setPreview([]);
      setError("");
      setSuccess(false);
    }
  };

  return (
    <>
      {!hideTrigger && (
        <Button
          onClick={() => setActualOpen(true)}
          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-lg"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Certificates
        </Button>
      )}

      <Dialog open={actualOpen} onOpenChange={setActualOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Upload Certificates</DialogTitle>
          </DialogHeader>

            {!preview.length && !success && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-xl p-6 sm:p-8 md:p-12 text-center">
                  <FileSpreadsheet className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                  <p className="text-base sm:text-lg font-medium mb-2">Upload Excel/CSV File</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4 px-2">
                    <strong>Required columns:</strong> Name, Domain (or Course), Date<br/>
                    <strong>Optional columns:</strong> Email (for verification), Roll No, Grade, Certificate ID, Internship Start Date, Internship End Date
                  </p>
                  <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 mb-4 px-2 bg-blue-50 dark:bg-blue-900/20 py-2 rounded">
                    ℹ️ Pro Tip: Add an "Email" column to enable email-based verification for users
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs sm:text-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive"
                >
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-500"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Successfully uploaded {preview.length} certificates!{syncMode ? " (old data removed)" : ""}</span>
                </motion.div>
              )}

              {preview.length > 0 && !success && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm font-medium text-green-600">✓ Sync Mode Enabled</p>
                    <p className="text-xs text-green-600/80">Old data will be automatically removed during upload</p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="font-medium mb-2">Preview ({preview.length} certificates)</p>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {preview.slice(0, 10).map((cert, index) => (
                        <div key={index} className="text-sm p-2 bg-background rounded border border-border">
                          <div className="font-medium">{cert.name}</div>
                          <div className="text-xs text-muted-foreground">📚 {cert.course}</div>
                          <div className={`text-xs ${cert.email ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                            {cert.email ? `📧 ${cert.email}` : '⚠️ No email provided'}
                          </div>
                        </div>
                      ))}
                      {preview.length > 10 && (
                        <p className="text-xs text-muted-foreground">
                          ... and {preview.length - 10} more
                        </p>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                      <p>✓ {preview.filter(c => c.email).length} with email</p>
                      <p>⚠️ {preview.filter(c => !c.email).length} without email</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500"
                    >
                      {isUploading ? "Uploading..." : `Upload ${preview.length} Certificates`}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPreview([]);
                        setError("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
