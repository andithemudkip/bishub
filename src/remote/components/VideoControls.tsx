import type { VideoState } from '../../shared/types'

interface Props {
  config: VideoState
}

export default function VideoControls({ config }: Props) {
  const handlePlay = () => {
    window.electronAPI?.playVideo()
  }

  const handlePause = () => {
    window.electronAPI?.pauseVideo()
  }

  const handleStop = () => {
    window.electronAPI?.stopVideo()
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    window.electronAPI?.seekVideo(Number(e.target.value))
  }

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    window.electronAPI?.setVolume(Number(e.target.value))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h2 className="text-lg font-semibold mb-3">Video Controls</h2>

      {/* Playback controls */}
      <div className="flex gap-2 mb-4">
        {config.playing ? (
          <button
            onClick={handlePause}
            className="flex-1 py-3 px-4 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition-colors text-lg"
          >
            ⏸ Pause
          </button>
        ) : (
          <button
            onClick={handlePlay}
            className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-500 rounded-lg transition-colors text-lg"
          >
            ▶ Play
          </button>
        )}
        <button
          onClick={handleStop}
          className="py-3 px-4 bg-red-600 hover:bg-red-500 rounded-lg transition-colors text-lg"
        >
          ⏹ Stop
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>{formatTime(config.currentTime)}</span>
          <span>{formatTime(config.duration)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={config.duration || 100}
          value={config.currentTime}
          onChange={handleSeek}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Volume control */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={config.volume}
            onChange={handleVolume}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-gray-400 w-12">{Math.round(config.volume * 100)}%</span>
        </div>
      </div>
    </div>
  )
}
