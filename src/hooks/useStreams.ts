import { useState, useCallback, useRef, useEffect } from 'react';
import { StreamState, PANELS_COUNT, Mode, GroundingMetadata, GroundingChunk } from '@/types/stream';

export const useStreams = () => {
  const [textStreams, setTextStreams] = useState<StreamState[]>(
    () => Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' }))
  );
  const [htmlStreams, setHtmlStreams] = useState<StreamState[]>(
    () => Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' }))
  );
  const [imageStreams, setImageStreams] = useState<StreamState[]>(
    () => Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' }))
  );
  const [researchStreams, setResearchStreams] = useState<StreamState[]>(
    () => Array.from({ length: PANELS_COUNT }, () => ({ text: '', status: 'idle' }))
  );

  const deltaQueue = useRef<Map<number, string>>(new Map());
  const deltaTimeout = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const getStreams = (mode: Mode) => {
    switch (mode) {
      case 'html': return htmlStreams;
      case 'text': return textStreams;
      case 'images': return imageStreams;
      case 'research': return researchStreams;
      default: return textStreams;
    }
  };

  const setStreams = (mode: Mode) => {
    switch (mode) {
      case 'html': return setHtmlStreams;
      case 'text': return setTextStreams;
      case 'images': return setImageStreams;
      case 'research': return setResearchStreams;
      default: return setTextStreams;
    }
  };

  const markDone = useCallback((index: number, mode: Mode) => {
    console.log(`✅ Stream ${index} marked as done`);

    const setStreamsFn = setStreams(mode);

    // Обрабатываем оставшиеся дельты в очереди
    const queuedDelta = deltaQueue.current.get(index) || '';
    if (queuedDelta) {
      console.log(`📝 Processing final delta for stream ${index}:`, queuedDelta.slice(0, 50));
      setStreamsFn(prev => {
        const next = [...prev];
        const current = next[index];
        if (!current) return prev;
        next[index] = { ...current, text: current.text + queuedDelta };
        return next;
      });
      deltaQueue.current.set(index, '');
    }

    setStreamsFn(prev => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], status: 'done' };
      console.log(`📊 Updated streams after markDone:`, next.map((s, i) => ({
        index: i,
        status: s.status,
        hasText: !!s.text,
        textLength: s.text.length
      })));
      return next;
    });
  }, []);

  const appendDelta = useCallback((index: number, delta: string, mode: Mode) => {
    console.log(`Appending delta to stream ${index}:`, delta.slice(0, 50));

    const setStreamsFn = setStreams(mode);

    // Очищаем предыдущий таймаут
    const existingTimeout = deltaTimeout.current.get(index);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Добавляем дельту в очередь
    const currentQueue = deltaQueue.current.get(index) || '';
    deltaQueue.current.set(index, currentQueue + delta);

    // Устанавливаем новый таймаут для обработки
    const timeout = setTimeout(() => {
      const queuedDelta = deltaQueue.current.get(index) || '';
      if (queuedDelta) {
        setStreamsFn(prev => {
          const next = [...prev];
          const current = next[index];
          if (!current) return prev;
          next[index] = { ...current, text: current.text + queuedDelta };
          return next;
        });
        deltaQueue.current.set(index, '');
      }
      deltaTimeout.current.delete(index);
    }, 100);

    deltaTimeout.current.set(index, timeout);
  }, []);

  // Новая функция для обновления grounding метаданных
  const updateGroundingMetadata = useCallback((index: number, mode: Mode, metadata: GroundingMetadata) => {

    const setStreamsFn = setStreams(mode);
    setStreamsFn(prev => {
      const next = [...prev];
      if (!next[index]) return prev;

      // Извлекаем источники из grounding метаданных
      const sources = metadata?.groundingChunks?.map((chunk: GroundingChunk) => ({
        title: chunk.web?.title || 'Unknown',
        uri: chunk.web?.uri || ''
      })) || [];

      next[index] = {
        ...next[index],
        groundingMetadata: metadata,
        sources,
        searchQueries: metadata?.webSearchQueries || []
      };
      return next;
    });
  }, []);

  useEffect(() => {
    const deltaTimeoutRef = deltaTimeout.current;
    const deltaQueueRef = deltaQueue.current;

    return () => {
      // Очищаем все таймауты при размонтировании
      deltaTimeoutRef.forEach(timeout => clearTimeout(timeout));
      deltaTimeoutRef.clear();
      deltaQueueRef.clear();
    };
  }, []);

  return {
    textStreams,
    htmlStreams,
    imageStreams,
    researchStreams,
    getStreams,
    setStreams,
    markDone,
    appendDelta,
    updateGroundingMetadata
  };
};