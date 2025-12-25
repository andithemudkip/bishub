import type { VideoState } from '../../shared/types'

interface Props {
  videoState: VideoState
}

export default function VideoPage({ videoState }: Props) {
  const handleLoadVideo = async () => {
    const path = await window.electronAPI?.openFileDialog([
      { name: 'Video Files', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'] },
    ])
    if (path) {
      window.electronAPI?.loadVideo(path)
    }
  }

  const handlePlay = () => window.electronAPI?.playVideo()
  const handlePause = () => window.electronAPI?.pauseVideo()
  const handleStop = () => window.electronAPI?.stopVideo()
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
    <div className="space-y-6">
      {/* Load video button */}
      <div className="bg-gray-800 rounded-lg p-6">
        <button
          onClick={handleLoadVideo}
          className="w-full py-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-lg flex items-center justify-center gap-3"
        >
          <span className="text-2xl">📁</span>
          Load Video File
        </button>
      </div>

      {/* Video controls - only show when video is loaded */}
      {videoState.src && (
        <div className="bg-gray-800 rounded-lg p-6 space-y-6">
          {/* Current video */}
          <div>
            <div className="text-sm text-gray-400 mb-1">Now loaded:</div>
            <div className="font-semibold truncate">
              {videoState.src.split('/').pop()}
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex gap-3">
            {videoState.playing ? (
              <button
                onClick={handlePause}
                className="flex-1 py-4 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition-colors text-lg font-semibold"
              >
                ⏸ Pause
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="flex-1 py-4 bg-green-600 hover:bg-green-500 rounded-lg transition-colors text-lg font-semibold"
              >
                ▶ Play
              </button>
            )}
            <button
              onClick={handleStop}
              className="py-4 px-6 bg-red-600 hover:bg-red-500 rounded-lg transition-colors text-lg font-semibold"
            >
              ⏹ Stop
            </button>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>{formatTime(videoState.currentTime)}</span>
              <span>{formatTime(videoState.duration)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={videoState.duration || 100}
              value={videoState.currentTime}
              onChange={handleSeek}
              className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Volume control */}
          <div>
            <div className="text-sm text-gray-400 mb-2">Volume</div>
            <div className="flex items-center gap-4">
              <span className="text-xl">🔊</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={videoState.volume}
                onChange={handleVolume}
                className="flex-1 h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="w-12 text-right text-gray-400">
                {Math.round(videoState.volume * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!videoState.src && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">🎬</div>
          <p>No video loaded</p>
          <p className="text-sm mt-2">Click the button above to load a video file</p>
        </div>
      )}
    </div>
  )
}
