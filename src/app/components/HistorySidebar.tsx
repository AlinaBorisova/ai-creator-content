'use client';

import { useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

type StreamStatus = 'idle' | 'loading' | 'done' | 'error';

type StreamState = {
  text: string;
  status: StreamStatus;
  error?: string | null;
};

type HistoryItem = {
  id: string;
  prompt: string;
  timestamp: number;
  results?: StreamState[];
};

type HistorySidebarProps = {
  mode: 'text' | 'html';
  history: HistoryItem[];
  onLoadFromHistory: (item: HistoryItem) => void;
  onDeleteFromHistory: (id: string) => void;
};

export default function HistorySidebar({ mode, history, onLoadFromHistory, onDeleteFromHistory }: HistorySidebarProps) {
  // const [textHistory, setTextHistory] = useLocalStorage<HistoryItem[]>('ai-text-history', []);
  // const [htmlHistory, setHtmlHistory] = useLocalStorage<HistoryItem[]>('ai-html-history', []);

  // const history = mode === 'html' ? htmlHistory : textHistory;

  return (
    <aside className="w-64 flex-shrink-0 hidden lg:block">
      <div className="sticky top-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">
          История {mode === 'html' ? 'HTML' : 'текста'}
        </h2>
        <div className="space-y-2 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pr-2">
          {history.length === 0 ? (
            <p className="text-sm text-gray-500 italic">История пуста</p>
          ) : (
            history.map(item => (
              <div
                key={item.id}
                className="group relative bg-gray-800/50 border border-gray-700 rounded-lg p-3 hover:bg-gray-800 transition-colors"
              >
                <button
                  onClick={() => onLoadFromHistory(item)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-300 line-clamp-3 break-words">
                        {item.prompt}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(item.timestamp).toLocaleDateString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {/* Индикатор сохраненных результатов */}
                    {item.results?.some(r => r.text) && (
                      <div className="ml-2 flex-shrink-0">
                        <div className="w-2 h-2 bg-green-500 rounded-full" title="Есть сохраненные результаты" />
                      </div>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFromHistory(item.id);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-900/50 hover:bg-red-900 text-red-300 rounded p-1"
                  title="Удалить"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}