import React from 'react';
import { StreamState, GroundingSource } from '@/types/stream';
import { CheckIcon, EditIcon, CopyIcon, CancelIcon, ExternalLinkIcon } from './Icons';

interface ResearchResultsProps {
  streams: StreamState[];
  editingStates: boolean[];
  onToggleEdit: (index: number) => void;
  onUpdateText: (index: number, text: string) => void;
  onCopyToClipboard: (index: number) => void;
  onAbort: (index: number) => void;
}

export function ResearchResults({
  streams,
  editingStates,
  onToggleEdit,
  onUpdateText,
  onCopyToClipboard,
  onAbort
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

          {/* Основной контент */}
          <div className="flex-1 overflow-auto min-h-[200px] mb-4">
            {s.status === 'error' ? (
              <p className="text-red-300">{s.error ?? 'Ошибка'}</p>
            ) : editingStates[i] ? (
              <textarea
                value={s.text}
                onChange={(e) => onUpdateText(i, e.target.value)}
                className="w-full h-full min-h-[200px] bg-(--background-color) text-gray-100 text-sm p-3 rounded border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                spellCheck={false}
              />
            ) : (
              <div className="whitespace-pre-wrap break-words text-sm text-gray-100">
                {s.text || (s.status === 'loading' ? 'Исследование...' : 'No content yet')}
              </div>
            )}
          </div>

          {/* Источники */}
          {s.sources && s.sources.length > 0 && (
            <div className="border-t border-gray-700 pt-4 mb-4">
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