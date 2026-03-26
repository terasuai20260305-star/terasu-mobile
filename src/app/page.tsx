"use client";

import { useState, useCallback } from "react";
import Landing from "@/components/Landing";
import DiagnosisFlow from "@/components/DiagnosisFlow";
import LoadingScreen from "@/components/LoadingScreen";
import ResultScreen from "@/components/ResultScreen";
import { recommend } from "@/lib/recommend";
import type { DiagnosisInput, RecommendResult } from "@/lib/types";

type Phase = "landing" | "diagnosis" | "loading" | "result";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [lastInput, setLastInput] = useState<DiagnosisInput | null>(null);

  const handleStart = useCallback(() => {
    setPhase("diagnosis");
  }, []);

  const handleDiagnosisComplete = useCallback((input: DiagnosisInput) => {
    setLastInput(input);
    setPhase("loading");

    setTimeout(() => {
      const recommendation = recommend(input);
      setResult(recommendation);
      setPhase("result");
    }, 2000);
  }, []);

  const handleRetry = useCallback(() => {
    setResult(null);
    setLastInput(null);
    setPhase("diagnosis");
  }, []);

  return (
    <main className="min-h-[100dvh] bg-[#f8f9fa]">
      {phase === "landing" && <Landing onStart={handleStart} />}
      {phase === "diagnosis" && (
        <DiagnosisFlow onComplete={handleDiagnosisComplete} />
      )}
      {phase === "loading" && <LoadingScreen />}
      {phase === "result" && result && lastInput && (
        <ResultScreen result={result} input={lastInput} onRetry={handleRetry} />
      )}
    </main>
  );
}
