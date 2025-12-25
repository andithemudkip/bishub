import { useState, useEffect, useMemo } from "react";
import type { Hymn, TextState } from "../../shared/types";

interface Props {
  textState: TextState;
  hymns: Hymn[];
  onLoadHymn: (hymnNumber: string) => void;
}

// Remove diacritics from text (ă->a, ș->s, ț->t, î->i, â->a, etc.)
function removeDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Normalize text for searching
function normalizeForSearch(text: string): string {
  return removeDiacritics(text.toLowerCase().trim());
}

export default function HymnsPage({ textState, hymns, onLoadHymn }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredHymns, setFilteredHymns] = useState<Hymn[]>([]);

  // Pre-compute normalized titles for faster searching
  const hymnsWithNormalizedTitles = useMemo(() => {
    return hymns.map((h) => ({
      hymn: h,
      normalizedTitle: normalizeForSearch(h.title),
    }));
  }, [hymns]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredHymns(hymns.slice(0, 30));
      return;
    }

    const normalizedQuery = normalizeForSearch(searchQuery);

    // Split query into words for multi-word matching
    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

    const filtered = hymnsWithNormalizedTitles
      .filter(({ hymn, normalizedTitle }) => {
        // Check if it's a number search
        if (hymn.number.includes(searchQuery.trim())) {
          return true;
        }

        // Check if all query words appear in the title
        return queryWords.every((word) => normalizedTitle.includes(word));
      })
      .map(({ hymn }) => hymn)
      .slice(0, 30);

    setFilteredHymns(filtered);
  }, [searchQuery, hymns, hymnsWithNormalizedTitles]);

  const handleSelectHymn = (hymn: Hymn) => {
    onLoadHymn(hymn.number);
  };

  const isCurrentHymn = (hymn: Hymn) => {
    return textState.title.startsWith(`${hymn.number}.`);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="sticky -top-4 bg-gray-900 pb-4 pt-4 -mx-4 px-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by number or title..."
          className="w-full px-4 py-3 bg-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Current hymn indicator */}
      {textState.slides.length > 0 && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <div className="text-sm text-blue-400 mb-1">Now displaying:</div>
          <div className="font-semibold">{textState.title}</div>
          <div className="text-sm text-gray-400 mt-1">
            Slide {textState.currentSlide + 1} of {textState.slides.length}
          </div>
        </div>
      )}

      {/* Hymn list */}
      <div className="grid gap-2">
        {filteredHymns.map((hymn) => (
          <button
            key={hymn.number}
            onClick={() => handleSelectHymn(hymn)}
            className={`text-left p-4 rounded-lg transition-colors ${
              isCurrentHymn(hymn)
                ? "bg-blue-600 ring-2 ring-blue-400"
                : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            <div className="flex items-baseline gap-3">
              <span className="text-blue-400 font-mono text-lg font-bold w-12">
                {hymn.number}
              </span>
              <span className="text-lg">{hymn.title}</span>
            </div>
            <div className="text-sm text-gray-400 mt-1 ml-15">
              {hymn.verses.length}{" "}
              {hymn.verses.length === 1 ? "verse" : "verses"}
              {hymn.chorus && " + chorus"}
            </div>
          </button>
        ))}

        {filteredHymns.length === 0 && searchQuery && (
          <div className="text-center py-8 text-gray-400">
            No hymns found for "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
