import { useState, useEffect } from 'react'
import type { BibleVerse } from '../../shared/types'

interface BibleBook {
  id: string
  name: string
  chapterCount: number
}

export default function BibleSelector() {
  const [books, setBooks] = useState<BibleBook[]>([])
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number>(1)
  const [verses, setVerses] = useState<BibleVerse[]>([])
  const [startVerse, setStartVerse] = useState<number>(1)
  const [endVerse, setEndVerse] = useState<number>(1)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    window.electronAPI?.getBibleBooks().then(setBooks)
  }, [])

  useEffect(() => {
    if (selectedBook && selectedChapter) {
      window.electronAPI?.getBibleChapter(selectedBook.id, selectedChapter).then((v: BibleVerse[]) => {
        setVerses(v)
        setStartVerse(1)
        setEndVerse(v.length > 0 ? v[v.length - 1].verse : 1)
      })
    }
  }, [selectedBook, selectedChapter])

  const handleLoadVerses = () => {
    if (selectedBook && selectedChapter) {
      window.electronAPI?.loadBibleVerses(
        selectedBook.id,
        selectedBook.name,
        selectedChapter,
        startVerse,
        endVerse
      )
      setIsOpen(false)
    }
  }

  const handleBookSelect = (book: BibleBook) => {
    setSelectedBook(book)
    setSelectedChapter(1)
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Bible</h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          {isOpen ? 'Close' : 'Browse'}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-3">
          {/* Book selector */}
          <div>
            <label className="text-sm text-gray-400 block mb-1">Book</label>
            <select
              value={selectedBook?.id || ''}
              onChange={(e) => {
                const book = books.find(b => b.id === e.target.value)
                if (book) handleBookSelect(book)
              }}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
            >
              <option value="">Select a book...</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chapter selector */}
          {selectedBook && (
            <div>
              <label className="text-sm text-gray-400 block mb-1">Chapter</label>
              <select
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
              >
                {Array.from({ length: selectedBook.chapterCount }, (_, i) => i + 1).map((ch) => (
                  <option key={ch} value={ch}>
                    Chapter {ch}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Verse range */}
          {verses.length > 0 && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-sm text-gray-400 block mb-1">From verse</label>
                <select
                  value={startVerse}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setStartVerse(v)
                    if (v > endVerse) setEndVerse(v)
                  }}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                >
                  {verses.map((v) => (
                    <option key={v.verse} value={v.verse}>
                      {v.verse}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-sm text-gray-400 block mb-1">To verse</label>
                <select
                  value={endVerse}
                  onChange={(e) => setEndVerse(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                >
                  {verses.filter(v => v.verse >= startVerse).map((v) => (
                    <option key={v.verse} value={v.verse}>
                      {v.verse}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Preview */}
          {selectedBook && verses.length > 0 && (
            <div className="text-sm text-gray-400 bg-gray-700 rounded p-2">
              {selectedBook.name} {selectedChapter}:{startVerse}
              {endVerse !== startVerse && `-${endVerse}`}
            </div>
          )}

          {/* Load button */}
          <button
            onClick={handleLoadVerses}
            disabled={!selectedBook || verses.length === 0}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Load Verses
          </button>
        </div>
      )}
    </div>
  )
}
