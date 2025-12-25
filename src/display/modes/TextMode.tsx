import { useEffect, useState } from 'react'
import type { TextState } from '../../shared/types'

interface Props {
  config: TextState
}

export default function TextMode({ config }: Props) {
  const [visible, setVisible] = useState(true)
  const [displayedSlide, setDisplayedSlide] = useState(config.currentSlide)

  // Handle slide transitions
  useEffect(() => {
    if (config.currentSlide !== displayedSlide) {
      setVisible(false)
      const timer = setTimeout(() => {
        setDisplayedSlide(config.currentSlide)
        setVisible(true)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [config.currentSlide, displayedSlide])

  const currentText = config.slides[displayedSlide] || ''

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black p-12">
      {/* Title */}
      {config.title && (
        <div className="absolute top-8 left-0 right-0 text-center">
          <h1 className="text-3xl font-light text-white/60 tracking-wide">{config.title}</h1>
        </div>
      )}

      {/* Main text content */}
      <div
        className={`text-center max-w-5xl transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <p className="text-6xl font-display leading-relaxed text-white whitespace-pre-line">
          {currentText}
        </p>
      </div>

      {/* Slide indicator */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
        {config.slides.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all ${
              index === displayedSlide ? 'bg-white w-6' : 'bg-white/30'
            }`}
          />
        ))}
      </div>

      {/* Slide number */}
      <div className="absolute bottom-8 right-8 text-white/40 text-lg">
        {displayedSlide + 1} / {config.slides.length}
      </div>
    </div>
  )
}
