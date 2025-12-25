import type { DisplayState } from '../../shared/types'

interface Props {
  state: DisplayState
}

export default function StatusIndicator({ state }: Props) {
  const getModeLabel = () => {
    switch (state.mode) {
      case 'idle':
        return 'Idle - Clock Display'
      case 'text':
        return `Text - ${state.text.title || 'Untitled'}`
      case 'video':
        return `Video - ${state.video.src?.split('/').pop() || 'No video'}`
      default:
        return 'Unknown'
    }
  }

  const getStatusDetails = () => {
    switch (state.mode) {
      case 'idle':
        return 'Showing clock and wallpaper'
      case 'text':
        return `Slide ${state.text.currentSlide + 1} of ${state.text.slides.length}`
      case 'video':
        const current = formatTime(state.video.currentTime)
        const duration = formatTime(state.video.duration)
        return `${state.video.playing ? '▶' : '⏸'} ${current} / ${duration}`
      default:
        return ''
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getModeColor = () => {
    switch (state.mode) {
      case 'idle':
        return 'bg-gray-600'
      case 'text':
        return 'bg-blue-600'
      case 'video':
        return 'bg-green-600'
      default:
        return 'bg-gray-600'
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${getModeColor()}`} />
        <div>
          <div className="font-semibold">{getModeLabel()}</div>
          <div className="text-sm text-gray-400">{getStatusDetails()}</div>
        </div>
      </div>
    </div>
  )
}
