'use client';

import { useEffect, useState } from 'react';
import { Mode, HistoryItem } from '@/types/stream';

type HistoryPanelProps = {
  mode: Mode;
  history: HistoryItem[];
  isOpen: boolean;
  onClose: () => void;
  onLoadFromHistory: (item: HistoryItem) => void;
  onDeleteFromHistory: (id: string) => void;
};

export default function HistoryPanel({ 
  mode, 
  history, 
  isOpen, 
  onClose, 
  onLoadFromHistory, 
  onDeleteFromHistory 
}: HistoryPanelProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return null;
  }

  const getModeTitle = (mode: Mode) => {
    switch (mode) {
      case 'html': return 'HTML';
      case 'text': return 'текста';
      case 'images': return 'изображений';
      default: return 'текста';
    }
  };

  return (
    <>
      {/* Выдвижная панель истории */}
      <div className={`fixed top-0 left-0 h-full w-80 bg-gray-900 border-r border-gray-700 transform transition-transform duration-300 ease-in-out z-40 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-200">
              История {getModeTitle(mode)}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {history.length === 0 ? (
              <p className="text-sm text-gray-500 italic">История пуста</p>
            ) : (
              <div className="space-y-2">
                {history.map(item => (
                  <div
                    key={item.id}
                    className="group relative bg-gray-800/50 border border-gray-700 rounded-lg p-3 hover:bg-gray-800 transition-colors"
                  >
                    <button
                      onClick={() => {
                        onLoadFromHistory(item);
                        onClose();
                      }}
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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Затемнение фона */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={onClose}
        />
      )}
    </>
  );
}