"use client";

import { useState } from 'react';
import { TelegramMessage } from '@/lib/telegram';
import { fetchChannelMessagesAction } from '@/app/actions';

// --- ИЗМЕНЕНИЕ 1: Улучшаем карточку сообщения ---
function MessageCard({ message, isTopPost }: { message: TelegramMessage, isTopPost: boolean }) {
  // Динамически добавляем классы для выделения топ-постов
  const cardClasses = `
    border bg-gray-800 rounded-lg p-4 animate-fade-in transition-all duration-300
    ${isTopPost ? 'border-amber-400 shadow-lg shadow-amber-500/10' : 'border-gray-700'}
  `;

  return (
    <div className={cardClasses}>
      <p className="text-gray-300 text-sm whitespace-pre-wrap">{message.text}</p>

      {/* Блок для отображения реакций */}
      {message.reactions.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-4 pt-3 border-t border-gray-700">
          {message.reactions.map(reaction => (
            <div key={reaction.emoji} className="flex items-center gap-1 bg-gray-700/50 rounded-full px-2 py-0.5 text-xs">
              <span>{reaction.emoji}</span>
              <span className="font-medium text-gray-300">{reaction.count}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 text-amber-400 rounded-full px-2 py-0.5 text-xs font-bold ml-auto">
            <span>🏆</span>
            <span>{message.totalReactions}</span>
          </div>
        </div>
      )}

      <p className="text-right text-xs text-gray-500 mt-2">
        {new Date(message.date * 1000).toLocaleString()}
      </p>
    </div>
  );
}

export function MessageFetcher() {
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessages([]);

    const formData = new FormData(event.currentTarget);
    const result = await fetchChannelMessagesAction(formData);

    if (result.error) {
      setError(result.error);
    } else {
      // --- ИЗМЕНЕНИЕ 2: Сортируем сообщения перед отображением ---
      const sortedMessages = result.messages.sort((a, b) => b.totalReactions - a.totalReactions);
      setMessages(sortedMessages);
    }

    setIsLoading(false);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 mb-8">
        <input
          type="text"
          name="channelUsername"
          placeholder="Введите @username или ID канала"
          required
          className="flex-grow bg-gray-800 border border-gray-700 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          {isLoading ? 'Загрузка...' : 'Получить сообщения'}
        </button>
      </form>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg text-center">
          {error}
        </div>
      )}

      {!error && isLoading && (
        <div className="text-center text-gray-400">Идет загрузка...</div>
      )}

      {/* ИЗМЕНЕНИЕ 2 */}
      {!error && !isLoading && messages.length === 0 && (
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg text-center text-gray-400">
          Введите username (например, `durov_russia`) или ID канала (например, `-1001234567890`) и нажмите "Получить сообщения".
        </div>
      )}

      <div className="space-y-4 mt-4">
        {/* --- ИЗМЕНЕНИЕ 3: Передаем флаг isTopPost в карточку --- */}
        {messages.map((msg, index) => {
          // Пост считается топовым, если он в топ-3 И у него есть хоть одна реакция
          const isTopPost = index < 3 && msg.totalReactions > 0;
          return <MessageCard key={msg.id} message={msg} isTopPost={isTopPost} />;
        })}
      </div>
    </div>
  );
}

