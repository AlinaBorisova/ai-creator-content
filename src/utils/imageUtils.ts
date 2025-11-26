export const downloadImage = async (imageBytes: string, mimeType: string, filename: string) => {
  try {
    const byteCharacters = atob(imageBytes);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('📥 Image downloaded:', filename);
  } catch (error) {
    console.error('❌ Error downloading image:', error);
  }
};

export const copyPromptToClipboard = async (promptText: string) => {
  try {
    await navigator.clipboard.writeText(promptText);
    console.log('Промпт скопирован в буфер обмена');
  } catch (error) {
    console.error('Ошибка при копировании промпта:', error);
  }
};

/**
 * Оптимизирует изображение: масштабирует до целевых размеров и сжимает качество
 * @param imageBytes - base64 строка изображения (без префикса data:image/...;base64,)
 * @param mimeType - MIME тип изображения (например, 'image/jpeg', 'image/png')
 * @param quality - качество сжатия от 0 до 1 (по умолчанию 0.7)
 * @param targetWidth - целевая ширина (опционально, если не указана - сохраняется оригинал)
 * @param targetHeight - целевая высота (опционально, если не указана - сохраняется оригинал)
 * @returns Promise с оптимизированным base64 изображением
 */
export const optimizeImage = async (
  imageBytes: string,
  mimeType: string,
  quality: number = 0.8,
  targetWidth?: number,
  targetHeight?: number
): Promise<{ imageBytes: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    try {
      // Создаем изображение из base64
      const img = new Image();

      img.onload = () => {
        try {
          const originalWidth = img.width;
          const originalHeight = img.height;

          // Вычисляем целевые размеры с сохранением пропорций
          let newWidth = originalWidth;
          let newHeight = originalHeight;

          if (targetWidth && targetHeight) {
            // Всегда сохраняем оригинальное соотношение сторон
            // Масштабируем так, чтобы изображение поместилось в целевые размеры
            const widthRatio = targetWidth / originalWidth;
            const heightRatio = targetHeight / originalHeight;

            // Используем меньший коэффициент масштабирования, чтобы сохранить пропорции
            const scale = Math.min(widthRatio, heightRatio);
            
            newWidth = Math.round(originalWidth * scale);
            newHeight = Math.round(originalHeight * scale);
          } else if (targetWidth && originalWidth > targetWidth) {
            // Если указана только ширина и она меньше оригинала
            const ratio = targetWidth / originalWidth;
            newWidth = targetWidth;
            newHeight = Math.round(originalHeight * ratio);
          } else if (targetHeight && originalHeight > targetHeight) {
            // Если указана только высота и она меньше оригинала
            const ratio = targetHeight / originalHeight;
            newHeight = targetHeight;
            newWidth = Math.round(originalWidth * ratio);
          }

          // Создаем canvas с новыми размерами
          const canvas = document.createElement('canvas');
          canvas.width = newWidth;
          canvas.height = newHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Улучшаем качество масштабирования
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Рисуем изображение на canvas с новыми размерами
          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          /// Сохраняем оригинальный формат (временно без конвертации)
          // PNG остается PNG, остальные форматы остаются как есть
          const outputMimeType = mimeType === 'image/png' ? 'image/png' : mimeType;

          // Получаем оптимизированное изображение
          const optimizedDataUrl = canvas.toDataURL(outputMimeType, quality);

          // Извлекаем base64 без префикса
          const base64Data = optimizedDataUrl.split(',')[1];

          const originalSizeMB = (imageBytes.length * 3 / 4) / (1024 * 1024);
          const optimizedSizeMB = (base64Data.length * 3 / 4) / (1024 * 1024);

          console.log('🖼️ Image optimized:', {
            originalSize: `${(originalSizeMB).toFixed(2)} MB`,
            optimizedSize: `${(optimizedSizeMB).toFixed(2)} MB`,
            reduction: `${Math.round((1 - base64Data.length / imageBytes.length) * 100)}%`,
            originalDimensions: `${originalWidth}x${originalHeight}`,
            newDimensions: `${newWidth}x${newHeight}`,
            mimeType: outputMimeType,
            quality: quality
          });

          resolve({
            imageBytes: base64Data,
            mimeType: outputMimeType
          });
        } catch (error) {
          console.error('❌ Error optimizing image:', error);
          reject(error);
        }
      };

      img.onerror = (error) => {
        console.error('❌ Error loading image for optimization:', error);
        reject(new Error('Failed to load image'));
      };

      // Загружаем изображение
      const dataUrl = `data:${mimeType};base64,${imageBytes}`;
      img.src = dataUrl;
    } catch (error) {
      console.error('❌ Error in optimizeImage:', error);
      reject(error);
    }
  });
};