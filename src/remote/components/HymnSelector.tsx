import { useState, useEffect } from "react";
import type { Hymn } from "../../shared/types";

export default function HymnSelector() {
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredHymns, setFilteredHymns] = useState<Hymn[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load all hymns on mount
    window.electronAPI?.getHymns().then(setHymns);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredHymns(hymns.slice(0, 20));
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = hymns
      .filter(
        (h) =>
          h.number.includes(searchQuery) ||
          h.title.toLowerCase().includes(query)
      )
      .slice(0, 20);

    setFilteredHymns(filtered);
  }, [searchQuery, hymns]);

  const handleSelectHymn = (hymn: Hymn) => {
    window.electronAPI?.loadHymn(hymn.number);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Hymns</h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          {isOpen ? "Close" : "Browse"}
        </button>
      </div>

      {isOpen && (
        <>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by number or title..."
            className="w-full px-3 py-2 bg-gray-700 rounded-lg mb-3 text-white placeholder-gray-400"
            autoFocus
          />

          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredHymns.map((hymn) => (
              <button
                key={hymn.number}
                onClick={() => handleSelectHymn(hymn)}
                className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <span className="text-blue-400 font-mono mr-2">
                  {hymn.number}.
                </span>
                <span>{hymn.title}</span>
              </button>
            ))}
            {filteredHymns.length === 0 && (
              <p className="text-gray-400 text-center py-4">No hymns found</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
