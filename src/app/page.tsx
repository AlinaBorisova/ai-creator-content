// src/app/page.tsx

'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';

// Определяем тип для данных, которые мы получаем от нашего API
interface ResultData {
  originalText: string;
  rewrittenText: string;
  imagePrompt: string;
  imageUrl: string;
}

export default function HomePage() {
  // Состояния компонента
  const [postUrl, setPostUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Обработчик отправки формы
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!postUrl.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Произошла неизвестная ошибка');
      }

      const data: ResultData = await response.json();
      setResult(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Произошла непредвиденная ошибка');
      }
    } finally {
      setLoading(false);
    }
  };

  // Функция для копирования промта в буфер обмена
  const handleCopyPrompt = () => {
    if (!result?.imagePrompt) return;
    navigator.clipboard.writeText(result.imagePrompt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-900 text-white p-4 sm:p-8">
      <div className="w-full max-w-4xl">
        {/* --- ЗАГОЛОВОК --- */}
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            AI Content Generator
          </h1>
          <p className="text-red-400 mt-2">
            Вставьте ссылку на пост из Telegram и получите готовый контент для соцсетей.
          </p>
        </header>

        {/* --- ФОРМА ВВОДА --- */}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-xl mx-auto">
          <input
            type="url"
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="https://t.me/channel/123"
            className="flex-grow bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-3 transition-colors duration-300"
          >
            {loading ? 'Генерация...' : 'Сгенерировать'}
          </button>
        </form>

        {/* --- СЕКЦИЯ РЕЗУЛЬТАТОВ, ОШИБОК И ЗАГРУЗКИ --- */}
        <div className="mt-10 w-full">
          {loading && (
            <div className="flex justify-center items-center gap-3 text-lg text-gray-300">
              <svg className="animate-spin h-6 w-6 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Анализирую, переписываю, рисую...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg p-4 max-w-xl mx-auto text-center">
              <h3 className="font-bold mb-2">Ошибка!</h3>
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
              {/* Левая колонка: Тексты */}
              <div className="flex flex-col gap-8">
                {/* Блок с рерайтом */}
                <div className="bg-gray-800/50 p-5 rounded-lg border border-gray-700">
                  <h3 className="text-xl font-semibold mb-3 text-indigo-400">Готовый пост:</h3>
                  <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{result.rewrittenText}</p>
                </div>

                {/* Блок с промтом */}
                <div className="bg-gray-800/50 p-5 rounded-lg border border-gray-700">
                  <h3 className="text-xl font-semibold mb-3 text-indigo-400">Промт для изображения:</h3>
                  <div className="relative">
                    <p className="text-gray-300 bg-gray-900 p-3 rounded-md font-mono text-sm pr-16">
                      {result.imagePrompt}
                    </p>
                    <button onClick={handleCopyPrompt} className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-xs px-2 py-1 rounded transition-colors">
                      {isCopied ? '✅ Скопировано!' : 'Копировать'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Правая колонка: Изображение */}
              <div className="bg-gray-800/50 p-5 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold mb-3 text-indigo-400">Сгенерированное изображение:</h3>
                <div className="aspect-square w-full bg-gray-900 rounded-lg overflow-hidden">
                  <Image
                    src={result.imageUrl}
                    alt="Сгенерированное изображение"
                    width={512}
                    height={512}
                    className="w-full h-full object-cover"
                    priority
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
