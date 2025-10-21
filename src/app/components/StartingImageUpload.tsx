import { useRef } from 'react';
import { ReferenceImage } from '@/types/stream';
import { CloseIcon, ImageIcon, InfoIcon } from './Icons';
import Image from 'next/image';

interface StartingImageUploadProps {
  startingImage: ReferenceImage | null;
  onSetImage: (file: File) => void;
  onClearImage: () => void;
}

export function StartingImageUpload({
  startingImage,
  onSetImage,
  onClearImage
}: StartingImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
        alert('Поддерживаются только форматы JPEG и PNG');
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        if (img.width < 500 || img.height < 500) {
          alert('Минимальный размер изображения: 500x500 пикселей');
          return;
        }
        onSetImage(file);
      };
      img.src = URL.createObjectURL(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];

      if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
        alert('Поддерживаются только форматы JPEG и PNG');
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        if (img.width < 500 || img.height < 500) {
          alert('Минимальный размер изображения: 500x500 пикселей');
          return;
        }
        onSetImage(file);
      };
      img.src = URL.createObjectURL(file);
    }
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">Стартовое изображение:</span>
        {startingImage && (
          <button
            onClick={onClearImage}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Очистить
          </button>
        )}
      </div>

      {startingImage ? (
        <div className="relative group">
          <Image
            src={startingImage.preview}
            alt={startingImage.name}
            width={128}
            height={128}
            className="w-full h-32 object-cover rounded border border-gray-600"
          />
          <button
            onClick={onClearImage}
            className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <CloseIcon className="w-3 h-3" />
          </button>
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {startingImage.name}
          </div>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors cursor-pointer"
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
            <ImageIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">Перетащите изображение или нажмите для выбора</p>
            <p className="text-xs text-gray-500 mt-1">JPEG/PNG, минимум 500x500px</p>
          </div>
        </div>
      )}

      <div className="mt-2 p-2 bg-blue-900/20 border border-blue-700/30 rounded text-xs text-blue-300">
        <InfoIcon className="w-4 h-4" /> Изображение будет использовано как стартовый кадр для генерации видео
      </div>
    </div>
  );
}