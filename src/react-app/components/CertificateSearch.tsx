import { useState, useEffect, useRef } from "react";
import { Search, X, Clock, TrendingUp } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { certificatesApi } from "@/react-app/lib/api";
import type { Certificate } from "@/shared/types";

interface CertificateSearchProps {
  onSelect?: (certificate: Certificate) => void;
  onResults?: (certificates: Certificate[]) => void;
}

interface SearchSuggestion {
  type: "recent" | "keyword" | "certificate";
  value: string;
  label: string;
  icon?: React.ReactNode;
  certificate?: Certificate;
}

export default function CertificateSearch({ onSelect, onResults }: CertificateSearchProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Certificate[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "issued" | "revoked">("all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("certificateSearchHistory");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Handle search with minimal debounce for real-time suggestions
  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      // Show recent searches when input is empty
      const recentSuggestions: SearchSuggestion[] = recentSearches.map((search) => ({
        type: "recent",
        value: search,
        label: search,
        icon: <Clock className="w-4 h-4" />,
      }));
      setSuggestions(recentSuggestions);
      setResults([]);
      setShowSuggestions(true);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await certificatesApi.search(trimmed);
        if (response.success && response.data) {
          const searchResults = response.data as Certificate[];
          setResults(searchResults);

          // Organize suggestions by category
          const names = new Set<string>();
          const rollNumbers = new Set<string>();
          const courses = new Set<string>();

          searchResults.forEach((cert) => {
            // Add matching name parts
            if (cert.name?.toLowerCase().includes(trimmed.toLowerCase())) {
              names.add(cert.name);
              const nameParts = cert.name.toLowerCase().split(/\s+/);
              nameParts.forEach((part) => {
                if (part.includes(trimmed.toLowerCase())) {
                  names.add(part);
                }
              });
            }
            
            // Add matching roll numbers
            if (cert.rollNo?.toLowerCase().includes(trimmed.toLowerCase())) {
              rollNumbers.add(cert.rollNo);
            }
            
            // Add matching courses
            if (cert.course?.toLowerCase().includes(trimmed.toLowerCase())) {
              courses.add(cert.course);
              const courseParts = cert.course.toLowerCase().split(/\s+/);
              courseParts.forEach((part) => {
                if (part.includes(trimmed.toLowerCase())) {
                  courses.add(part);
                }
              });
            }
          });

          // Create organized suggestions
          const allSuggestions: SearchSuggestion[] = [];
          
          // Add name suggestions
          Array.from(names).slice(0, 3).forEach((name) => {
            allSuggestions.push({
              type: "keyword",
              value: name,
              label: `📝 ${name}`,
              icon: <TrendingUp className="w-4 h-4" />,
            });
          });
          
          // Add roll number suggestions
          Array.from(rollNumbers).slice(0, 2).forEach((rollNo) => {
            allSuggestions.push({
              type: "keyword",
              value: rollNo,
              label: `🔢 ${rollNo}`,
              icon: <TrendingUp className="w-4 h-4" />,
            });
          });
          
          // Add course suggestions
          Array.from(courses).slice(0, 2).forEach((course) => {
            allSuggestions.push({
              type: "keyword",
              value: course,
              label: `📚 ${course}`,
              icon: <TrendingUp className="w-4 h-4" />,
            });
          });

          // Add top certificate results
          const certificateSuggestions: SearchSuggestion[] = searchResults.slice(0, 3).map((cert) => ({
            type: "certificate" as const,
            value: cert.id,
            label: `${cert.name} - ${cert.course}`,
            certificate: cert,
          }));

          setSuggestions([...allSuggestions, ...certificateSuggestions]);
          setShowSuggestions(true);
          onResults?.(searchResults);
        } else {
          setResults([]);
          setSuggestions([]);
          onResults?.([]);
        }
      } catch (err) {
        setResults([]);
        setSuggestions([]);
        onResults?.([]);
      } finally {
        setIsSearching(false);
      }
    }, 50); // Very fast debounce for real-time suggestions

    return () => window.clearTimeout(timeoutId);
  }, [query, recentSearches]);

  const handleChange = (value: string) => {
    setQuery(value);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    if (suggestion.type === "certificate" && suggestion.certificate) {
      // Select certificate directly
      onSelect?.(suggestion.certificate);
      handleClear();
      addRecentSearch(suggestion.certificate.name);
    } else {
      // Use keyword as new search
      setQuery(suggestion.value);
      addRecentSearch(suggestion.value);
      inputRef.current?.focus();
    }
  };

  const addRecentSearch = (search: string) => {
    const updated = [search, ...recentSearches.filter((s) => s !== search)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("certificateSearchHistory", JSON.stringify(updated));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addRecentSearch(query.trim());
      setShowSuggestions(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setSuggestions([]);
    setShowSuggestions(false);
    onResults?.([]);
    inputRef.current?.focus();
  };

  const getStatusColor = (status?: string) => {
    if (status === "revoked") return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  };

  const getStatusText = (status?: string) => {
    if (status === "revoked") return "Revoked";
    return "Issued";
  };

  const filteredResults = results.filter((cert) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "issued") return cert.status !== "revoked";
    if (filterStatus === "revoked") return cert.status === "revoked";
    return true;
  });

  return (
    <div className="relative w-full" ref={searchBoxRef}>
      <form onSubmit={handleSearch}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            id="certificate-search-input"
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search certificates by name, ID, course, roll number..."
            className="pl-10 pr-10 bg-input/50 placeholder:text-muted-foreground/70"
            aria-label="Search certificates"
            autoComplete="off"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-muted"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Suggestions and Results Dropdown */}
      {showSuggestions && (
        <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {/* Suggestions Section */}
          {suggestions.length > 0 && !query && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                Recent Searches
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={`suggestion-${index}`}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-4 py-2 hover:bg-accent transition-colors duration-100 border-b border-border last:border-b-0 flex items-center gap-2"
                >
                  {suggestion.icon && <span className="text-muted-foreground">{suggestion.icon}</span>}
                  <span className="text-sm text-foreground">{suggestion.label}</span>
                </button>
              ))}
            </>
          )}

          {/* Keywords/Autocomplete Suggestions */}
          {suggestions.length > 0 && query && suggestions.some((s) => s.type === "keyword") && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                Suggestions
              </div>
              {suggestions
                .filter((s) => s.type === "keyword")
                .map((suggestion, index) => (
                  <button
                    key={`keyword-${index}`}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-accent transition-colors duration-100 border-b border-border flex items-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{suggestion.label}</span>
                  </button>
                ))}
            </>
          )}

          {/* Loading State */}
          {isSearching && query && (
            <div className="px-4 py-4 text-center text-muted-foreground">
              <div className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="mt-2 text-sm">Searching...</p>
            </div>
          )}

          {/* Certificate Results */}
          {!isSearching && query && filteredResults.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                Certificates ({filteredResults.length})
              </div>
              {filteredResults.map((cert, index) => (
                <button
                  key={`${cert.id}-${index}`}
                  type="button"
                  onClick={() => {
                    onSelect?.(cert);
                    addRecentSearch(cert.name);
                    handleClear();
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-accent border-b border-border last:border-b-0 transition-colors duration-100"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-foreground truncate">{cert.name}</p>
                    <Badge className={`${getStatusColor(cert.status)} text-xs whitespace-nowrap`}>
                      {getStatusText(cert.status)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">ID:</span> {cert.id}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Course:</span> {cert.course}
                    </div>
                    {cert.rollNo && (
                      <div>
                        <span className="font-medium text-foreground">Roll No:</span> {cert.rollNo}
                      </div>
                    )}
                    {cert.date && (
                      <div>
                        <span className="font-medium text-foreground">Date:</span>{" "}
                        {new Date(cert.date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Certificate Suggestions (Top Results) */}
          {!isSearching && query && filteredResults.length === 0 && suggestions.some((s) => s.type === "certificate") && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                Matching Certificates
              </div>
              {suggestions
                .filter((s) => s.type === "certificate")
                .map((suggestion, index) => (
                  <button
                    key={`cert-${index}`}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-4 py-3 hover:bg-accent border-b border-border last:border-b-0 transition-colors duration-100"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-foreground truncate">{suggestion.certificate?.name}</p>
                      <Badge className={`${getStatusColor(suggestion.certificate?.status)} text-xs whitespace-nowrap`}>
                        {getStatusText(suggestion.certificate?.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{suggestion.certificate?.course}</p>
                  </button>
                ))}
            </>
          )}

          {/* No Results Message */}
          {!isSearching && query && filteredResults.length === 0 && suggestions.length === 0 && (
            <div className="px-4 py-6 text-center text-muted-foreground">
              <p className="text-sm font-medium">No results for "{query}"</p>
              <p className="text-xs mt-1">Try different keywords or browse all certificates</p>
            </div>
          )}

          {/* Status Filter */}
          {query && filteredResults.length > 0 && (
            <div className="sticky bottom-0 bg-card border-t border-border px-4 py-2 flex gap-1">
              {(["all", "issued", "revoked"] as const).map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={filterStatus === status ? "default" : "outline"}
                  onClick={() => setFilterStatus(status)}
                  className="h-7 text-xs flex-1"
                >
                  {status === "all" && "All"}
                  {status === "issued" && "Issued"}
                  {status === "revoked" && "Revoked"}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {showSuggestions && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowSuggestions(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowSuggestions(false);
          }}
        />
      )}
    </div>
  );
}
