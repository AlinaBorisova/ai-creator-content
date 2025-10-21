import Link from 'next/link';

export function AccessDeniedScreen() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 p-8 rounded-3xl shadow-xl text-center max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-gray-400 mb-6">You need to be authorized to access this page.</p>
        <Link href="/" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
          Go to Login
        </Link>
      </div>
    </main>
  );
}