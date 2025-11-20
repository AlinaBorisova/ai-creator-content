'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Mode } from '@/types/stream';
import { ServerHistoryItem, ImageGenerationResult } from '@/types/stream';
import { TrashIcon } from './Icons';

type HistoryPanelProps = {
  mode: Mode;
  history: ServerHistoryItem[];
  loading?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onLoadFromHistory: (item: ServerHistoryItem) => void;
  onDeleteFromHistory: (id: string) => void;
  onClearHistory: () => void;
};

export default function HistoryPanel({
  mode,
  history,
  loading = false,
  isOpen,
  onClose,
  onLoadFromHistory,
  onDeleteFromHistory,
  onClearHistory
}: HistoryPanelProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return null;
  }

  return (
    <>
      {/* Выдвижная панель истории */}
      <div className={`fixed top-0 left-0 h-full w-80 bg-(--background-color) border-r border-gray-700 transform transition-transform duration-300 ease-in-out z-40 ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-200">
            История: {mode === 'images' ? 'Изображения' : mode === 'html' ? 'HTML' : mode === 'videos' ? 'Видео' : mode === 'research' ? 'Исследование' : 'Текст'}            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

          </div>

          {/* Кнопка очистки истории */}
          {history.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => {
                  if (confirm(`Очистить всю историю ${
                    mode === 'images' ? 'изображений' 
                    : mode === 'html' ? 'HTML' 
                    : mode === 'videos' ? 'видео'
                    : mode === 'research' ? 'research'
                    : 'текста'
                  }?`)) {
                    onClearHistory();
                  }
                }}
                className="flex items-center gap-2 w-full px-3 py-2 bg-red-900/50 cursor-pointer hover:bg-red-900 text-red-300 rounded-lg text-sm font-medium transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                Очистить историю
              </button>
            </div>
          )}

          {/* Отображение модели для изображений */}
          {mode === 'images' && history.length > 0 && (
            <div className="mb-4 text-sm text-gray-400">
              Модель: {history[0]?.model || 'Не указана'}
            </div>
          )}

          {/* Отображение модели для видео */}
          {mode === 'videos' && history.length > 0 && (
            <div className="mb-4 text-sm text-gray-400">
              Модель: {history[0]?.model || 'Не указана'}
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            {loading && history.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-500 italic">История пуста</p>
            ) : (
              <div className="space-y-2">
                {loading && (
                  <div className="absolute top-2 right-2 z-10">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  </div>
                )}
                {history.map(item => {
                  // Для режима images пытаемся получить первое изображение для превью
                  let previewImage: string | null = null;
                  if (mode === 'images' && item.results && Array.isArray(item.results)) {
                    const firstResult = item.results[0] as ImageGenerationResult;
                    if (firstResult?.images && firstResult.images.length > 0) {
                      const firstImage = firstResult.images[0];
                      previewImage = `data:${firstImage.mimeType};base64,${firstImage.imageBytes}`;
                    }
                  }

                  return (
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
                        <div className="flex items-start gap-3">
                          {/* Превью изображения для режима images */}
                          {mode === 'images' && previewImage ? (
                            <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden border border-gray-700">
                              <Image
                                src={previewImage}
                                alt="Preview"
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            </div>
                          ) : null}
                          
                          <div className="flex-1 min-w-0">
                            {/* Показываем промпт только если нет превью или не режим images */}
                            {!(mode === 'images' && previewImage) && (
                              <p className="text-sm text-gray-300 line-clamp-3 break-words">
                                {item.prompt}
                              </p>
                            )}
                            {/* Для режима images с превью показываем промпт под изображением меньшим шрифтом */}
                            {mode === 'images' && previewImage && (
                              <p className="text-xs text-gray-400 line-clamp-2 break-words mt-1">
                                {item.prompt}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(item.createdAt).toLocaleDateString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          
                          {/* Индикатор наличия результатов */}
                          <div className="ml-2 flex-shrink-0">
                            <div className="w-2 h-2 bg-green-500 rounded-full" title="Кликните для загрузки результатов" />
                          </div>
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
                  );
                })}
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
