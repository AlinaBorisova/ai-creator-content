'use client';

import { useState } from 'react';

interface SEOArticleFormProps {
  onGenerate: (prompt: string, htmlTemplate: string) => void;
  isStreaming: boolean;
  isParsingPrompts: boolean;
  isGeneratingImages: boolean;
}

export function SEOArticleForm({
  onGenerate,
  isStreaming,
  isParsingPrompts,
  isGeneratingImages
}: SEOArticleFormProps) {
  const [prompt, setPrompt] = useState('');
  const [htmlTemplate, setHtmlTemplate] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!prompt.trim() || prompt.trim().length < 5) {
      setPromptError('Промпт должен содержать минимум 5 символов');
      return;
    }

    setPromptError(null);
    onGenerate(prompt, htmlTemplate);
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

      {/* Кнопка отправки */}
      <div className="flex justify-end">
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