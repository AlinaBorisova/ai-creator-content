// src/hooks/useServerHistory.ts
import { useState, useCallback } from 'react';
import { ServerHistoryItem } from '@/types/stream';

export const useServerHistory = (userId: string) => {
  const [history, setHistory] = useState<ServerHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Загрузить историю
  const loadHistory = useCallback(async (mode?: string, model?: string) => {
    if (!userId) return;
  
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId });
      if (mode) params.append('mode', mode);
      if (model) params.append('model', model);
      
      const response = await fetch(`/api/history?${params.toString()}`);
      const data = await response.json();
      setHistory(data); // Заменяем историю полностью, а не добавляем
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
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
        // Перезагружаем историю с сервера с теми же параметрами
        loadHistory(mode, model);
      }
    } catch (error) {
      console.error('Error saving to history:', error);
    }
  }, [userId, loadHistory]);

  // Удалить из истории
  const deleteFromHistory = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/history/${id}`, {
        method: 'DELETE'
      });
  
      if (response.ok) {
        // Перезагружаем историю с сервера вместо локального обновления
        loadHistory();
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