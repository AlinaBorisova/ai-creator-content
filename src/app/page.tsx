'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface User {
  id: string;
  name: string;
  email?: string;
}

export default function HomePage() {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (data.valid) {
        setUser(data.user);
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Сохранить токен в cookies для middleware
        document.cookie = `authToken=${token}; path=/; max-age=31536000; secure; samesite=strict`;
      } else {
        setError(data.error || 'Invalid token');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  if (user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#191919] text-white p-4">
        <div className="bg-gray-800 p-8 rounded-3xl shadow-xl text-center max-w-md w-full">
          <h1 className="text-3xl font-bold mb-4">Welcome, {user.name || 'User'}!</h1>
          <p className="text-gray-400 mb-6">Choose service</p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Link href="/parser">
              <div className="bg-gray-700 p-4 rounded-2xl text-center hover:bg-gray-600 transition-colors">
                <h2 className="text-2xl font-bold">TG Parser</h2>
              </div>
            </Link>
            <Link href="/ai">
              <div className="bg-gray-700 p-4 rounded-2xl text-center hover:bg-gray-600 transition-colors">
                <h2 className="text-2xl font-bold">AI Text</h2>
              </div>
            </Link>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#191919] text-white p-4">
      <div className="bg-gray-800 p-8 rounded-3xl shadow-xl text-center max-w-md w-full">
        <h1 className="text-3xl font-bold mb-6">Enter Access Token</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your token"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-3 rounded-lg transition-colors"
          >
            {isLoading ? 'Verifying...' : 'Login'}
          </button>
        </form>
      </div>
    </main>
  );
}