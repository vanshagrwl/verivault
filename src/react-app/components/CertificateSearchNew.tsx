import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, X, Lightbulb } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { certificatesApi } from "@/react-app/lib/api";
import type { Certificate } from "@/shared/types";
import {
  filterCertificatesWithScores,
  parseSearchQuery,
} from "@/lib/liveSearch";

interface CertificateSearchProps {
  onResults?: (certificates: Certificate[]) => void;
  onSearchingChange?: (isSearching: boolean) => void;
}

export default function CertificateSearch({ onResults, onSearchingChange }: CertificateSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [allCertificates, setAllCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchTips, setSearchTips] = useState<string>("Use 'course:', 'id:', 'name:', or 'rollno:' for precise searches");
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

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

    // Load all certificates once on mount for client-side searching
    loadAllCertificates();
  }, []);

  // Load all certificates for client-side searching
  const loadAllCertificates = async () => {
    setIsLoading(true);
    try {
      const response = await certificatesApi.getAll({ limit: 500 });
      if (response.success && response.data?.items) {
        setAllCertificates(response.data.items);
      }
    } catch (err) {
      console.error("Failed to load certificates:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Update search tips based on query
  useEffect(() => {
    const parsed = parseSearchQuery(query);
    if (parsed.idSearch) {
      setSearchTips("🔍 Searching by Certificate ID");
    } else if (parsed.courseSearch) {
      setSearchTips("📚 Searching by Course");
    } else if (parsed.nameSearch) {
      setSearchTips("📝 Searching by Name");
    } else if (parsed.rollNoSearch) {
      setSearchTips("🔢 Searching by Roll Number");
    } else if (query.length > 0) {
      setSearchTips(`💡 Searching across all fields (${query.length} chars)`);
    } else {
      setSearchTips("Use 'course:', 'id:', 'name:', or 'rollno:' for precise searches");
    }
  }, [query]);

  // Debounce the search query (300ms for optimal UX)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query.trim()) {
      setDebouncedQuery("");
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      // Simulate brief search delay for visual feedback
      setTimeout(() => setIsSearching(false), 50);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  // Memoized filtered and scored results (only recalculates when dependencies change)
  const scoredResults = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return [];
    }
    return filterCertificatesWithScores(allCertificates, debouncedQuery);
  }, [debouncedQuery, allCertificates]);

  // Get filtered certificates from scored results
  const results = useMemo(
    () => scoredResults.map(item => item.certificate),
    [scoredResults]
  );

  const handleChange = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const addRecentSearch = useCallback((search: string) => {
    const updated = [search, ...recentSearches.filter((s) => s !== search)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("certificateSearchHistory", JSON.stringify(updated));
  }, [recentSearches]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addRecentSearch(query.trim());
    }
  }, [query, addRecentSearch]);

  const handleClear = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    onResults?.([]);
    inputRef.current?.focus();
  }, [onResults]);

  // Update parent with results whenever they change
  useEffect(() => {
    onResults?.(results);
  }, [results, onResults]);

  // Notify parent when searching state changes
  useEffect(() => {
    onSearchingChange?.(isSearching);
  }, [isSearching, onSearchingChange]);

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
            placeholder="Search by name, ID, course, roll number..."
            className="pl-10 pr-10 bg-input/50 placeholder:text-muted-foreground/70"
            aria-label="Search certificates"
            autoComplete="off"
            disabled={isLoading}
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
        {/* Search Tips */}
        {query && (
          <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" />
            <span>{searchTips}</span>
          </div>
        )}
      </form>

    </div>
  );
}
