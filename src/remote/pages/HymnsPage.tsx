import { useState, useEffect } from "react";
import type { Hymn, TextState } from "../../shared/types";

interface Props {
  textState: TextState;
  hymns: Hymn[];
  onLoadHymn: (hymnNumber: string) => void;
}

export default function HymnsPage({ textState, hymns, onLoadHymn }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredHymns, setFilteredHymns] = useState<Hymn[]>([]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredHymns(hymns.slice(0, 30));
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = hymns
      .filter(
        (h) =>
          h.number.includes(searchQuery) ||
          h.title.toLowerCase().includes(query)
      )
      .slice(0, 30);

    setFilteredHymns(filtered);
  }, [searchQuery, hymns]);

  const handleSelectHymn = (hymn: Hymn) => {
    onLoadHymn(hymn.number);
  };

  const isCurrentHymn = (hymn: Hymn) => {
    return textState.title.startsWith(`${hymn.number}.`);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="sticky top-0 bg-gray-900 pb-4 -mt-4 pt-4 -mx-4 px-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by number or title... (e.g., 123 or Aleluia)"
          className="w-full px-4 py-3 bg-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
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
