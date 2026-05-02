/**
 * SearchDialog.tsx — Always-dark search overlay.
 *
 * React island (client:idle). Fetches /api/search with debounced input.
 * Keyboard navigation: ArrowDown/Up cycle, Enter navigates, Escape closes.
 * Z-index 99600 (above account dropdown at 99560, per Z-INDEX-MAP.md).
 *
 * WHY always-dark: Search is a nav-level overlay — matches navbar styling,
 * never changes with page theme. Uses hardcoded dark values from gaming theme.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { $searchOpen, closeSearch } from '../store';
import type { SearchResult } from '../types';

/* always-dark: navbar overlay, not themed — hardcoded from gaming theme */
const SEARCH_DEBOUNCE_MS = 300;
const MAX_RESULTS = 8;

/** Type label for display */
function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    product: 'Product',
    review: 'Review',
    guide: 'Guide',
    news: 'News',
    brand: 'Brand',
    game: 'Game',
  };
  return labels[type] ?? type;
}

/** Capitalize a category name */
function capCategory(cat?: string): string {
  if (!cat) return '';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export default function SearchDialog() {
  const open = useStore($searchOpen);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to let the DOM paint
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      // Reset state when closed
      setQuery('');
      setResults([]);
      setActiveIndex(-1);
      setLoading(false);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();

    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&limit=${MAX_RESULTS}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SearchResult[] = await res.json();
      setResults(data);
      setActiveIndex(-1);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setResults([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // Handle input changes with debounce
  const handleInput = useCallback((value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => doSearch(value), SEARCH_DEBOUNCE_MS);
  }, [doSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const resultCount = results.length;

    switch (e.key) {
      case 'ArrowDown':
        if (resultCount === 0) return;
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % resultCount);
        break;
      case 'ArrowUp':
        if (resultCount === 0) return;
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + resultCount) % resultCount);
        break;
      case 'Home':
        if (resultCount === 0) return;
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        if (resultCount === 0) return;
        e.preventDefault();
        setActiveIndex(resultCount - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) {
          window.location.href = results[activeIndex].url;
          closeSearch();
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeSearch();
        break;
    }
  }, [results, activeIndex]);

  // Scroll active result into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-search-item]');
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <div
      className="search-overlay"
      onClick={(e) => {
        // Close on backdrop click (not on dialog content)
        if (e.target === e.currentTarget) closeSearch();
      }}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99600,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 'clamp(60px, 12vh, 120px)',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
      }}
    >
      <div
        className="search-dialog"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-haspopup="listbox"
        onKeyDown={handleKeyDown}
        style={{
          /* always-dark: slideshow overlays photos */
          width: 'clamp(320px, 90vw, 640px)',
          maxHeight: '480px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#1d2021',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          color: '#ffffff',
          fontFamily: 'var(--identity-font, "Open Sans", sans-serif)',
        }}
      >
        {/* Input row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          gap: '10px',
          borderBottom: '1px solid #3A3F41',
        }}>
          {/* Search icon */}
          <svg
            width="18" height="18" viewBox="4.5 4.5 15.53 15.53"
            fill="none" xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0, opacity: 0.6 }}
          >
            <path
              fillRule="evenodd" clipRule="evenodd"
              d="M15 10.5C15 12.9853 12.9853 15 10.5 15C8.01472 15 6 12.9853 6 10.5C6 8.01472 8.01472 6 10.5 6C12.9853 6 15 8.01472 15 10.5ZM14.1793 15.2399C13.1632 16.0297 11.8865 16.5 10.5 16.5C7.18629 16.5 4.5 13.8137 4.5 10.5C4.5 7.18629 7.18629 4.5 10.5 4.5C13.8137 4.5 16.5 7.18629 16.5 10.5C16.5 11.8865 16.0297 13.1632 15.2399 14.1792L20.0304 18.9697L18.9697 20.0303L14.1793 15.2399Z"
              fill="#ffffff"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search products, reviews, guides..."
            aria-label="Search"
            aria-autocomplete="list"
            aria-controls="search-results-list"
            aria-activedescendant={activeIndex >= 0 ? `search-item-${activeIndex}` : undefined}
            style={{
              /* always-dark: input on dark overlay */
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '16px',
              fontFamily: 'inherit',
              lineHeight: '1.5',
            }}
          />
          {/* Loading indicator */}
          {loading && (
            <span style={{ opacity: 0.5, fontSize: '14px', flexShrink: 0 }}>...</span>
          )}
          {/* Close button */}
          <button
            onClick={closeSearch}
            aria-label="Close search"
            style={{
              background: 'none',
              border: 'none',
              color: '#dddad5',
              cursor: 'pointer',
              padding: '4px',
              fontSize: '18px',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            &times;
          </button>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          id="search-results-list"
          role="listbox"
          aria-label="Search results"
          style={{
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* Empty state */}
          {!query.trim() && (
            <div style={{
              padding: '24px 16px',
              textAlign: 'center',
              /* always-dark: muted text on dark overlay */
              color: '#dddad5',
              opacity: 0.7,
              fontSize: '14px',
            }}>
              Type to search products, reviews, guides...
            </div>
          )}

          {/* No results */}
          {query.trim() && !loading && results.length === 0 && (
            <div style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: '#dddad5',
              opacity: 0.7,
              fontSize: '14px',
            }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Result items */}
          {results.map((result, i) => (
            <a
              key={`${result.type}-${result.url}`}
              id={`search-item-${i}`}
              data-search-item
              href={result.url}
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => closeSearch()}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                textDecoration: 'none',
                color: '#ffffff',
                /* always-dark: hover highlight on dark overlay */
                backgroundColor: i === activeIndex ? '#3A3F41' : 'transparent',
                transition: 'background-color 0.1s ease',
                cursor: 'pointer',
              }}
            >
              {/* Thumbnail */}
              {result.imageUrl ? (
                <img
                  src={result.imageUrl}
                  alt=""
                  loading="lazy"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '6px',
                    objectFit: result.imageFit ?? 'contain',
                    /* always-dark: thumbnail bg for contain images */
                    backgroundColor: result.imageFit === 'contain' ? '#161718' : 'transparent',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '6px',
                  backgroundColor: '#161718',
                  flexShrink: 0,
                }} />
              )}

              {/* Text content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  lineHeight: '1.3',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {result.title}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#dddad5',
                  opacity: 0.7,
                  marginTop: '2px',
                }}>
                  {typeLabel(result.type)}
                  {result.category && ` \u00B7 ${capCategory(result.category)}`}
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Keyboard hint footer */}
        <div style={{
          display: 'flex',
          gap: '16px',
          padding: '8px 16px',
          /* always-dark: footer border on dark overlay */
          borderTop: '1px solid #3A3F41',
          fontSize: '11px',
          color: '#dddad5',
          opacity: 0.5,
        }}>
          <span><kbd style={kbdStyle}>&uarr;&darr;</kbd> navigate</span>
          <span><kbd style={kbdStyle}>&crarr;</kbd> select</span>
          <span><kbd style={kbdStyle}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

/* always-dark: keyboard hint style */
const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 5px',
  borderRadius: '3px',
  border: '1px solid #3A3F41',
  backgroundColor: '#161718',
  fontSize: '10px',
  fontFamily: 'monospace',
  lineHeight: '1.4',
};
