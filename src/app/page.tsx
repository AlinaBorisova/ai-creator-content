'use client';

import Link from 'next/link';

export default function HomePage() {
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-8 rounded-3xl shadow-xl text-center max-w-md w-full">
        <h1 className="text-5xl font-bold mb-8">Choose service</h1>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/parser">
            <div className="bg-gray-700 p-4 rounded-2xl text-center">
              <h2 className="text-2xl font-bold">TG Parser</h2>
            </div>
          </Link>
          <Link href="/ai">
            <div className="bg-gray-700 p-4 rounded-2xl text-center">
              <h2 className="text-2xl font-bold">AI Text</h2>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
