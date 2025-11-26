'use client';

import { SEOArticleResult } from '@/types/stream';
import { useState } from 'react';
import { ExternalLinkIcon } from './Icons';

interface SEOArticleResultsProps {
  articleResult: SEOArticleResult | null;
  onRegenerateImage: (placeholderId: string) => void;
  onAbortImageGeneration: (placeholderId: string) => void;
}

export function SEOArticleResults({
  articleResult,
  onRegenerateImage,
  onAbortImageGeneration
}: SEOArticleResultsProps) {
  const [showRawHTML, setShowRawHTML] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  if (!articleResult) {
    return null;
  }

  const { htmlContent, imagePlaceholders, status, error } = articleResult;

  /**
   * Определяет тип ошибки и возвращает понятное сообщение
   */
  const getErrorInfo = (errorMessage?: string) => {
    if (!errorMessage) return { type: 'unknown', message: 'Неизвестная ошибка', icon: '❌' };

    const lowerError = errorMessage.toLowerCase();

    if (lowerError.includes('429') || lowerError.includes('rate limit') || lowerError.includes('too many requests')) {
      return {
        type: 'rate-limit',
        message: 'Превышен лимит запросов. Пожалуйста, подождите немного и попробуйте снова.',
        icon: '⏳',
        color: 'text-yellow-400'
      };
    }

    if (lowerError.includes('network') || lowerError.includes('fetch') || lowerError.includes('connection')) {
      return {
        type: 'network',
        message: 'Проблема с сетью. Проверьте подключение к интернету.',
        icon: '🌐',
        color: 'text-orange-400'
      };
    }

    if (lowerError.includes('timeout') || lowerError.includes('aborted')) {
      return {
        type: 'timeout',
        message: 'Превышено время ожидания. Операция была отменена или заняла слишком много времени.',
        icon: '⏱️',
        color: 'text-blue-400'
      };
    }

    if (lowerError.includes('401') || lowerError.includes('unauthorized')) {
      return {
        type: 'auth',
        message: 'Ошибка авторизации. Проверьте настройки API ключа.',
        icon: '🔐',
        color: 'text-red-400'
      };
    }

    if (lowerError.includes('500') || lowerError.includes('internal server')) {
      return {
        type: 'server',
        message: 'Ошибка сервера. Попробуйте позже.',
        icon: '🖥️',
        color: 'text-red-500'
      };
    }

    return {
      type: 'unknown',
      message: errorMessage,
      icon: '❌',
      color: 'text-red-400'
    };
  };

  /**
   * Переключает видимость деталей ошибки
   */
  const toggleErrorDetails = (id: string) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  /**
   * Копирует текст ошибки в буфер обмена
   */
  const copyErrorToClipboard = (errorText: string, event: React.MouseEvent) => {
    event.stopPropagation();
    navigator.clipboard.writeText(errorText);
    // Можно добавить toast уведомление, если есть
  };

  // Получаем информацию об общей ошибке статьи
  const articleErrorInfo = error ? getErrorInfo(error) : null;

  /**
   * Открывает HTML контент в новом окне как полную HTML страницу
   */
  const openInNewWindow = () => {
    // Используем finalHTML если есть (с вставленным контентом в шаблон), иначе htmlContent
    const contentToUse = articleResult.finalHTML || htmlContent;
    if (!contentToUse) return;

    // Если есть finalHTML, это уже полная страница с шаблоном, просто открываем
    if (articleResult.finalHTML) {
      const blob = new Blob([contentToUse], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');

      if (newWindow) {
        newWindow.addEventListener('beforeunload', () => {
          URL.revokeObjectURL(url);
        });
      } else {
        URL.revokeObjectURL(url);
        alert('Пожалуйста, разрешите открытие всплывающих окон для этого сайта');
      }
      return;
    }

    // Если нет шаблона, формируем базовую HTML страницу
    const fullHTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Статья</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #fff;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 20px 0;
    }
    .stati__img, .seo__content-images {
      display: flex;
      gap: 20px;
      margin: 30px 0;
      flex-wrap: wrap;
    }
    .stati__img img, .seo__content-images img {
      flex: 1;
      min-width: 300px;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 30px;
      margin-bottom: 15px;
      font-weight: 600;
    }
    p {
      margin-bottom: 15px;
    }
    ul, ol {
      margin-left: 30px;
      margin-bottom: 15px;
    }
    li {
      margin-bottom: 8px;
    }
    .text-bold {
      font-weight: 700;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    // Создаем blob URL для HTML контента
    const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    // Открываем в новом окне
    const newWindow = window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');

    // Очищаем URL после открытия (опционально, можно оставить для возможности перезагрузки)
    if (newWindow) {
      newWindow.addEventListener('beforeunload', () => {
        URL.revokeObjectURL(url);
      });
    } else {
      // Если окно заблокировано, очищаем URL сразу
      URL.revokeObjectURL(url);
      alert('Пожалуйста, разрешите открытие всплывающих окон для этого сайта');
    }
  };

  return (
    <div className="w-full">
      {/* Статус генерации */}
      <div className="mb-4 p-4 bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Статус генерации</h3>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                status === 'done' ? 'bg-green-500' :
                status === 'error' ? 'bg-red-500' :
                status === 'generating-text' || status === 'generating-images' ? 'bg-yellow-500 animate-pulse' :
                'bg-gray-500'
              }`} />
              <span className="text-sm text-gray-300">
                {status === 'generating-text' && 'Генерация текста...'}
                {status === 'generating-images' && `Генерация изображений... (${imagePlaceholders.filter(p => p.status === 'done').length}/${imagePlaceholders.length})`}
                {status === 'done' && 'Готово!'}
                {status === 'error' && 'Остановлено'}
                {!status && 'Ожидание...'}
              </span>
            </div>
            
            {/* Детальное отображение общей ошибки статьи */}
            {status === 'error' && articleErrorInfo && (
              <div className="mt-3 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{articleErrorInfo.icon}</span>
                      <span className={`text-sm font-semibold ${articleErrorInfo.color || 'text-red-400'}`}>
                        {articleErrorInfo.message}
                      </span>
                    </div>
                    {expandedErrors.has('article-error') && (
                      <div className="mt-2 text-xs text-gray-400 font-mono bg-gray-900/50 p-2 rounded">
                        {error}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => copyErrorToClipboard(error || '', e)}
                      className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                      title="Копировать ошибку"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => toggleErrorDetails('article-error')}
                      className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                      title={expandedErrors.has('article-error') ? 'Скрыть детали' : 'Показать детали'}
                    >
                      {expandedErrors.has('article-error') ? '▲' : '▼'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRawHTML(!showRawHTML)}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              {showRawHTML ? 'Показать результат' : 'Показать HTML'}
            </button>
            {status === 'done' && htmlContent && (
              <button
                onClick={openInNewWindow}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                title="Открыть в новом окне"
              >
                <ExternalLinkIcon className="w-4 h-4" />
                Открыть в окне
              </button>
            )}
          </div>
        </div>
      </div>

      

      {/* Список изображений для перегенерации */}
      {imagePlaceholders.length > 0 && (
        <div className="mb-4 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-200 mb-3">Изображения</h3>
          <div className="space-y-2">
            {imagePlaceholders.map((placeholder) => {
              const placeholderErrorInfo = placeholder.error ? getErrorInfo(placeholder.error) : null;
              
              return (
                <div
                  key={placeholder.id}
                  className={`p-3 rounded-lg ${
                    placeholder.status === 'error' 
                      ? 'bg-red-900/20 border border-red-500/50' 
                      : 'bg-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-gray-400 mb-1">Промпт:</p>
                      <p className="text-sm text-gray-300 mb-2">{placeholder.prompt}</p>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded ${
                          placeholder.status === 'done' ? 'bg-green-900 text-green-300' :
                          placeholder.status === 'generating' ? 'bg-yellow-900 text-yellow-300' :
                          placeholder.status === 'error' ? 'bg-red-900 text-red-300' :
                          'bg-gray-900 text-gray-400'
                        }`}>
                          {placeholder.status === 'done' && '✓ Готово'}
                          {placeholder.status === 'generating' && '⏳ Генерация...'}
                          {placeholder.status === 'error' && '✗ Ошибка'}
                          {placeholder.status === 'pending' && '⏸ Ожидание'}
                        </span>
                        
                        {placeholder.images.length > 0 && (
                          <span className="text-xs text-gray-400">
                            {placeholder.images.length} изображений
                          </span>
                        )}
                      </div>
                      
                      {/* Детальное отображение ошибки placeholder */}
                      {placeholder.status === 'error' && placeholderErrorInfo && (
                        <div className="mt-3 p-2 bg-red-900/30 rounded border border-red-500/30">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span>{placeholderErrorInfo.icon}</span>
                                <span className={`text-xs font-medium ${placeholderErrorInfo.color || 'text-red-400'}`}>
                                  {placeholderErrorInfo.message}
                                </span>
                              </div>
                              {/* Показываем текст ошибки всегда, если он есть */}
                              {placeholder.error && (
                                <div className="mt-2 text-xs text-red-300 bg-red-950/50 p-2 rounded break-all border border-red-500/30">
                                  <div className="font-semibold mb-1 text-red-200">Детали ошибки:</div>
                                  <div className="font-mono whitespace-pre-wrap">{placeholder.error}</div>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {placeholder.error && (
                                <button
                                  onClick={(e) => copyErrorToClipboard(placeholder.error || '', e)}
                                  className="px-1.5 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                                  title="Копировать ошибку"
                                >
                                  📋
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 flex-shrink-0">
                      {placeholder.status === 'generating' && (
                        <button
                          onClick={() => onAbortImageGeneration(placeholder.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                        >
                          Отменить
                        </button>
                      )}
                      {(placeholder.status === 'done' || placeholder.status === 'error') && (
                        <button
                          onClick={() => onRegenerateImage(placeholder.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          {placeholder.status === 'error' ? 'Повторить' : 'Перегенерировать'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Сводка по ошибкам */}
          {imagePlaceholders.some(p => p.status === 'error') && (
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/50 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <span>⚠️</span>
                <span>
                  Ошибки при генерации: {imagePlaceholders.filter(p => p.status === 'error').length} из {imagePlaceholders.length} изображений
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
              Вы можете перегенерировать изображения с ошибками, нажав кнопку &quot;Повторить&quot;
              </p>
            </div>
          )}
        </div>
      )}

      {/* Результат - HTML статья */}
      {htmlContent && (
        <div className="bg-gray-800 rounded-lg p-6">
          {showRawHTML ? (
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">
              {htmlContent}
            </pre>
          ) : (
            <div
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </div>
      )}

      {/* Кнопки копирования HTML */}
      {htmlContent && (() => {
        // Проверяем, все ли изображения сгенерированы или имеют ошибку
        const allImagesDone = imagePlaceholders.length === 0 ||
          imagePlaceholders.every(p => p.status === 'done' || p.status === 'error');

        // Показываем кнопку если статус 'done' или все изображения готовы
        const shouldShowButton = status === 'done' || (status !== 'generating-text' && allImagesDone);

        return shouldShowButton ? (
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => {
                const contentToCopy = articleResult.finalHTML || htmlContent;

                // Логирование для отладки
                console.log('📋 Copying HTML:', {
                  hasFinalHTML: !!articleResult.finalHTML,
                  finalHTMLLength: articleResult.finalHTML?.length || 0,
                  htmlContentLength: htmlContent.length,
                  hasMainMarker: articleResult.finalHTML?.includes('[Сюда вставить весь сгенерированный текст]'),
                  contentToCopyLength: contentToCopy.length
                });

                navigator.clipboard.writeText(contentToCopy);
                alert(articleResult.finalHTML
                  ? (articleResult.finalHTML.includes('[Сюда вставить весь сгенерированный текст]')
                    ? 'ВНИМАНИЕ: Маркеры не были заменены! Проверьте консоль для отладки.'
                    : 'Полный HTML с шаблоном скопирован в буфер обмена')
                  : 'HTML скопирован в буфер обмена');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {articleResult.finalHTML ? 'Копировать полный HTML' : 'Копировать HTML'}
            </button>
          </div>
        ) : null;
      })()}
    </div>
  );
}