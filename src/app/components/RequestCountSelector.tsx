interface RequestCountSelectorProps {
  mode: 'text' | 'html' | 'images' | 'videos' | 'research';
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
              className={`px-3 py-2 rounded-lg w-[50px] text-sm font-medium border border-gray-700 cursor-pointer transition-all duration-300 hover:scale-105 ${imageCount === count
                  ? 'bg-(--btn-active-color) text-white'
                  : 'bg-(--btn-color) text-gray-300 hover:border-(--btn-hover-border)'
                }`}
            >
              {count}
            </button>
          ))}
        </>
        ) : mode === 'videos' ? (
          <>
            <span className="text-sm text-gray-400 self-center mr-2">Видео на промпт:</span>
            {[1, 2, 3, 4].map((count) => (
              <button
                key={count}
                onClick={() => onImageCountChange(count)}
                className={`px-3 py-2 rounded-lg w-[50px] text-sm font-medium border border-gray-700 cursor-pointer transition-all duration-300 hover:scale-105 ${imageCount === count
                    ? 'bg-(--btn-active-color) text-white'
                    : 'bg-(--btn-color) text-gray-300 hover:border-(--btn-hover-border)'
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
              className={`px-3 py-2 rounded-lg w-[50px] text-sm font-medium border border-gray-700 cursor-pointer transition-all duration-300 hover:scale-105 ${requestCount === count
                  ? 'bg-(--btn-active-color) text-white'
                  : 'bg-(--btn-color) text-gray-300 hover:border-(--btn-hover-border)'
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