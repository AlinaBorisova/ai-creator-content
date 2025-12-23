import { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email?: string;
}

// Функция для получения токена из cookie
function getTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'authToken' && value) {
      return value;
    }
  }
  return null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken') || getTokenFromCookie();

      if (token) {
        // Если токен был получен из cookie, сохраняем его в localStorage
        if (!localStorage.getItem('authToken')) {
          localStorage.setItem('authToken', token);
        }

        try {
          const response = await fetch('/api/auth/verify', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ token }),
						credentials: 'include', // Важно для работы с cookies
					});

          // Проверяем статус ответа
          if (!response.ok) {
						// Если ошибка квоты БД (503), не очищаем токен - это временная проблема
						if (response.status === 503) {
							console.warn('Database quota exceeded, but keeping token in cache');
							// Можно попробовать использовать кэшированные данные пользователя
							const cachedUser = localStorage.getItem('user');
							if (cachedUser) {
								try {
									setUser(JSON.parse(cachedUser));
								} catch {
									// Игнорируем ошибку парсинга
								}
							}
							setLoading(false);
							return;
						}

						// Для других ошибок (401, 500) очищаем токен
						localStorage.removeItem('authToken');
						localStorage.removeItem('user');
						setLoading(false);
						return;
					}

          const data = await response.json();
					if (data.valid) {
						setUser(data.user);
						// Обновляем кэш пользователя в localStorage
						localStorage.setItem('user', JSON.stringify(data.user));
					} else {
						// Токен недействителен, очищаем localStorage
						localStorage.removeItem('authToken');
						localStorage.removeItem('user');
					}
        } catch (error) {
					console.error('Auth check failed:', error);
					// При сетевых ошибках не очищаем токен - это может быть временная проблема
					// Используем кэшированные данные, если они есть
					const cachedUser = localStorage.getItem('user');
					if (cachedUser) {
						try {
							setUser(JSON.parse(cachedUser));
						} catch {
							// Если не удалось распарсить, очищаем все
							localStorage.removeItem('authToken');
							localStorage.removeItem('user');
						}
					} else {
						localStorage.removeItem('authToken');
						localStorage.removeItem('user');
					}
				}
			}
			setLoading(false);
    };

    checkAuth();
  }, []);

  const logout = () => {
		setUser(null);
		localStorage.removeItem('authToken');
		localStorage.removeItem('user');
		document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
	};

  return { user, loading, logout };
};