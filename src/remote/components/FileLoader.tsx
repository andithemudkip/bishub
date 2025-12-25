interface Props {
  onLoadText: () => void
  onLoadVideo: () => void
}

export default function FileLoader({ onLoadText, onLoadVideo }: Props) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h2 className="text-lg font-semibold mb-3">Load Content</h2>
      <div className="flex gap-2">
        <button
          onClick={onLoadText}
          className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          📄 Load Text File
        </button>
        <button
          onClick={onLoadVideo}
          className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          🎬 Load Video
        </button>
      </div>
    </div>
  )
}
