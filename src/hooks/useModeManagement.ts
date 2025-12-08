import { useEffect, useRef } from 'react';
import { Mode, PANELS_COUNT, StreamState, ImageGenerationResult, VideoGenerationResult } from '@/types/stream';

interface UseModeManagementProps {
  mode: Mode;
  prompt: {
    reset: () => void;
    setError: (error: string | null) => void;
  };
  setStreams: (mode: Mode) => React.Dispatch<React.SetStateAction<StreamState[]>>;
  imageGeneration: {
    setImageResults: (results: ImageGenerationResult[]) => void;
  };
  videoGeneration: {
    setVideoResults: (results: VideoGenerationResult[]) => void;
  };
  seoArticle: {
    reset: () => void;
  };
  selectedImageModel: string | null;
  setIsImagesDropdownOpen: (open: boolean) => void;
  hasSavedRefs: {
    hasSavedRef: React.MutableRefObject<boolean>;
    hasSavedImagesRef: React.MutableRefObject<boolean>;
    hasSavedVideosRef: React.MutableRefObject<boolean>;
  };
}

export function useModeManagement({
  mode,
  prompt,
  setStreams,
  imageGeneration,
  videoGeneration,
  seoArticle,
  selectedImageModel,
  setIsImagesDropdownOpen,
  hasSavedRefs,
}: UseModeManagementProps) {
  const prevModeRef = useRef<Mode>('html');
  const isFirstRenderRef = useRef(true);
  const prevModeForMenuRef = useRef<Mode>(mode);

  // Очистка при смене режима
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevModeRef.current = mode;
      return;
    }

    if (prevModeRef.current !== mode) {
      prompt.reset();
      prompt.setError(null);

      const prevMode = prevModeRef.current;

      if (prevMode === 'text' || prevMode === 'html' || prevMode === 'research') {
        setStreams(prevMode)(Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' })));
      }

      if (prevMode === 'seo-article') {
        seoArticle.reset();
      }

      if (prevMode === 'images') {
        imageGeneration.setImageResults([]);
      }

      if (prevMode === 'videos') {
        videoGeneration.setVideoResults([]);
      }
    }

    prevModeRef.current = mode;
  }, [mode, prompt, setStreams, imageGeneration, videoGeneration, seoArticle]);

  // Управление меню и флагами сохранения
  useEffect(() => {
    if (mode !== 'images' && selectedImageModel !== null) {
      // Сброс модели изображений при выходе из режима
    }

    if (prevModeForMenuRef.current !== mode && mode !== 'images' && setIsImagesDropdownOpen) {
      setIsImagesDropdownOpen(false);
    }

    // Сброс флагов сохранения
    if (mode !== 'images') hasSavedRefs.hasSavedImagesRef.current = false;
    if (mode !== 'videos') hasSavedRefs.hasSavedVideosRef.current = false;
    if (mode !== 'text' && mode !== 'html' && mode !== 'research' && mode !== 'seo-article') {
      hasSavedRefs.hasSavedRef.current = false;
    }

    prevModeForMenuRef.current = mode;
  }, [mode, selectedImageModel, setIsImagesDropdownOpen, hasSavedRefs]);
}