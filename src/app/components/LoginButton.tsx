// src/app/components/LoginButton.tsx

// 'use client';
//
// import { signIn } from 'next-auth/react';
//
// export default function LoginButton() {
//   return (
//     <button
//       // При клике вызываем signIn и указываем наш OAuth провайдер 'telegram'
//       // Это перенаправит пользователя на страницу входа Telegram
//       onClick={() => signIn('telegram', { callbackUrl: '/' })}
//       className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105"
//     >
//       Войти через Telegram
//     </button>
//   );
// }
