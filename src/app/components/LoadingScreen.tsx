export function LoadingScreen() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p>Checking authorization...</p>
      </div>
    </main>
  );
}