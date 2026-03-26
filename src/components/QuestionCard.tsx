"use client";

import { useState } from "react";

interface QuestionCardProps {
  questionNumber: number;
  question: string;
  subtitle?: string;
  options: { label: string; value: string; icon?: string }[];
  onSelect: (value: string) => void;
}

export default function QuestionCard({
  questionNumber,
  question,
  subtitle,
  options,
  onSelect,
}: QuestionCardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleClick = (value: string) => {
    if (selected) return;
    setSelected(value);
    setTimeout(() => {
      onSelect(value);
    }, 300);
  };

  return (
    <div className="w-full rounded-2xl bg-white p-5 shadow-lg">
      {/* Qバッジ */}
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          Q{questionNumber}
        </span>
      </div>

      <h2 className="text-lg font-bold text-gray-900">
        {question}
      </h2>

      {subtitle && (
        <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
      )}

      <div className="mt-4 flex w-full flex-col gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleClick(option.value)}
            disabled={selected !== null}
            className={`flex w-full items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-base font-medium transition-all duration-200 ${
              selected === option.value
                ? "border-blue-600 bg-blue-600 text-white shadow-md"
                : selected !== null
                  ? "border-gray-100 bg-gray-50 text-gray-300"
                  : "border-gray-200 bg-white text-gray-800 active:scale-[0.98] sm:hover:border-blue-400 sm:hover:bg-blue-50"
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
