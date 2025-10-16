import { useState, useEffect } from 'react';

interface User {
	id: string;
	name: string;
	email?: string;
}

export const useAuth = () => {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const checkAuth = async () => {
			const token = localStorage.getItem('authToken');
			if (token) {
				try {
					const response = await fetch('/api/auth/verify', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ token })
					});
					const data = await response.json();
					if (data.valid) {
						setUser(data.user);
					} else {
						// Токен недействителен, очищаем localStorage
						localStorage.removeItem('authToken');
						localStorage.removeItem('user');
					}
				} catch (error) {
					console.error('Auth check failed:', error);
					localStorage.removeItem('authToken');
					localStorage.removeItem('user');
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