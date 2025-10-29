import Link from 'next/link';

export function AccessDeniedScreen() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-(--background-color) text-white">
      <div className="bg-(--background-color) p-8 rounded-3xl shadow-xl text-center max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Доступ запрещен</h1>
        <p className="text-gray-400 mb-6">Для доступа к этой странице необходимо авторизоваться.</p>
        <Link href="/" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
          Перейти на страницу входа
        </Link>
      </div>
    </main>
  );
}