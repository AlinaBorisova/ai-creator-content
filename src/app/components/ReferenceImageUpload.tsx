import { useRef } from 'react';
import { ReferenceImage } from '@/types/stream';
import { CloseIcon, CheckIcon } from './Icons';
import Image from 'next/image';

interface ReferenceImageUploadProps {
  referenceImages: ReferenceImage[];
  onAddImage: (file: File) => void;
  onRemoveImage: (index: number) => void;
  onClearImages: () => void;
}

export function ReferenceImageUpload({
  referenceImages,
  onAddImage,
  onRemoveImage,
  onClearImages
}: ReferenceImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Проверяем формат файла
      if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
        alert('Поддерживаются только форматы JPEG и PNG');
        return;
      }

      // Проверяем размер (минимально 500x500)
      const img = new window.Image();
      img.onload = () => {
        if (img.width < 500 || img.height < 500) {
          alert('Минимальный размер изображения: 500x500 пикселей');
          return;
        }
        onAddImage(file);
      };
      img.src = URL.createObjectURL(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Проверяем формат файла
      if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
        alert('Поддерживаются только форматы JPEG и PNG');
        return;
      }

      // Проверяем размер (минимально 500x500)
      const img = new window.Image();
      img.onload = () => {
        if (img.width < 500 || img.height < 500) {
          alert('Минимальный размер изображения: 500x500 пикселей');
          return;
        }
        onAddImage(file);
      };
      img.src = URL.createObjectURL(file);
    }
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">Референсные изображения:</span>
        {referenceImages.length > 0 && (
          <button
            onClick={onClearImages}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Очистить все
          </button>
        )}
      </div>

      {/* Область загрузки */}
      <div
        className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-gray-500 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="text-gray-400">
          <div className="text-2xl mb-2">📷</div>
          <p className="text-sm">
            {referenceImages.length === 0
              ? 'Перетащите изображение или нажмите для выбора'
              : 'Добавить еще изображение'
            }
          </p>
          <p className="text-xs text-gray-500 mt-1">
            JPEG/PNG, минимум 500x500px
          </p>
        </div>
      </div>

      {/* Предпросмотр изображений */}
      {referenceImages.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {referenceImages.map((img, index) => (
            <div key={index} className="relative group">
              <Image
                src={img.preview}
                alt={img.name}
                width={96}
                height={96}
                className="w-full h-24 object-cover rounded border border-gray-600"
              />
              <button
                onClick={() => onRemoveImage(index)}
                className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <CloseIcon className="w-3 h-3" />
              </button>
              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                {img.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Информация о 8 секундах */}
      {referenceImages.length > 0 && (
        <div className="mt-2 p-2 bg-green-900/20 border border-green-700/30 rounded text-xs text-green-300">
          <CheckIcon className="w-4 h-4" /> Референсные изображения загружены. Теперь доступна генерация видео длительностью 8 секунд.
        </div>
      )}
    </div>
  );
}