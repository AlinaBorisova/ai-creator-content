interface RequestCountSelectorProps {
  mode: 'text' | 'html' | 'images';
  requestCount: number;
  imageCount: number;
  onRequestCountChange: (count: number) => void;
  onImageCountChange: (count: number) => void;
}

export function RequestCountSelector({
  mode,
  requestCount,
  imageCount,
  onRequestCountChange,
  onImageCountChange
}: RequestCountSelectorProps) {
  return (
    <div className="flex gap-2 mb-4">
      {mode === 'images' ? (
        <>
          <span className="text-sm text-gray-400 self-center mr-2">Изображений на промпт:</span>
          {[1, 2, 3, 4].map((count) => (
            <button
              key={count}
              onClick={() => onImageCountChange(count)}
              className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${imageCount === count
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
              {count}
            </button>
          ))}
        </>
      ) : (
        <>
          <span className="text-sm text-gray-400 self-center mr-2">Количество ответов:</span>
          {[1, 2, 3, 4, 5].map((count) => (
            <button
              key={count}
              onClick={() => onRequestCountChange(count)}
              className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${requestCount === count
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
              {count}
            </button>
          ))}
        </>
      )}
    </div>
  );
}