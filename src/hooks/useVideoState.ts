import { useState, useCallback } from 'react';
import { ReferenceImage, VideoModel, VideoDuration } from '@/types/stream';

export type VideoGenerationMode = 'text-to-video' | 'image-to-video';

// Маппинг моделей на API endpoints
export const VIDEO_MODEL_ENDPOINTS: Record<VideoModel, string> = {
  'Veo 2': 'veo-2.0-generate-001',
  'Veo 3': 'veo-3.0-generate-001',
  'Veo 3 Fast': 'veo-3.0-fast-generate-001',
  'Veo 3.1': 'veo-3.1-generate-preview',
  'Veo 3.1 Fast': 'veo-3.1-fast-generate-preview'
};

export const SUPPORTED_DURATIONS: Record<VideoModel, VideoDuration[]> = {
  'Veo 2': ['5', '6', '8'],           // 5-8 секунд
  'Veo 3': ['8'],                     // Только 8 секунд
  'Veo 3 Fast': ['8'],                // Только 8 секунд
  'Veo 3.1': ['4', '6', '8'],         // 4, 6, 8 секунд
  'Veo 3.1 Fast': ['4', '6', '8']     // 4, 6, 8 секунд
};

// Поддерживаемые разрешения для каждой модели (согласно документации)
export const SUPPORTED_RESOLUTIONS: Record<VideoModel, string[]> = {
  'Veo 2': ['720p'],                  // Только 720p
  'Veo 3': ['720p', '1080p'],         // 720p и 1080p (только 16:9)
  'Veo 3 Fast': ['720p', '1080p'],    // 720p и 1080p (только 16:9)
  'Veo 3.1': ['720p', '1080p'],       // 720p и 1080p (1080p только для 8с)
  'Veo 3.1 Fast': ['720p', '1080p']   // 720p и 1080p (1080p только для 8с)
};
// Поддерживаемые соотношения сторон для каждой модели
export const SUPPORTED_ASPECT_RATIOS: Record<VideoModel, string[]> = {
  'Veo 2': ['16:9', '9:16'],          // Поддерживает оба
  'Veo 3': ['16:9'],                  // Только 16:9
  'Veo 3 Fast': ['16:9'],             // Только 16:9
  'Veo 3.1': ['16:9', '9:16'],        // Поддерживает оба
  'Veo 3.1 Fast': ['16:9', '9:16']    // Поддерживает оба
};

// Поддержка аудио для каждой модели (согласно документации)
export const SUPPORTS_AUDIO: Record<VideoModel, boolean> = {
  'Veo 2': false,                     // Только без звука
  'Veo 3': true,                      // Всегда включен
  'Veo 3 Fast': true,                 // Всегда включен
  'Veo 3.1': true,                    // Генерирует аудио с видео
  'Veo 3.1 Fast': true                // Генерирует аудио с видео
};

// Проверка совместимости разрешения и длительности для Veo 3.1
export const isResolutionDurationCompatible = (model: VideoModel, resolution: string, duration: string): boolean => {
  // Для Veo 3.1 и Veo 3.1 Fast: 1080p только для 8-секундных видео
  if ((model === 'Veo 3.1' || model === 'Veo 3.1 Fast') && resolution === '1080p' && duration !== '8') {
    return false;
  }
  return true;
};

// Проверка совместимости разрешения и соотношения сторон
export const isResolutionAspectRatioCompatible = (model: VideoModel, resolution: string, aspectRatio: string): boolean => {
  // Для Veo 3 и Veo 3 Fast: 1080p только с 16:9
  if ((model === 'Veo 3' || model === 'Veo 3 Fast') && resolution === '1080p' && aspectRatio !== '16:9') {
    return false;
  }
  return true;
};

// Получение описания ограничений для модели
export const getModelLimitations = (model: VideoModel): string[] => {
  const limitations: string[] = [];

  if (!SUPPORTS_AUDIO[model]) {
    limitations.push('Только без звука');
  }

  if (SUPPORTED_RESOLUTIONS[model].length === 1) {
    limitations.push(`Только ${SUPPORTED_RESOLUTIONS[model][0]}`);
  }

  if (SUPPORTED_ASPECT_RATIOS[model].length === 1) {
    limitations.push(`Только ${SUPPORTED_ASPECT_RATIOS[model][0]}`);
  }

  if (model === 'Veo 3' || model === 'Veo 3 Fast') {
    limitations.push('1080p только с 16:9');
  }

  if (model === 'Veo 3.1' || model === 'Veo 3.1 Fast') {
    limitations.push('1080p только для 8-секундных видео');
  }

  return limitations;
};

export function useVideoState() {
  const [generationMode, setGenerationMode] = useState<VideoGenerationMode>('text-to-video');
  const [resolution, setResolution] = useState<string>('720p');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [selectedModel, setSelectedModel] = useState<VideoModel>('Veo 2');
  const [duration, setDuration] = useState<VideoDuration>('8');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [startingImage, setStartingImage] = useState<ReferenceImage | null>(null);

  // Автоматическая корректировка настроек при смене модели
  const handleModelChange = useCallback((model: VideoModel) => {
    setSelectedModel(model);
    
    // Корректируем разрешение
    const availableResolutions = SUPPORTED_RESOLUTIONS[model];
    if (!availableResolutions.includes(resolution)) {
      setResolution(availableResolutions[0]);
    }
    
    // Корректируем соотношение сторон
    const availableAspectRatios = SUPPORTED_ASPECT_RATIOS[model];
    if (!availableAspectRatios.includes(aspectRatio)) {
      setAspectRatio(availableAspectRatios[0]);
    }
    
    // Корректируем длительность - ВАЖНО!
    const availableDurations = SUPPORTED_DURATIONS[model];
    if (!availableDurations.includes(duration)) {
      setDuration(availableDurations[0]); // Автоматически установит 8 секунд для Veo 3 Fast
    }
  }, [resolution, aspectRatio, duration]);

  // Проверка совместимости при изменении разрешения
  const handleResolutionChange = useCallback((newResolution: string) => {
    setResolution(newResolution);

    // Проверяем совместимость с текущим соотношением сторон
    if (!isResolutionAspectRatioCompatible(selectedModel, newResolution, aspectRatio)) {
      setAspectRatio('16:9'); // Принудительно устанавливаем 16:9
    }

    // Проверяем совместимость с текущей длительностью
    if (!isResolutionDurationCompatible(selectedModel, newResolution, duration)) {
      setDuration('8'); // Принудительно устанавливаем 8 секунд
    }
  }, [selectedModel, aspectRatio, duration]);

  // Проверка совместимости при изменении соотношения сторон
  const handleAspectRatioChange = useCallback((newAspectRatio: string) => {
    setAspectRatio(newAspectRatio);

    // Проверяем совместимость с текущим разрешением
    if (!isResolutionAspectRatioCompatible(selectedModel, resolution, newAspectRatio)) {
      setResolution('720p'); // Принудительно устанавливаем 720p
    }
  }, [selectedModel, resolution]);

  // Проверка совместимости при изменении длительности
  const handleDurationChange = useCallback((newDuration: VideoDuration) => {
    setDuration(newDuration);

    // Проверяем совместимость с текущим разрешением
    if (!isResolutionDurationCompatible(selectedModel, resolution, newDuration)) {
      setResolution('720p'); // Принудительно устанавливаем 720p
    }
  }, [selectedModel, resolution]);

  const addReferenceImage = useCallback((file: File) => {
    const preview = URL.createObjectURL(file);
    const newImage: ReferenceImage = {
      file,
      preview,
      name: file.name,
      size: file.size
    };
    setReferenceImages(prev => [...prev, newImage]);
  }, []);

  const removeReferenceImage = useCallback((index: number) => {
    setReferenceImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      URL.revokeObjectURL(prev[index].preview);
      return newImages;
    });
  }, []);

  const clearReferenceImages = useCallback(() => {
    referenceImages.forEach(img => URL.revokeObjectURL(img.preview));
    setReferenceImages([]);
  }, [referenceImages]);

  const setStartingImageFile = useCallback((file: File) => {
    if (startingImage) {
      URL.revokeObjectURL(startingImage.preview);
    }
    const preview = URL.createObjectURL(file);
    const newImage: ReferenceImage = {
      file,
      preview,
      name: file.name,
      size: file.size
    };
    setStartingImage(newImage);
  }, [startingImage]);

  const clearStartingImage = useCallback(() => {
    if (startingImage) {
      URL.revokeObjectURL(startingImage.preview);
      setStartingImage(null);
    }
  }, [startingImage]);

  return {
    generationMode,
    setGenerationMode,
    resolution,
    setResolution: handleResolutionChange,
    aspectRatio,
    setAspectRatio: handleAspectRatioChange,
    selectedModel,
    setSelectedModel: handleModelChange,
    duration,
    setDuration: handleDurationChange,
    modelVersion: VIDEO_MODEL_ENDPOINTS[selectedModel],
    referenceImages,
    addReferenceImage,
    removeReferenceImage,
    clearReferenceImages,
    startingImage,
    setStartingImageFile,
    clearStartingImage
  };
}