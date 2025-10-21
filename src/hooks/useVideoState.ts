import { useState, useCallback } from 'react';
import { ReferenceImage } from '@/types/stream';

export type VideoGenerationMode = 'text-to-video' | 'image-to-video';

export function useVideoState() {
  const [generationMode, setGenerationMode] = useState<VideoGenerationMode>('text-to-video');
  const [resolution, setResolution] = useState<string>('720p');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [modelVersion, setModelVersion] = useState<string>('veo-3.1-generate-preview');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [startingImage, setStartingImage] = useState<ReferenceImage | null>(null);

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
    setResolution,
    aspectRatio,
    setAspectRatio,
    modelVersion,
    setModelVersion,
    referenceImages,
    addReferenceImage,
    removeReferenceImage,
    clearReferenceImages,
    startingImage,
    setStartingImageFile,
    clearStartingImage
  };
}