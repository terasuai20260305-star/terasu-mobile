"use client";

import { useState, useEffect } from "react";

const LOADING_MESSAGES = [
  "現在のプランを確認中...",
  "お得なプランを検索中...",
  "最適な1件を選定中...",
];

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    // プログレスバーを0→100%にアニメーション
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        // 最初は速く、後半はゆっくり
        const increment = prev < 60 ? 4 : prev < 85 ? 2 : 1;
        return Math.min(prev + increment, 100);
      });
    }, 40);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // メッセージをプログレスに連動
    if (progress >= 66) setMessageIndex(2);
    else if (progress >= 33) setMessageIndex(1);
  }, [progress]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-5">
        {/* 📡 パルスアイコン */}
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-blue-100 opacity-75" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <span className="text-3xl">📡</span>
          </div>
        </div>

        {/* メッセージ */}
        <p className="text-base font-medium text-gray-600">
          {LOADING_MESSAGES[messageIndex]}
        </p>

        {/* プログレスバー */}
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
