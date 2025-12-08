import { useEffect, useRef } from 'react';
import { Mode, StreamState, ImageGenerationResult, VideoGenerationResult } from '@/types/stream';

interface UseHistoryAutoSaveProps {
  mode: Mode;
  currentPromptValue: string;
  streams: StreamState[];
  imageResults: ImageGenerationResult[];
  videoResults: VideoGenerationResult[];
  saveToHistory: (
    prompt: string,
    mode: string,
    model?: string,
    results?: unknown
  ) => Promise<void>;
  selectedImageModel: string | null;
  getStreams: (mode: Mode) => StreamState[];
}

export function useHistoryAutoSave({
  mode,
  currentPromptValue,
  streams,
  imageResults,
  videoResults,
  saveToHistory,
  selectedImageModel,
  getStreams,
}: UseHistoryAutoSaveProps) {
  const hasSavedRef = useRef(false);
  const hasSavedImagesRef = useRef(false);
  const hasSavedVideosRef = useRef(false);

  useEffect(() => {
    if (mode === 'images') {
      const allDone = imageResults.every(result => result.status === 'done' || result.status === 'error');
      const hasContent = imageResults.some(result => result.images.length > 0);

      if (allDone && hasContent && imageResults.length > 0 && !hasSavedImagesRef.current) {
        hasSavedImagesRef.current = true;
        console.log('🎨 Saving image results to server history:', imageResults);

        const savePromises = imageResults.map(async (result) => {
          if (result.images.length > 0 || result.status === 'error') {
            return saveToHistory(
              result.prompt,
              'images',
              selectedImageModel || undefined,
              [result]
            );
          }
          return Promise.resolve();
        });

        Promise.all(savePromises).catch(error => {
          console.error('Error saving image results to history:', error);
        });
      } else if (!allDone) {
        hasSavedImagesRef.current = false;
      }
    } else if (mode === 'videos') {
      const allDone = videoResults.every(result => result.status === 'done' || result.status === 'error');
      const hasContent = videoResults.some(result => result.video.videoBytes);

      if (allDone && hasContent && videoResults.length > 0 && !hasSavedVideosRef.current) {
        hasSavedVideosRef.current = true;
        console.log('🎬 Saving video results to server history:', videoResults);

        saveToHistory(
          currentPromptValue,
          'videos',
          undefined,
          videoResults
        );
      } else if (!allDone) {
        hasSavedVideosRef.current = false;
      }
    } else if (mode === 'research') {
      const streams = getStreams(mode);
      const allDone = streams.every(s => s.status === 'done' || s.status === 'error');
      const hasContent = streams.some(s => s.text);

      if (allDone && hasContent && !hasSavedRef.current && currentPromptValue) {
        hasSavedRef.current = true;
        console.log('🔍 Saving research results to server history:', streams);

        const streamsToSave = streams.filter(s =>
          s.text.trim().length > 0 || s.status === 'done' || s.status === 'error'
        );

        saveToHistory(
          currentPromptValue,
          mode,
          undefined,
          streamsToSave
        );
      } else if (!allDone) {
        hasSavedRef.current = false;
      }
    } else {
      const streams = getStreams(mode);
      const allDone = streams.every(s => s.status === 'done' || s.status === 'error');
      const hasContent = streams.some(s => s.text);

      if (allDone && hasContent && !hasSavedRef.current && currentPromptValue) {
        hasSavedRef.current = true;
        console.log('📝 Saving text/html results to server history:', streams);

        const streamsToSave = streams.filter(s =>
          s.text.trim().length > 0 || s.status === 'done' || s.status === 'error'
        );

        saveToHistory(
          currentPromptValue,
          mode,
          undefined,
          streamsToSave
        );
      } else if (!allDone) {
        hasSavedRef.current = false;
      }
    }
  }, [mode, imageResults, videoResults, streams, currentPromptValue, saveToHistory, selectedImageModel, getStreams]);

  return {
    hasSavedRef,
    hasSavedImagesRef,
    hasSavedVideosRef,
  };
}