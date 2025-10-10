import { HoveredImage } from '@/types';
import Image from 'next/image';

interface ImageGalleryProps {
  imageUrls: string[];
  selectedImageUrl?: string;
  hoveredImage: HoveredImage | null;
  onHoverImage: (image: HoveredImage | null) => void;
  onSelectImage: (imageUrl: string) => void;
  postId: number;
}

export function ImageGallery({ 
  imageUrls, 
  selectedImageUrl, 
  hoveredImage,
  onHoverImage,
  onSelectImage,
  postId
}: ImageGalleryProps) {
  return (
    <div>
      <h4 className="text-sm font-bold text-green-400 mb-2">
        ✅ Шаг 1: Готово! &nbsp; &nbsp; 👉 Шаг 2: Наведите для увеличения, кликните для выбора
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
        {imageUrls.map((url, index) => (
          <div
            key={index}
            className={`relative group transition-all duration-300 ${
              hoveredImage?.postId === postId && hoveredImage?.imageUrl === url
                ? 'z-20' // Поднимаем на передний план
                : 'z-10'
            }`}
          >
            <Image
              src={url}
              alt={`Generated Art Option ${index + 1}`}
              width={512}
              height={512}
              onClick={() => onSelectImage(url)}
              onMouseEnter={() => onHoverImage({ postId, imageUrl: url })}
              onMouseLeave={() => onHoverImage(null)}
              className={`rounded-2xl cursor-pointer transition-all duration-300 border-4 ${
                selectedImageUrl === url
                  ? 'border-teal-500 opacity-100'
                  : 'border-transparent opacity-60 hover:opacity-100'
              } ${
                hoveredImage?.postId === postId && hoveredImage?.imageUrl === url
                  ? 'scale-150 shadow-2xl' // Увеличение + тень
                  : 'scale-100'
              }`}
              style={{
                transformOrigin: 'center',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}