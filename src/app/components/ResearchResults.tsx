import React from 'react';
import { StreamState, GroundingSource } from '@/types/stream';
import { extractHtmlFromMarkdown } from '@/utils/markdown';
import { CheckIcon, EditIcon, CopyIcon, CancelIcon, ExternalLinkIcon } from './Icons';

interface ResearchResultsProps {
  streams: StreamState[];
  editingStates: boolean[];
  openCodePanels: boolean[];
  iframeHeights: number[];
  onToggleEdit: (index: number) => void;
  onUpdateText: (index: number, text: string) => void;
  onCopyToClipboard: (index: number) => void;
  onAbort: (index: number) => void;
  onToggleCodePanel: (index: number) => void;
  onAdjustIframeHeight: (iframe: HTMLIFrameElement, index: number) => void;
  onRetry?: (index: number) => void;
}

// Функция для добавления источников и запросов в HTML
const addSourcesAndQueriesToHtml = (html: string, sources?: GroundingSource[], searchQueries?: string[]): string => {
  if (!sources && !searchQueries) return html;

  const sourcesAndQueriesHtml = `
    <div style="margin-top: 40px; padding: 30px; background-color: #f8f9fa; border-top: 2px solid #6c5ce7;">
      ${sources && sources.length > 0 ? `
        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 1.5em; color: #333; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Источники (${sources.length})
          </h3>
          <div style="max-height: 200px; overflow-y: auto;">
            ${sources.map((source, index) => `
              <a href="${source.uri}" target="_blank" rel="noopener noreferrer" 
                 style="display: block; padding: 8px 12px; margin-bottom: 8px; 
                        background-color: #fff; border-left: 4px solid #6c5ce7; 
                        border-radius: 4px; text-decoration: none; color: #3498db; 
                        transition: background-color 0.2s;">
                ${index + 1}. ${source.title}
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${searchQueries && searchQueries.length > 0 ? `
        <div>
          <h3 style="font-size: 1.5em; color: #333; margin-bottom: 15px;">Поисковые запросы:</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${searchQueries.map(query => `
              <span style="padding: 6px 12px; background-color: #fff; border: 1px solid #ddd; 
                           border-radius: 16px; font-size: 0.9em; color: #555;">
                "${query}"
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // Вставляем перед закрывающим тегом </body> или перед </html>
  if (html.includes('</body>')) {
    return html.replace('</body>', `${sourcesAndQueriesHtml}</body>`);
  } else if (html.includes('</html>')) {
    return html.replace('</html>', `${sourcesAndQueriesHtml}</html>`);
  } else {
    // Если нет закрывающих тегов, добавляем в конец
    return html + sourcesAndQueriesHtml;
  }
};

export function ResearchResults({
  streams,
  editingStates,
  openCodePanels,
  iframeHeights,
  onToggleEdit,
  onUpdateText,
  onCopyToClipboard,
  onAbort,
  onToggleCodePanel,
  onAdjustIframeHeight,
  onRetry,
}: ResearchResultsProps) {
  return (
    <>
      {streams.map((s, i) => (
        <div key={i} className="rounded-xl border border-gray-800 bg-[#191919] p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-200">Research Result #{i + 1}</h3>
            <span className={
              s.status === 'loading'
                ? 'text-xs px-2 py-1 rounded bg-blue-900/40 text-blue-300'
                : s.status === 'done'
                  ? 'text-xs px-2 py-1 rounded bg-green-900/30 text-green-300'
                  : s.status === 'error'
                    ? 'text-xs px-2 py-1 rounded bg-red-900/30 text-red-300'
                    : 'text-xs px-2 py-1 rounded bg-(--background-color) text-gray-300'
            }>
              {s.status}
            </span>
          </div>

          {/* HTML режим: кнопка слева + preview + выдвижной блок с кодом */}
          <div className="w-full result-container">
            <div className="relative flex">
              {/* Кнопка для показа/скрытия кода слева */}
              <button
                onClick={() => onToggleCodePanel(i)}
                className={`flex-shrink-0 w-12 h-12 mr-2 rounded-lg bg-(--background-color) border border-gray-700 hover:border-(--btn-hover-border) border border-gray-700 text-gray-300 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 ${openCodePanels[i] ? 'bg-blue-600 hover:bg-blue-700 hidden' : ''
                  }`}
                title={openCodePanels[i] ? 'Скрыть код' : 'Показать код'}
              >
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-xs">Code</span>
              </button>

              {/* Контейнер для preview и кода */}
              <div className="flex-1 flex">
                {/* Блок с кодом */}
                <div className={`bg-(--background-color) border-r border-gray-700 transition-all duration-300 ease-in-out overflow-y-auto code-column ${openCodePanels[i]
                  ? 'w-1/2 opacity-100 translate-x-0'
                  : 'w-0 opacity-0 -translate-x-full overflow-hidden'
                  }`}>
                  <div
                    className="flex flex-col min-w-0"
                    style={{
                      height: openCodePanels[i] ? `${iframeHeights[i] || 400}px` : '0px',
                      overflow: openCodePanels[i] ? 'visible' : 'hidden'
                    }}
                  >
                    <div className="flex items-center justify-between p-2 flex-shrink-0">
                      <h4 className="text-sm font-semibold text-gray-200">Research Code</h4>
                      <button
                        onClick={() => onToggleCodePanel(i)}
                        className="text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div
                      className="flex-1 overflow-y-auto custom-scrollbar code-content"
                      style={{
                        minHeight: openCodePanels[i] ? '300px' : '0px',
                        height: openCodePanels[i] ? `${Math.max((iframeHeights[i] || 400) - 60, 300)}px` : '0px'
                      }}
                    >
                      <div className="bg-(--background-color) rounded p-3 border border-gray-700 h-full">
                        {s.status === 'error' ? (
                          <p className="text-red-300 text-sm">{s.error ?? 'Ошибка'}</p>
                        ) : editingStates[i] ? (
                          <textarea
                            value={s.text}
                            onChange={(e) => onUpdateText(i, e.target.value)}
                            className="w-full h-full min-h-[300px] bg-(--background-color) text-gray-300 text-sm font-mono p-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                            spellCheck={false}
                          />
                        ) : (
                          <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words h-full overflow-auto">
                            {s.text || (s.status === 'loading' ? 'Генерация...' : 'Код еще не готов')}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className={`bg-white border border-gray-700 transition-all duration-300 preview-column ${openCodePanels[i]
                  ? 'w-1/2 rounded-l-none'
                  : 'w-full rounded-l'
                  }`}>
                  {s.text && s.status !== 'error' ? (
                    (() => {
                      let html = extractHtmlFromMarkdown(s.text);
                      if (html) {
                        // Добавляем источники и запросы в HTML
                        html = addSourcesAndQueriesToHtml(html, s.sources, s.searchQueries);
                      }
                      return html ? (
                        <iframe
                          srcDoc={html}
                          className="w-full border-0"
                          style={{
                            minHeight: '400px',
                            overflow: 'visible'
                          }}
                          sandbox="allow-scripts allow-same-origin"
                          title={`Research Preview ${i + 1}`}
                          onLoad={(e) => {
                            const iframe = e.target as HTMLIFrameElement;
                            onAdjustIframeHeight(iframe, i);
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center text-gray-400 text-sm">
                          <p className="text-center px-4">
                            {s.status === 'loading' ? (
                              'Ожидание HTML блока...'
                            ) : (
                              <>
                                No HTML code block found.<br />
                                <span className="text-xs">Looking for ... ```</span>
                              </>
                            )}
                          </p>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-gray-400 text-sm">
                      {s.status === 'loading' ? 'Загрузка превью...' : 'No preview yet'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Источники */}
          {s.sources && s.sources.length > 0 && (
            <div className="border-t border-gray-700 pt-4 mb-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                <ExternalLinkIcon className="w-4 h-4" />
                Источники ({s.sources.length})
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {s.sources.map((source: GroundingSource, sourceIndex: number) => (
                  <a
                    key={sourceIndex}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-400 hover:text-blue-300 truncate"
                    title={source.title}
                  >
                    {sourceIndex + 1}. {source.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Поисковые запросы */}
          {s.searchQueries && s.searchQueries.length > 0 && (
            <div className="border-t border-gray-700 pt-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Поисковые запросы:</h4>
              <div className="flex flex-wrap gap-2">
                {s.searchQueries.map((query: string, queryIndex: number) => (
                  <span
                    key={queryIndex}
                    className="text-xs px-2 py-1 bg-(--background-color) text-gray-300 rounded"
                  >
                    &ldquo;{query}&rdquo;
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Блок с ошибкой и кнопкой retry */}
          {s.status === 'error' && (
            <div className="mb-3 p-3 bg-red-900/20 border border-red-700 rounded-lg">
              <p className="text-red-300 text-sm mb-2">
                <strong>Ошибка:</strong> {s.error ?? 'Неизвестная ошибка'}
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(i)}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 border border-green-700 text-white text-sm py-2 px-3 rounded-md transition-all duration-300 hover:scale-105 cursor-pointer"
                  title="Повторить генерацию"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Повторить
                </button>
              )}
            </div>
          )}

          {/* Кнопки управления */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleEdit(i)}
              className={`${editingStates[i]
                ? 'bg-(--btn-active-color)'
                : 'bg-(--btn-color) hover:border-(--btn-hover-border)'
                } text-white text-sm py-2 px-3 border border-gray-700 rounded-md transition-all duration-300 hover:scale-105 cursor-pointer disabled:opacity-60`}
              disabled={!s.text || s.status === 'loading'}
              title={editingStates[i] ? 'Завершить редактирование' : 'Редактировать текст'}
            >
              {editingStates[i] ? (
                <div className="flex items-center gap-1">
                  <CheckIcon className="w-4 h-4" />
                  Done
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <EditIcon className="w-4 h-4" />
                  Edit
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={() => onCopyToClipboard(i)}
              className="flex items-center gap-1 bg-(--btn-color) border border-gray-700 hover:border-(--btn-hover-border) text-white text-sm py-2 px-3 rounded-md transition-all duration-300 hover:scale-105 cursor-pointer disabled:opacity-60"
              disabled={!s.text}
              title="Copy to clipboard"
            >
              <CopyIcon className="w-4 h-4" /> Копировать
            </button>
            <button
              type="button"
              onClick={() => onAbort(i)}
              className="flex items-center gap-1 bg-(--btn-color) border border-gray-700 hover:border-(--btn-hover-border) text-white text-sm py-2 px-3 rounded-md transition-all duration-300 hover:scale-105 cursor-pointer disabled:opacity-60"
              disabled={s.status !== 'loading'}
              title="Отменить это исследование"
            >
              <CancelIcon className="w-4 h-4" /> Отменить
            </button>
          </div>
        </div>
      ))}
    </>
  );
}