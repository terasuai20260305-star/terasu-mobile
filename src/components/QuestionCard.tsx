"use client";

import { useState } from "react";

interface QuestionCardProps {
  question: string;
  subtitle?: string;
  options: { label: string; value: string; icon?: string }[];
  onSelect: (value: string) => void;
}

export default function QuestionCard({
  question,
  subtitle,
  options,
  onSelect,
}: QuestionCardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleClick = (value: string) => {
    setSelected(value);
    setTimeout(() => {
      onSelect(value);
    }, 200);
  };

  return (
    <div className="flex w-full flex-col items-center px-2">
      <h2 className="text-center text-xl font-bold text-gray-900 sm:text-2xl">
        {question}
      </h2>

      {subtitle && (
        <p className="mt-1.5 text-center text-xs text-gray-400">{subtitle}</p>
      )}

      <div className="mt-4 flex w-full max-w-sm flex-col gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleClick(option.value)}
            className={`flex w-full items-center gap-2.5 rounded-lg border px-4 py-2 text-left text-base font-medium transition-all ${
              selected === option.value
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-200 bg-white text-gray-800 sm:hover:border-blue-400 sm:hover:bg-blue-50"
            }`}
          >
            {option.icon && (
              <span className="shrink-0 text-base">{option.icon}</span>
            )}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
