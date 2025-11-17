// src/hooks/useServerHistory.ts
import { useState, useCallback, useRef } from 'react';
import { ServerHistoryItem } from '@/types/stream';

export const useServerHistory = (userId: string) => {
  const [history, setHistory] = useState<ServerHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Кэш истории по ключу mode_model
  const historyCacheRef = useRef<Map<string, ServerHistoryItem[]>>(new Map());
  // Ref для отмены предыдущих запросов
  const abortControllerRef = useRef<AbortController | null>(null);

  // Загрузить историю
  const loadHistory = useCallback(async (mode?: string, model?: string) => {
    if (!userId) return;
  
    const cacheKey = `${mode || 'all'}_${model || 'all'}`;
    
    // Показываем кэшированную историю сразу (оптимистичное обновление)
    if (historyCacheRef.current.has(cacheKey)) {
      setHistory(historyCacheRef.current.get(cacheKey)!);
    }
    
    // Отменяем предыдущий запрос, если он еще выполняется
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Создаем новый контроллер для текущего запроса
    const controller = new AbortController();
    abortControllerRef.current = controller;
  
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId });
      if (mode) params.append('mode', mode);
      if (model) params.append('model', model);
      
      const response = await fetch(`/api/history?${params.toString()}`, {
        signal: controller.signal
      });
      
      // Проверяем, не был ли запрос отменен
      if (controller.signal.aborted) {
        return;
      }
      
      const data = await response.json();
      setHistory(data);
      
      // Обновляем кэш
      historyCacheRef.current.set(cacheKey, data);
    } catch (error: unknown) {
      // Игнорируем ошибки отмены запроса
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error loading history:', error);
    } finally {
      // Обновляем loading только если запрос не был отменен
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [userId]);

  // Сохранить в историю
  const saveToHistory = useCallback(async (prompt: string, mode: string, model?: string, results?: unknown) => {  
    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          prompt,
          mode,
          model,
          results
        })
      });
  
      if (response.ok) {
        // Инвалидируем кэш для этого режима/модели
        const cacheKey = `${mode}_${model || 'all'}`;
        historyCacheRef.current.delete(cacheKey);
        // Перезагружаем историю с сервера с теми же параметрами
        loadHistory(mode, model);
      }
    } catch (error) {
      console.error('Error saving to history:', error);
    }
  }, [userId, loadHistory]);

  // Удалить из истории
  const deleteFromHistory = useCallback(async (id: string, mode?: string, model?: string) => {
    try {
      const response = await fetch(`/api/history/${id}`, {
        method: 'DELETE'
      });
  
      if (response.ok) {
        // Инвалидируем кэш для этого режима/модели
        if (mode) {
          const cacheKey = `${mode}_${model || 'all'}`;
          historyCacheRef.current.delete(cacheKey);
        }
        // Перезагружаем историю с сервера с теми же параметрами режима и модели
        loadHistory(mode, model);
      }
    } catch (error) {
      console.error('Error deleting from history:', error);
    }
  }, [loadHistory]);

  const clearHistory = useCallback(async (mode?: string, model?: string) => {
    try {
      const params = new URLSearchParams({ userId });
      if (mode) params.append('mode', mode);
      if (model) params.append('model', model);
      
      const response = await fetch(`/api/history/clear?${params.toString()}`, {
        method: 'DELETE'
      });
  
      if (response.ok) {
        // Инвалидируем кэш для этого режима/модели
        if (mode) {
          const cacheKey = `${mode}_${model || 'all'}`;
          historyCacheRef.current.delete(cacheKey);
        }
        // Перезагружаем историю с сервера вместо локального обновления
        loadHistory(mode, model);
      }
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }, [userId, loadHistory]);

  return {
    history,
    loading,
    loadHistory,
    saveToHistory,
    deleteFromHistory,
    clearHistory
  };
};