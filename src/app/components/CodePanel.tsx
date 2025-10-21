'use client';

import { useEffect, useState } from 'react';
import { CheckIcon, EditIcon } from './Icons';

type StreamStatus = 'idle' | 'loading' | 'done' | 'error';

type StreamState = {
  text: string;
  status: StreamStatus;
  error?: string | null;
};

type CodePanelProps = {
  stream: StreamState;
  index: number;
  isOpen: boolean;
  onClose: () => void;
  onToggleEdit: (index: number) => void;
  onUpdateText: (index: number, text: string) => void;
  isEditing: boolean;
};

export default function CodePanel({
  stream,
  index,
  isOpen,
  onClose,
  onToggleEdit,
  onUpdateText,
  isEditing
}: CodePanelProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return null;
  }

  return (
    <>
      {/* Выдвижная панель с кодом */}
      <div className={`fixed top-0 right-0 h-full w-96 bg-gray-900 border-l border-gray-700 transform transition-transform duration-300 ease-in-out z-40 ${isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-200">
              HTML Code #{index + 1}
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
            <div className="bg-gray-800 rounded p-4 border border-gray-700 h-full">
              {stream.status === 'error' ? (
                <p className="text-red-300 text-sm">{stream.error ?? 'Ошибка'}</p>
              ) : isEditing ? (
                <textarea
                  value={stream.text}
                  onChange={(e) => onUpdateText(index, e.target.value)}
                  className="w-full h-full min-h-[500px] bg-gray-700 text-gray-300 text-sm font-mono p-3 rounded border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                  spellCheck={false}
                />
              ) : (
                <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words h-full overflow-auto">
                  {stream.text || (stream.status === 'loading' ? 'Генерация...' : 'Код еще не готов')}
                </pre>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => onToggleEdit(index)}
              className={`${isEditing
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-700 hover:bg-gray-600'
                } text-white text-sm py-2 px-3 rounded-md transition-colors cursor-pointer disabled:opacity-60`}
              disabled={!stream.text || stream.status === 'loading'}
              title={isEditing ? 'Завершить редактирование' : 'Редактировать текст'}
            >
              {isEditing ? (
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