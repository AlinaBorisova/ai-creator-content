interface HistoryButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function HistoryButton({ isOpen, onToggle }: HistoryButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-[50px] h-[50px] top-0 left-0 bg-(--btn-color) hover:border-(--btn-hover-border) border border-gray-700 text-gray-300 p-3 rounded-lg shadow-lg cursor-pointer transition-all duration-300 hover:scale-105 ${isOpen ? 'hidden' : 'block'
        }`}
      title="История запросов"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
}