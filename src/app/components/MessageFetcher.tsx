// src/app/components/MessageFetcher.tsx

"use client";

import { useState } from 'react';
import { TelegramMessage } from '@/lib/telegram';
import { AiAnalysisResult } from '@/lib/yandex';
import { fetchChannelMessagesAction, analyzePostAction } from '@/app/actions';

function AiAnalysisDisplay({ analysis }: { analysis: AiAnalysisResult }) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="mt-4 pt-4 border-t-2 border-dashed border-purple-400/30 space-y-4 animate-fade-in">
      <div>
        <h4 className="text-sm font-bold text-purple-400 mb-2">💡 Рерайт текста:</h4>
        <p className="text-gray-300 text-sm bg-gray-900 p-3 rounded-md whitespace-pre-wrap">{analysis.rewrittenText}</p>
      </div>
      <div>
        <h4 className="text-sm font-bold text-purple-400 mb-2">🎨 Промпт для изображения (Eng):</h4>
        <div className="relative">
          <p className="text-gray-400 text-xs bg-gray-900 p-3 rounded-md font-mono pr-10">{analysis.imagePrompt}</p>
          <button
            onClick={() => copyToClipboard(analysis.imagePrompt)}
            className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors"
            title="Копировать промпт"
          >
            📋
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageCard({ message, isTopPost, onAnalyze, isAnalyzing, analysis }: {
  message: TelegramMessage,
  isTopPost: boolean,
  onAnalyze: (text: string) => void,
  isAnalyzing: boolean,
  analysis?: AiAnalysisResult
}) {
  const cardClasses = `border bg-gray-800 rounded-lg p-4 transition-all duration-300 ${isTopPost ? 'border-amber-400 shadow-lg shadow-amber-500/10' : 'border-gray-700'}`;

  return (
    <div className={cardClasses}>
      <p className="text-gray-300 text-sm whitespace-pre-wrap">{message.text}</p>

      {message.reactions.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-4 pt-3 border-t border-gray-700">
          {message.reactions.map(r => <div key={r.emoji} className="flex items-center gap-1 bg-gray-700/50 rounded-full px-2 py-0.5 text-xs"><span>{r.emoji}</span><span className="font-medium text-gray-300">{r.count}</span></div>)}
          <div className="flex items-center gap-1 text-amber-400 rounded-full px-2 py-0.5 text-xs font-bold ml-auto"><span>🏆</span><span>{message.totalReactions}</span></div>
        </div>
      )}

      {isTopPost && !analysis && (
        <div className="mt-4 pt-4 border-t border-dashed border-gray-700 text-center">
          <button
            onClick={() => onAnalyze(message.text)}
            disabled={isAnalyzing}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-2 px-5 rounded-md transition-colors text-sm"
          >
            {isAnalyzing ? 'Анализ...' : '✨ Улучшить с помощью AI'}
          </button>
        </div>
      )}

      {isAnalyzing && <div className="text-center mt-4 text-purple-400 text-sm">Нейросеть думает...</div>}
      {analysis && <AiAnalysisDisplay analysis={analysis} />}

      <p className="text-right text-xs text-gray-500 mt-2">{new Date(message.date * 1000).toLocaleString()}</p>
    </div>
  );
}

export function MessageFetcher() {
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analyzingPostId, setAnalyzingPostId] = useState<number | null>(null);
  const [aiResults, setAiResults] = useState<Record<number, AiAnalysisResult>>({});

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessages([]);
    setAiResults({});
    setAnalyzingPostId(null);

    const formData = new FormData(event.currentTarget);
    const result = await fetchChannelMessagesAction(formData);

    if (result.error) {
      setError(result.error);
    } else {
      const sortedMessages = result.messages.sort((a, b) => b.totalReactions - a.totalReactions);
      setMessages(sortedMessages);
    }
    setIsLoading(false);
  };

  const handleAnalyze = async (postId: number, text: string) => {
    setAnalyzingPostId(postId);
    const result = await analyzePostAction(text);
    if (result.error) {
      alert(`Ошибка AI: ${result.error}`);
    } else if (result.analysis) {
      setAiResults(prev => ({ ...prev, [postId]: result.analysis! }));
    }
    setAnalyzingPostId(null);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 mb-8">
        <input type="text" name="channelUsername" placeholder="Введите @username или ID канала" required className="flex-grow bg-gray-800 border border-gray-700 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-colors">{isLoading ? 'Загрузка...' : 'Получить сообщения'}</button>
      </form>

      {error && <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg text-center">{error}</div>}
      {!error && isLoading && <div className="text-center text-gray-400">Идет загрузка...</div>}

      <div className="space-y-4 mt-4">
        {messages.map((msg, index) => {
          // Пост считается топовым, если он в топ-3 (индекс 0, 1 или 2)
          // и у него есть хоть одна реакция.
          const isTopPost = index < 3 && msg.totalReactions > 0;

          return (
            <MessageCard
              key={msg.id}
              message={msg}
              isTopPost={isTopPost}
              onAnalyze={() => handleAnalyze(msg.id, msg.text)}
              isAnalyzing={analyzingPostId === msg.id}
              analysis={aiResults[msg.id]}
            />
          );
        })}
      </div>
    </div>
  );
}
