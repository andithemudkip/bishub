import type { TextState } from '../../shared/types'

interface Props {
  config: TextState
}

export default function TextControls({ config }: Props) {
  const handlePrev = () => {
    window.electronAPI?.prevSlide()
  }

  const handleNext = () => {
    window.electronAPI?.nextSlide()
  }

  const handleGoToSlide = (index: number) => {
    window.electronAPI?.goToSlide(index)
  }

  const isFirstSlide = config.currentSlide === 0
  const isLastSlide = config.currentSlide === config.slides.length - 1

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h2 className="text-lg font-semibold mb-3">Text Controls</h2>

      {/* Navigation buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handlePrev}
          disabled={isFirstSlide}
          className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          ← Previous
        </button>
        <button
          onClick={handleNext}
          disabled={isLastSlide}
          className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          Next →
        </button>
      </div>

      {/* Slide preview list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {config.slides.map((slide, index) => (
          <button
            key={index}
            onClick={() => handleGoToSlide(index)}
            className={`w-full text-left p-3 rounded-lg transition-colors ${
              index === config.currentSlide
                ? 'bg-blue-600'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 w-6">{index + 1}</span>
              <span className="truncate text-sm">
                {slide.substring(0, 60)}{slide.length > 60 ? '...' : ''}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
