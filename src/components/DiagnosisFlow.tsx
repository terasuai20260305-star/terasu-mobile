"use client";

import { useState, useCallback } from "react";
import ProgressBar from "./ProgressBar";
import QuestionCard from "./QuestionCard";
import type { DataUsage } from "@/lib/types";

const QUESTIONS = [
  {
    question: "今のキャリアを教えてください",
    options: [
      { label: "ドコモ", value: "ドコモ", icon: "🔴" },
      { label: "au", value: "au", icon: "🟠" },
      { label: "ソフトバンク", value: "ソフトバンク", icon: "🔵" },
      { label: "楽天モバイル", value: "楽天モバイル", icon: "🦅" },
      { label: "格安SIM（MVNO）", value: "格安SIM（MVNO）", icon: "💡" },
      { label: "わからない", value: "わからない", icon: "🤷" },
    ],
  },
  {
    question: "月のデータ使用量はだいたいどのくらいですか？",
    subtitle: "だいたいで大丈夫です",
    options: [
      { label: "〜3GB（軽め）", value: "light" },
      { label: "3〜20GB（普通）", value: "medium" },
      { label: "20GB以上（ヘビー）", value: "heavy" },
      { label: "わからない", value: "unknown" },
    ],
  },
  {
    question: "家族割やセット割は使っていますか？",
    subtitle: "ドコモ光・auひかり等との組み合わせ割も含みます",
    options: [
      { label: "はい", value: "yes" },
      { label: "いいえ", value: "no" },
      { label: "わからない", value: "unknown" },
    ],
  },
] as const;

interface DiagnosisFlowProps {
  onComplete: (answers: {
    current_carrier: string;
    data_usage: DataUsage;
    has_family_discount: boolean | null;
  }) => void;
}

export default function DiagnosisFlow({ onComplete }: DiagnosisFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"enter" | "exit" | "exit-back" | "idle">("enter");
  const [answers, setAnswers] = useState<string[]>([]);

  const handleSelect = useCallback(
    (value: string) => {
      const newAnswers = [...answers, value];
      setAnswers(newAnswers);

      if (currentStep < QUESTIONS.length - 1) {
        setSlideDirection("exit");
        setTimeout(() => {
          setCurrentStep((prev) => prev + 1);
          setSlideDirection("enter");
        }, 300);
      } else {
        const familyValue = newAnswers[2];
        onComplete({
          current_carrier: newAnswers[0],
          data_usage: newAnswers[1] as DataUsage,
          has_family_discount:
            familyValue === "yes"
              ? true
              : familyValue === "no"
                ? false
                : null,
        });
      }
    },
    [answers, currentStep, onComplete]
  );

  const handleBack = useCallback(() => {
    if (currentStep <= 0) return;
    setSlideDirection("exit-back");
    setTimeout(() => {
      setAnswers((prev) => prev.slice(0, -1));
      setCurrentStep((prev) => prev - 1);
      setSlideDirection("enter");
    }, 300);
  }, [currentStep]);

  const q = QUESTIONS[currentStep];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50">
      <ProgressBar
        current={currentStep + 1}
        total={QUESTIONS.length}
        onBack={currentStep > 0 ? handleBack : undefined}
      />

      <div className="relative flex flex-1 items-start justify-center overflow-hidden px-4 pt-4 pb-6">
        <div
          className={`w-full max-w-sm transition-all duration-300 ease-out ${
            slideDirection === "exit"
              ? "-translate-x-full opacity-0"
              : slideDirection === "exit-back"
                ? "translate-x-full opacity-0"
                : slideDirection === "enter"
                  ? "translate-x-0 opacity-100"
                  : ""
          }`}
          onTransitionEnd={() => {
            if (slideDirection === "enter") setSlideDirection("idle");
          }}
        >
          <QuestionCard
            key={currentStep}
            questionNumber={currentStep + 1}
            question={q.question}
            subtitle={"subtitle" in q ? q.subtitle : undefined}
            options={[...q.options]}
            onSelect={handleSelect}
          />
        </div>
      </div>
    </div>
  );
}
