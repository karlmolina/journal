import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { reportError } from "../functions/reportError";
import {
  toEntry,
  type SearchResult,
  type SearchRow,
} from "../functions/journalEntries";

const SEARCH_DEBOUNCE_MS = 300;

// Full-text search over journal entries, as you type.
export default function useEntrySearch() {
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  // Only the latest request may update state, so slow earlier responses can't
  // overwrite newer results.
  const searchRequestId = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const runSearch = useCallback(async (query: string) => {
    const requestId = ++searchRequestId.current;
    setSearching(true);
    const { data, error } = await supabase.rpc("search_entries", {
      query_text: query,
    });
    if (requestId !== searchRequestId.current) return;
    setSearching(false);
    if (error) {
      reportError(error, "Journal");
      return;
    }
    setResults(
      (data as SearchRow[]).map((row) => ({
        ...toEntry(row),
        highlighted: row.highlighted,
      })),
    );
  }, []);

  // Search 300ms after the user stops typing.
  useEffect(() => {
    const query = searchText.trim();
    if (!query) {
      searchRequestId.current++;
      setSearching(false);
      return;
    }
    searchTimer.current = setTimeout(
      () => runSearch(query),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(searchTimer.current);
  }, [searchText, runSearch]);

  // Enter searches immediately instead of waiting out the debounce.
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchText.trim();
    if (!query) return;
    clearTimeout(searchTimer.current);
    runSearch(query);
  };

  const clearSearchText = () => {
    setSearchText("");
    setResults(null);
  };

  return {
    searchText,
    setSearchText,
    results,
    setResults,
    searching,
    handleSearch,
    clearSearchText,
  };
}
