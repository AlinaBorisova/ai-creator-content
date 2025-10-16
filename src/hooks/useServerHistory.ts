import { useState, useCallback } from 'react';
import { ServerHistoryItem } from '@/types/stream';
//import { ImageGenerationResult } from '@/types/stream';
//import { StreamState } from '@/types/stream';

// interface ApiHistoryItem {
//   id: string;
//   userId: string;
//   prompt: string;
//   mode: string;
//   model?: string;
//   results?: ServerHistoryItem[] | ImageGenerationResult[] | StreamState[];
//   createdAt: string;
// }

export const useServerHistory = (userId: string) => {
  const [history, setHistory] = useState<ServerHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Загрузить историю
  const loadHistory = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/history?userId=${userId}`);
      const data = await response.json();
      setHistory(data);
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
        // Обновляем локальную историю
        const newItem = await response.json();
        setHistory(prev => [newItem, ...prev]);
      }
    } catch (error) {
      console.error('Error saving to history:', error);
    }
  }, [userId]);

  // Удалить из истории
  const deleteFromHistory = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/history/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setHistory(prev => prev.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error('Error deleting from history:', error);
    }
  }, []);

  return {
    history,
    loading,
    loadHistory,
    saveToHistory,
    deleteFromHistory
  };
};