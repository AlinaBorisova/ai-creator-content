interface ChannelInputsProps {
  sourceChannelId: string;
  destinationChannelId: string;
  onSourceChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isFetching: boolean;
  error: string | null;
  postsCount: number; // Добавим для проверки количества постов
}

export function ChannelInputs({ 
  sourceChannelId,
  destinationChannelId,
  onSourceChange,
  onDestinationChange,
  onSubmit,
  isFetching,
  error,
  postsCount
}: ChannelInputsProps) {
  return (
    <div>
      {/* Форма с полями ввода каналов */}
      <form onSubmit={onSubmit} className="mb-8 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={sourceChannelId}
            onChange={(e) => onSourceChange(e.target.value)}
            placeholder="ID канала-источника (откуда читать)"
            required
            className="flex-grow bg-gray-800 border border-gray-700 rounded-lg px-4 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={destinationChannelId}
            onChange={(e) => onDestinationChange(e.target.value)}
            placeholder="ID канала-назначения (куда постить)"
            required
            className="flex-grow bg-gray-800 border border-gray-700 rounded-lg px-4 py-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <button
          type="submit"
          disabled={isFetching}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-4 rounded-lg transition-colors cursor-pointer"
        >
          {isFetching && postsCount === 0 ? 'Загрузка...' : 'Получить посты'}
        </button>
      </form>

      {/* Отображение ошибок или статуса загрузки */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-2xl text-center">
          {error}
        </div>
      )}
      {isFetching && postsCount === 0 && (
        <div className="text-center text-gray-400">Идет загрузка...</div>
      )}
    </div>
  );
}