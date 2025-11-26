'use client';

import { useState, useEffect, useRef } from 'react';
import { GeminiModelSelector, GeminiModelVersion } from './GeminiModelSelector';

// Типы для разрешений
export type ImageResolution = {
  width: number;
  height: number;
  label: string;
  aspectRatio: string;
};

export const IMAGE_RESOLUTIONS: ImageResolution[] = [
  { width: 1408, height: 768, label: 'Дзен', aspectRatio: '16:9' },
  { width: 1280, height: 700, label: 'Телеграм', aspectRatio: '16:9' },
  { width: 1080, height: 1080, label: 'Квадрат', aspectRatio: '1:1' },
  { width: 1100, height: 550, label: 'Статьи 1', aspectRatio: '16:9' },
  { width: 800, height: 450, label: 'Статьи 2', aspectRatio: '16:9' }
];

interface SEOArticleFormProps {
  onGenerate: (prompt: string, htmlTemplate: string, imageResolution: ImageResolution, modelVersion: GeminiModelVersion) => void;
  isStreaming: boolean;
  isParsingPrompts: boolean;
  isGeneratingImages: boolean;
  onAbort?: () => void;
}

export function SEOArticleForm({
  onGenerate,
  isStreaming,
  isParsingPrompts,
  isGeneratingImages,
  onAbort
}: SEOArticleFormProps) {
  const [prompt, setPrompt] = useState('');
  const [htmlTemplate, setHtmlTemplate] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [imageResolution, setImageResolution] = useState<ImageResolution>(IMAGE_RESOLUTIONS[0]); // По умолчанию Дзен
  const [isResolutionDropdownOpen, setIsResolutionDropdownOpen] = useState(false);
  const resolutionDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<GeminiModelVersion>('gemini-2.5-pro');

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resolutionDropdownRef.current && !resolutionDropdownRef.current.contains(event.target as Node)) {
        setIsResolutionDropdownOpen(false);
      }
    };

    if (isResolutionDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isResolutionDropdownOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!prompt.trim() || prompt.trim().length < 5) {
      setPromptError('Промпт должен содержать минимум 5 символов');
      return;
    }

    setPromptError(null);
    onGenerate(prompt, htmlTemplate, imageResolution, selectedGeminiModel);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Кнопка для открытия поля HTML шаблона */}
      {!showTemplate && (
        <div>
          <button
            type="button"
            onClick={() => setShowTemplate(true)}
            className="max-w-[400px] px-4 py-4 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium cursor-pointer"
          >
            + Добавить HTML шаблон страницы (опционально)
          </button>
        </div>
      )}
      {/* Поле для HTML шаблона - показывается только если showTemplate === true */}
      {showTemplate && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="html-template" className="block text-sm font-medium text-gray-300">
              HTML шаблон страницы (опционально)
            </label>
            <button
              type="button"
              onClick={() => {
                setShowTemplate(false);
                setHtmlTemplate(''); // Очищаем шаблон при скрытии
              }}
              className="text-gray-400 hover:text-gray-200 transition-colors text-sm cursor-pointer"
              title="Скрыть шаблон"
            >
              ✕
            </button>
          </div>
          <textarea
            id="html-template"
            placeholder="Вставьте HTML шаблон страницы. Если оставить пустым, будет использован базовый шаблон. Используйте [Сюда вставить весь сгенерированный текст] для вставки контента."
            className="w-full border border-gray-700 rounded-lg px-4 py-3 min-h-[200px] bg-(--background-color) text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 custom-scrollbar font-mono text-sm"
            value={htmlTemplate}
            onChange={(e) => setHtmlTemplate(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-400">
            Используйте маркеры: [Сюда вставить весь сгенерированный текст], [Сюда вставить Первый абзац статьи], [Сюда вставить Последний абзац статьи], [Сюда вставить тему]
          </p>
        </div>
      )}

      {/* Выбор версии модели Gemini */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Версия модели Gemini
        </label>
        <GeminiModelSelector
          selectedModel={selectedGeminiModel}
          onModelChange={setSelectedGeminiModel}
          disabled={isStreaming || isParsingPrompts || isGeneratingImages}
        />
      </div>

      {/* Выбор разрешения изображений */}
      <div className="relative inline-block" ref={resolutionDropdownRef}>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Разрешение изображений
        </label>
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setIsResolutionDropdownOpen(!isResolutionDropdownOpen)}
            disabled={isStreaming || isParsingPrompts || isGeneratingImages}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium border border-gray-700 cursor-pointer transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${isResolutionDropdownOpen
              ? 'bg-(--btn-active-color) text-white'
              : 'bg-(--btn-color) text-gray-300 hover:border-(--btn-hover-border)'
              }`}
          >
            {imageResolution.label} ({imageResolution.width}×{imageResolution.height})
          </button>
          {isResolutionDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-(--btn-color) rounded-lg shadow-lg z-50 min-w-[200px]">
              {IMAGE_RESOLUTIONS.map((res) => {
                const isSelected = imageResolution.width === res.width && imageResolution.height === res.height;
                return (
                  <button
                    key={`${res.width}x${res.height}-${res.label}`}
                    type="button"
                    onClick={() => {
                      setImageResolution(res);
                      setIsResolutionDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm text-gray-300 cursor-pointer border border-gray-700 hover:border-(--btn-hover-border) first:rounded-t-lg last:rounded-b-lg transition-colors ${isSelected ? 'bg-(--btn-active-color) text-white' : ''
                      }`}
                  >
                    {res.label} ({res.width}×{res.height})
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Выберите разрешение для сгенерированных изображений
        </p>
      </div>

      {/* Поле для промпта */}
      <div>
        <label htmlFor="article-prompt" className="block text-sm font-medium text-gray-300 mb-2">
          Промпт для генерации статьи *
        </label>
        <textarea
          id="article-prompt"
          placeholder="Введите промпт для генерации SEO статьи..."
          className="w-full border border-gray-700 rounded-lg px-4 py-4 min-h-[250px] bg-(--background-color) text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 custom-scrollbar"
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (promptError) setPromptError(null);
          }}
          maxLength={50000}
          required
        />
        <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
          <span>{prompt.length}/50000</span>
          {promptError && (
            <span className="text-red-400">{promptError}</span>
          )}
        </div>
      </div>

      {/* Кнопка отправки и остановки */}
      <div className="flex justify-end gap-2">
        {/* Кнопка остановки - показывается только во время генерации */}
        {isStreaming && onAbort && (
          <button
            type="button"
            onClick={onAbort}
            className="bg-red-600 hover:bg-red-700 border border-red-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 hover:scale-105 cursor-pointer"
          >
            ⏹ Остановить генерацию
          </button>
        )}
        <button
          type="submit"
          className="bg-(--btn-active-color) disabled:bg-(--btn-color) disabled:cursor-not-allowed border border-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 hover:scale-105 disabled:scale-100 cursor-pointer"
          disabled={!prompt.trim() || prompt.trim().length < 5 || isStreaming || isParsingPrompts || isGeneratingImages}
        >
          {isParsingPrompts
            ? 'Парсинг...'
            : isGeneratingImages
              ? 'Генерация изображений...'
              : isStreaming
                ? 'Генерация...'
                : 'Сгенерировать статью'
          }
        </button>
      </div>
    </form>
  );
}