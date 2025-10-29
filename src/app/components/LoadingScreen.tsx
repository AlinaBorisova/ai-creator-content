import { SpinnerIcon } from './Icons';

export function LoadingScreen() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-(--background-color) text-white">
      <div className="text-center">
        <div className="animate-spin text-4xl mb-4">
          <SpinnerIcon className="w-12 h-12 mx-auto text-blue-400" />
        </div>
        <p>Проверка авторизации...</p>
      </div>
    </main>
  );
}