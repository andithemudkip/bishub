import { useState, useRef, useEffect, useMemo } from "react";
import { CloseIcon } from "../icons/ui";
import {
  getTranslationsByLanguage,
  type BibleTranslationInfo,
} from "../../../shared/bibleTranslations";
import { normalizeForSearch } from "../../../shared/utils";

interface Props {
  value: string;
  downloadedIds: string[];
  downloadStatus: {
    translationId: string;
    status: "downloading" | "ready" | "error";
    progress?: number;
  } | null;
  onChange: (translationId: string) => void;
  translations: ReturnType<typeof getTranslationsByLanguage>;
}

export function BibleTranslationPicker({
  value,
  downloadedIds,
  downloadStatus,
  onChange,
  translations,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Find current translation info
  const current = useMemo(() => {
    for (const group of translations) {
      for (const t of group.translations) {
        if (t.id === value) return t;
      }
    }
    return null;
  }, [value, translations]);

  // Filter translations by search
  const filtered = useMemo(() => {
    if (!search.trim()) return translations;
    const q = normalizeForSearch(search);
    return translations
      .map((group) => ({
        ...group,
        translations: group.translations.filter(
          (t) =>
            normalizeForSearch(t.name).includes(q) ||
            normalizeForSearch(t.languageName).includes(q) ||
            t.id.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.translations.length > 0);
  }, [search, translations]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus search when opened
  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
      // Scroll to selected item
      requestAnimationFrame(() => {
        const selected = listRef.current?.querySelector("[data-selected]");
        selected?.scrollIntoView({ block: "center" });
      });
    }
  }, [open]);

  const isDownloaded = (id: string) => downloadedIds.includes(id);

  const isDownloading =
    downloadStatus?.status === "downloading"
      ? downloadStatus.translationId
      : null;

  const handleSelect = (t: BibleTranslationInfo) => {
    onChange(t.id);
    // Keep dropdown open if it needs to download — close once ready
    if (isDownloaded(t.id)) {
      setOpen(false);
      setSearch("");
    }
  };

  // Auto-close dropdown when a download finishes
  useEffect(() => {
    if (downloadStatus?.status === "ready" && open) {
      setOpen(false);
      setSearch("");
    }
  }, [downloadStatus?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-700 rounded-lg text-white text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <div className="min-w-0">
          <div className="truncate">
            {current?.name || value}
          </div>
          {current && (
            <div className="text-xs text-gray-400 truncate">
              {current.languageName}
            </div>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Download progress bar */}
      {downloadStatus?.status === "downloading" &&
        downloadStatus.translationId === value && (
          <div className="mt-1.5">
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${downloadStatus.progress || 0}%` }}
              />
            </div>
          </div>
        )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-700">
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search translations..."
                className="w-full px-3 py-2 pr-8 bg-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div
            ref={listRef}
            className="max-h-72 overflow-y-auto overscroll-contain"
          >
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                No translations found
              </div>
            )}
            {filtered.map((group) => (
              <div key={group.languageName}>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-800 sticky top-0">
                  {group.languageName}
                </div>
                {group.translations.map((t) => {
                  const selected = t.id === value;
                  const downloaded = isDownloaded(t.id);
                  const downloading = isDownloading === t.id;

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelect(t)}
                      data-selected={selected ? "" : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                        selected
                          ? "bg-blue-600/20 text-blue-300"
                          : "text-gray-300 hover:bg-gray-700/60"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{t.name}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {downloading ? (
                          <span className="text-xs text-blue-400">
                            {downloadStatus?.progress || 0}%
                          </span>
                        ) : downloaded ? (
                          <svg
                            className="w-3.5 h-3.5 text-green-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-3.5 h-3.5 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        )}
                        {selected && (
                          <svg
                            className="w-4 h-4 text-blue-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
