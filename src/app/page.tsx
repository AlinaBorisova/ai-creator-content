import { MessageFetcher } from "@/app/components/MessageFetcher";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-center">TG Parser</h1>
          <p className="text-center text-gray-400 mt-2">
            Анализ и улучшение постов из Telegram-канала за последнюю неделю
          </p>
        </header>

        {/* Вставляем наш новый интерактивный компонент */}
        <MessageFetcher />

      </div>
    </main>
  );
}
