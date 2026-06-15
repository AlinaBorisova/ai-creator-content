'use client';

import { useState, useRef, useEffect } from 'react';

export type GeminiModelVersion = 'gemini-2.5-pro' | 'gemini-2.5-flash';

interface GeminiModelSelectorProps {
  selectedModel: GeminiModelVersion;
  onModelChange: (model: GeminiModelVersion) => void;
  disabled?: boolean;
}

export function GeminiModelSelector({
  selectedModel,
  onModelChange,
  disabled = false
}: GeminiModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const models: { value: GeminiModelVersion; label: string; description: string }[] = [
    {
      value: 'gemini-2.5-pro',
      label: 'Gemini 2.5 Pro',
      description: 'Думающая и стабильная модель'
    },
    {
      value: 'gemini-2.5-flash',
      label: 'Gemini 2.5 Flash',
      description: 'Самая быстрая модель'
    }
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedModelData = models.find(m => m.value === selectedModel) || models[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center justify-between gap-2 px-4 py-2 rounded-lg font-medium border border-gray-700 cursor-pointer transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-[180px] ${isOpen
          ? 'bg-(--btn-active-color) text-white'
          : 'bg-(--btn-color) text-gray-300 hover:border-(--btn-hover-border)'
          }`}
        title={selectedModelData.description}
      >
        <span>{selectedModelData.label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-1 bg-(--btn-color) border border-gray-700 rounded-lg shadow-lg z-50 min-w-[180px]">
          {models.map((model) => {
            const isSelected = selectedModel === model.value;
            return (
            <button
              key={model.value}
              type="button"
              onClick={() => {
                onModelChange(model.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm text-gray-300 cursor-pointer border border-gray-700 hover:border-(--btn-hover-border) first:rounded-t-lg last:rounded-b-lg transition-colors ${isSelected
                ? 'bg-(--btn-active-color) text-white'
                : ''
              }`}
            >
              <div className="font-medium">{model.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{model.description}</div>
            </button>
          );
        })}
        </div>
      )}
    </div>
  );
}