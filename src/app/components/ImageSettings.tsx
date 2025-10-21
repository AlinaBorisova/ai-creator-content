interface ImageSettingsProps {
  aspectRatio: string;
  imagenModel: string;
  imageSize: string;
  onAspectRatioChange: (ratio: string) => void;
  onImagenModelChange: (model: string) => void;
  onImageSizeChange: (size: string) => void;
}

export function ImageSettings({
  aspectRatio,
  imagenModel,
  imageSize,
  onAspectRatioChange,
  onImagenModelChange,
  onImageSizeChange
}: ImageSettingsProps) {
  return (
    <>
      {/* Выбор соотношения сторон */}
      <div className="flex gap-2 mb-4">
        <span className="text-sm text-gray-400 self-center mr-2">Соотношение сторон:</span>
        {[
          { value: '1:1', label: '1:1 (Квадрат)' },
          { value: '3:4', label: '3:4 (Портрет)' },
          { value: '4:3', label: '4:3 (Альбом)' },
          { value: '9:16', label: '9:16 (Вертикальный)' },
          { value: '16:9', label: '16:9 (Горизонтальный)' }
        ].map((ratio) => (
          <button
            key={ratio.value}
            onClick={() => onAspectRatioChange(ratio.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${aspectRatio === ratio.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            title={ratio.label}
          >
            {ratio.value}
          </button>
        ))}
      </div>

      {/* Выбор модели Imagen */}
      <div className="flex gap-2 mb-4">
        <span className="text-sm text-gray-400 self-center mr-2">Модель Imagen:</span>
        {[
          { value: 'imagen-4.0-generate-001', label: 'Imagen 4 Standard' },
          { value: 'imagen-4.0-ultra-generate-001', label: 'Imagen 4 Ultra' },
          { value: 'imagen-4.0-fast-generate-001', label: 'Imagen 4 Fast' }
        ].map((model) => (
          <button
            key={model.value}
            onClick={() => onImagenModelChange(model.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${imagenModel === model.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            title={model.label}
          >
            {model.value === 'imagen-4.0-generate-001' ? 'Standard' :
              model.value === 'imagen-4.0-ultra-generate-001' ? 'Ultra' : 'Fast'}
          </button>
        ))}
      </div>

      {/* Выбор размера изображения - только для Standard и Ultra */}
      {(imagenModel === 'imagen-4.0-generate-001' || imagenModel === 'imagen-4.0-ultra-generate-001') && (
        <div className="flex gap-2 mb-4">
          <span className="text-sm text-gray-400 self-center mr-2">Размер изображения:</span>
          {[
            { value: '1K', label: '1K (1024x1024)' },
            { value: '2K', label: '2K (2048x2048)' }
          ].map((size) => (
            <button
              key={size.value}
              onClick={() => onImageSizeChange(size.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${imageSize === size.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              title={size.label}
            >
              {size.value}
            </button>
          ))}
        </div>
      )}
    </>
  );
}