import { useState, useEffect } from 'react'
import type { BibleVerse, TextState } from '../../shared/types'
import { parseBibleReference } from '../../shared/bibleParser'

interface BibleBook {
  id: string
  name: string
  chapterCount: number
}

interface Props {
  textState: TextState
}

export default function BiblePage({ textState }: Props) {
  const [books, setBooks] = useState<BibleBook[]>([])
  const [quickSearch, setQuickSearch] = useState('')
  const [parsedRef, setParsedRef] = useState<ReturnType<typeof parseBibleReference>>(null)

  // Manual selection state
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number>(1)
  const [verses, setVerses] = useState<BibleVerse[]>([])
  const [startVerse, setStartVerse] = useState<number>(1)
  const [endVerse, setEndVerse] = useState<number>(1)

  useEffect(() => {
    window.electronAPI?.getBibleBooks().then(setBooks)
  }, [])

  // Parse quick search input
  useEffect(() => {
    const parsed = parseBibleReference(quickSearch)
    setParsedRef(parsed)
  }, [quickSearch])

  // Load chapter verses when book/chapter changes
  useEffect(() => {
    if (selectedBook && selectedChapter) {
      window.electronAPI?.getBibleChapter(selectedBook.id, selectedChapter).then((v: BibleVerse[]) => {
        setVerses(v)
        setStartVerse(1)
        setEndVerse(v.length > 0 ? v[v.length - 1].verse : 1)
      })
    }
  }, [selectedBook, selectedChapter])

  const handleQuickLoad = () => {
    if (parsedRef) {
      window.electronAPI?.loadBibleVerses(
        parsedRef.bookId,
        parsedRef.bookName,
        parsedRef.chapter,
        parsedRef.startVerse,
        parsedRef.endVerse
      )
      setQuickSearch('')
    }
  }

  const handleManualLoad = () => {
    if (selectedBook && selectedChapter) {
      window.electronAPI?.loadBibleVerses(
        selectedBook.id,
        selectedBook.name,
        selectedChapter,
        startVerse,
        endVerse
      )
    }
  }

  const handleBookSelect = (book: BibleBook) => {
    setSelectedBook(book)
    setSelectedChapter(1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && parsedRef) {
      handleQuickLoad()
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick search */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Quick Search</h2>
        <p className="text-sm text-gray-400 mb-3">
          Type a reference like: <span className="text-blue-400">gen 2:16</span>,{' '}
          <span className="text-blue-400">ps 23:1-6</span>,{' '}
          <span className="text-blue-400">ioan 3:16</span>,{' '}
          <span className="text-blue-400">1imp 1:20</span>
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., gen 1:1 or ps 23"
            className="flex-1 px-4 py-3 bg-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            onClick={handleQuickLoad}
            disabled={!parsedRef}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors font-semibold"
          >
            Load
          </button>
        </div>

        {/* Parsed preview */}
        {quickSearch && (
          <div className={`mt-3 p-3 rounded-lg ${parsedRef ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
            {parsedRef ? (
              <span className="text-green-400">
                ✓ {parsedRef.bookName} {parsedRef.chapter}:{parsedRef.startVerse}
                {parsedRef.endVerse !== parsedRef.startVerse && `-${parsedRef.endVerse}`}
              </span>
            ) : (
              <span className="text-red-400">✗ Could not parse reference</span>
            )}
          </div>
        )}
      </div>

      {/* Current display indicator */}
      {textState.slides.length > 0 && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <div className="text-sm text-blue-400 mb-1">Now displaying:</div>
          <div className="font-semibold">{textState.title}</div>
          <div className="text-sm text-gray-400 mt-1">
            Slide {textState.currentSlide + 1} of {textState.slides.length}
          </div>
        </div>
      )}

      {/* Manual browser */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Browse</h2>

        <div className="grid gap-4">
          {/* Book selector */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Book</label>
            <select
              value={selectedBook?.id || ''}
              onChange={(e) => {
                const book = books.find(b => b.id === e.target.value)
                if (book) handleBookSelect(book)
              }}
              className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a book...</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chapter and verse selectors */}
          {selectedBook && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Chapter</label>
                  <select
                    value={selectedChapter}
                    onChange={(e) => setSelectedChapter(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: selectedBook.chapterCount }, (_, i) => i + 1).map((ch) => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>

                {verses.length > 0 && (
                  <>
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">From verse</label>
                      <select
                        value={startVerse}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setStartVerse(v)
                          if (v > endVerse) setEndVerse(v)
                        }}
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {verses.map((v) => (
                          <option key={v.verse} value={v.verse}>{v.verse}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">To verse</label>
                      <select
                        value={endVerse}
                        onChange={(e) => setEndVerse(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {verses.filter(v => v.verse >= startVerse).map((v) => (
                          <option key={v.verse} value={v.verse}>{v.verse}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Preview and load */}
              {verses.length > 0 && (
                <div className="flex items-center justify-between">
                  <div className="text-gray-400">
                    {selectedBook.name} {selectedChapter}:{startVerse}
                    {endVerse !== startVerse && `-${endVerse}`}
                  </div>
                  <button
                    onClick={handleManualLoad}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                  >
                    Load Verses
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
