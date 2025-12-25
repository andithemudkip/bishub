import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { Hymn, BibleBook, BibleChapter, BibleVerse, BibleData } from '../src/shared/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Get assets path - works in both dev and production
function getAssetsPath(): string {
  // In dev, assets are in project root
  // In production, they're bundled with the app
  const isDev = process.env.NODE_ENV !== 'production'
  if (isDev) {
    return path.join(__dirname, '..', 'assets')
  }
  return path.join(__dirname, '..', 'assets')
}

let hymnsCache: Hymn[] | null = null
let bibleCache: BibleData | null = null

export function loadHymns(): Hymn[] {
  if (hymnsCache) return hymnsCache

  const hymnsPath = path.join(getAssetsPath(), 'hymns.json')
  try {
    const data = fs.readFileSync(hymnsPath, 'utf-8')
    hymnsCache = JSON.parse(data) as Hymn[]
    return hymnsCache
  } catch (error) {
    console.error('Failed to load hymns:', error)
    return []
  }
}

export function getHymnByNumber(number: string): Hymn | null {
  const hymns = loadHymns()
  return hymns.find(h => h.number === number) || null
}

export function searchHymns(query: string): Hymn[] {
  const hymns = loadHymns()
  const lowerQuery = query.toLowerCase()
  return hymns.filter(h =>
    h.number.includes(query) ||
    h.title.toLowerCase().includes(lowerQuery)
  ).slice(0, 20) // Limit results
}

export function loadBible(): BibleData {
  if (bibleCache) return bibleCache

  const biblePath = path.join(getAssetsPath(), 'bible.xml')
  try {
    const xml = fs.readFileSync(biblePath, 'utf-8')
    bibleCache = parseBibleXML(xml)
    return bibleCache
  } catch (error) {
    console.error('Failed to load bible:', error)
    return { books: [] }
  }
}

function parseBibleXML(xml: string): BibleData {
  const books: BibleBook[] = []

  // Match each book
  const bookRegex = /<book id="([^"]+)">([\s\S]*?)(?=<book |<\/usfx>)/g
  let bookMatch

  while ((bookMatch = bookRegex.exec(xml)) !== null) {
    const bookId = bookMatch[1]
    const bookContent = bookMatch[2]

    // Get book name from <h> tag
    const nameMatch = bookContent.match(/<h>([^<]+)<\/h>/)
    const bookName = nameMatch ? nameMatch[1].trim() : bookId

    const chapters: BibleChapter[] = []

    // Split by chapters
    const chapterRegex = /<c id="(\d+)"[^>]*\/>([\s\S]*?)(?=<c id="|$)/g
    let chapterMatch

    while ((chapterMatch = chapterRegex.exec(bookContent)) !== null) {
      const chapterNum = parseInt(chapterMatch[1], 10)
      const chapterContent = chapterMatch[2]

      const verses: BibleVerse[] = []

      // Extract verses
      const verseRegex = /<v id="(\d+)"[^>]*\/>([\s\S]*?)(?=<v id="|<c id="|<\/p>|$)/g
      let verseMatch

      while ((verseMatch = verseRegex.exec(chapterContent)) !== null) {
        const verseNum = parseInt(verseMatch[1], 10)
        let verseText = verseMatch[2]

        // Clean up the verse text - remove XML tags and extra whitespace
        verseText = verseText
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim()

        if (verseText) {
          verses.push({
            chapter: chapterNum,
            verse: verseNum,
            text: verseText
          })
        }
      }

      if (verses.length > 0) {
        chapters.push({
          number: chapterNum,
          verses
        })
      }
    }

    if (chapters.length > 0) {
      books.push({
        id: bookId,
        name: bookName,
        chapters
      })
    }
  }

  return { books }
}

export function getBibleBooks(): { id: string; name: string; chapterCount: number }[] {
  const bible = loadBible()
  return bible.books.map(b => ({
    id: b.id,
    name: b.name,
    chapterCount: b.chapters.length
  }))
}

export function getBibleChapter(bookId: string, chapter: number): BibleVerse[] {
  const bible = loadBible()
  const book = bible.books.find(b => b.id === bookId)
  if (!book) return []

  const ch = book.chapters.find(c => c.number === chapter)
  return ch?.verses || []
}

export function getBibleVerses(bookId: string, chapter: number, startVerse: number, endVerse?: number): BibleVerse[] {
  const verses = getBibleChapter(bookId, chapter)
  const end = endVerse || startVerse
  return verses.filter(v => v.verse >= startVerse && v.verse <= end)
}

export function formatHymnForDisplay(hymn: Hymn): { title: string; slides: string[] } {
  const slides: string[] = []

  hymn.verses.forEach((verse, index) => {
    // Add verse
    slides.push(verse)

    // Add chorus after each verse if it exists
    if (hymn.chorus && hymn.chorus.trim()) {
      slides.push(hymn.chorus)
    }
  })

  return {
    title: `${hymn.number}. ${hymn.title}`,
    slides
  }
}

export function formatBibleVersesForDisplay(
  bookName: string,
  chapter: number,
  verses: BibleVerse[]
): { title: string; slides: string[] } {
  const startVerse = verses[0]?.verse || 1
  const endVerse = verses[verses.length - 1]?.verse || startVerse

  const title = startVerse === endVerse
    ? `${bookName} ${chapter}:${startVerse}`
    : `${bookName} ${chapter}:${startVerse}-${endVerse}`

  // Each verse is a slide
  const slides = verses.map(v => `${v.verse}. ${v.text}`)

  return { title, slides }
}
