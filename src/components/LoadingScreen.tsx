"use client";

import { useState, useEffect } from "react";

const LOADING_MESSAGES = [
  "現在のプランを確認中...",
  "お得なプランを検索中...",
  "改善額を計算中...",
];

export default function LoadingScreen() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <p className="text-base font-medium text-gray-500">
          {LOADING_MESSAGES[messageIndex]}
        </p>
      </div>
    </div>
  );
}
