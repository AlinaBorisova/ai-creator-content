'use client';

import { SessionProvider } from 'next-auth/react';
import React from 'react';

// Создаем компонент-обертку, который принимает дочерние элементы
export default function Providers({ children }: { children: React.ReactNode }) {
  // Оборачиваем дочерние элементы в SessionProvider от NextAuth
  return <SessionProvider>{children}</SessionProvider>;
}
