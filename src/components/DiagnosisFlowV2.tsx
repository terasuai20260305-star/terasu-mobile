"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { RecommendAnswers } from "@/lib/recommend-v2-types";

/* ═══════════════════════════════════════════════════════════
   質問定義
   ═══════════════════════════════════════════════════════════ */

interface QOption {
  label: string;
  value: string;
  hint?: string;
}

interface QDef {
  key: keyof RecommendAnswers;
  question: string;
  subtitle?: string;
  multi?: boolean;
  options: QOption[];
  summaryLabel: string;
  /** 表示条件（false → 非表示＆スキップ） */
  showWhen?: (answers: Record<string, string | string[]>) => boolean;
}

const QUESTIONS: QDef[] = [
  /* ── Q1: 今使っている会社 ── */
  {
    key: "q1",
    question: "今使っている会社にいちばん近いものは？",
    summaryLabel: "今の会社",
    options: [
      { label: "ドコモ・au・ソフトバンクの本体", value: "大手キャリア本体", hint: "大手3社" },
      { label: "ahamo・povo・LINEMO・UQ・Y!mobile・楽天 など", value: "大手系サブブランド", hint: "料金を抑えやすい大手系" },
      { label: "IIJmio・mineo・NUROモバイル などの格安SIM", value: "格安SIM", hint: "MVNO" },
      { label: "わからない", value: "わからない" },
    ],
  },
  /* ── Q2: プラン名わかる？ ── */
  {
    key: "q2",
    question: "今のプラン名はわかる？",
    subtitle: "わからなくても大丈夫です",
    summaryLabel: "プラン名",
    options: [
      { label: "わかる", value: "わかる" },
      { label: "だいたいわかる", value: "だいたいわかる" },
      { label: "わからない", value: "わからない" },
    ],
  },
  /* ── Q3: 今の使い方（Q2≠わかる のとき表示） ── */
  {
    key: "q3",
    question: "今の使い方にいちばん近いのは？",
    subtitle: "ギガの目安も参考にしてください",
    summaryLabel: "今の使い方",
    showWhen: (ans) => ans.q2 !== "わかる",
    options: [
      { label: "連絡、地図、たまの検索くらい", value: "連絡、地図、たまの検索くらい（〜3GBくらい）", hint: "〜3GB" },
      { label: "SNSやネットをよく見る", value: "SNSやネットをよく見る（〜10GBくらい）", hint: "〜10GB" },
      { label: "動画をたまに見る", value: "動画をたまに見る（20GB前後）", hint: "20GB前後" },
      { label: "動画やSNSをかなり使う", value: "動画やSNSをかなり使う（30GB前後）", hint: "30GB前後" },
      { label: "容量を気にせず使いたい", value: "容量を気にせず使いたい（無制限向け）", hint: "無制限" },
      { label: "わからない", value: "わからない" },
    ],
  },
  /* ── Q4: 今のスマホ代 ── */
  {
    key: "q4",
    question: "今のスマホ代は月いくらくらい？",
    subtitle: "端末代を除いた通信費の目安でOK",
    summaryLabel: "月額の目安",
    options: [
      { label: "2,000円未満", value: "2000未満" },
      { label: "2,000〜3,500円くらい", value: "2000-3500" },
      { label: "3,500〜5,000円くらい", value: "3500-5000" },
      { label: "5,000〜7,000円くらい", value: "5000-7000" },
      { label: "7,000円以上", value: "7000以上" },
      { label: "わからない", value: "わからない" },
    ],
  },
  /* ── Q5: 電話の使い方 ── */
  {
    key: "q5",
    question: "電話はどれくらい使う？",
    subtitle: "通話オプションの参考にします",
    summaryLabel: "通話",
    options: [
      { label: "ほとんどしない", value: "ほとんどしない" },
      { label: "短い電話がたまにある", value: "短い電話がたまにある" },
      { label: "5分かけ放題があると安心", value: "5分かけ放題があると安心" },
      { label: "10分かけ放題がほしい", value: "10分かけ放題がほしい" },
      { label: "かけ放題がほしい", value: "かけ放題がほしい" },
      { label: "わからない", value: "わからない" },
    ],
  },
  /* ── Q6: これから使いたい量 ── */
  {
    key: "q6",
    question: "これから使いたい量はどれに近い？",
    subtitle: "外出先での利用量のイメージで選んでください",
    summaryLabel: "希望容量",
    options: [
      { label: "〜3GBくらい", value: "〜3GBくらい", hint: "連絡・検索中心" },
      { label: "〜10GBくらい", value: "〜10GBくらい", hint: "SNS・ネット中心" },
      { label: "20GB前後", value: "20GB前後", hint: "動画もたまに" },
      { label: "30GB前後", value: "30GB前後", hint: "動画やSNS多め" },
      { label: "無制限向け", value: "無制限向け", hint: "容量を気にしない" },
      { label: "わからない", value: "わからない" },
    ],
  },
  /* ── Q7: 昼の速度 ── */
  {
    key: "q7",
    question: "昼に少し遅くなっても大丈夫？",
    subtitle: "格安SIMは昼休みに遅くなることがあります",
    summaryLabel: "昼の速度",
    options: [
      { label: "できれば避けたい", value: "できれば避けたい" },
      { label: "少し遅くなるくらいなら大丈夫", value: "少し遅くなるくらいなら大丈夫" },
      { label: "安くなるなら気にしない", value: "安くなるなら気にしない" },
      { label: "わからない", value: "わからない" },
    ],
  },
  /* ── Q8: 番号そのまま ── */
  {
    key: "q8",
    question: "今の番号はそのまま使いたい？",
    summaryLabel: "番号そのまま",
    options: [
      { label: "はい", value: "はい" },
      { label: "どちらでもいい", value: "どちらでもいい" },
      { label: "わからない", value: "わからない" },
    ],
  },
  /* ── Q9: 家族割・セット割 ── */
  {
    key: "q9",
    question: "家族割・セット割が使えそう？",
    subtitle: "すでに使っている or まとめられそうなものを選んでください",
    summaryLabel: "割引",
    multi: true,
    options: [
      { label: "家族がすでに同じ会社を使っている", value: "家族がすでに同じ会社を使っている" },
      { label: "家族で同じ会社にまとめられそう", value: "家族で同じ会社にまとめられそう" },
      { label: "家のネットをすでに使っている", value: "家のネットをすでに使っている" },
      { label: "家のネットをまとめられそう", value: "家のネットをまとめられそう" },
      { label: "電気などをすでに使っている", value: "電気などをすでに使っている" },
      { label: "電気などをまとめられそう", value: "電気などをまとめられそう" },
      { label: "使えなさそう", value: "使えなさそう" },
      { label: "わからない", value: "わからない" },
    ],
  },
  /* ── Q10: 経済圏 ── */
  {
    key: "q10",
    question: "よく使うものを選んでね",
    subtitle: "あてはまるものをすべて選んでください",
    summaryLabel: "よく使うもの",
    multi: true,
    options: [
      { label: "楽天カードや楽天サービス", value: "楽天カードや楽天サービスをよく使う" },
      { label: "PayPayやYahoo!サービス", value: "PayPayやYahoo!サービスをよく使う" },
      { label: "三井住友カード / Olive", value: "三井住友カード / Olive を使っている" },
      { label: "U-NEXT", value: "U-NEXTを使っている" },
      { label: "イオンカードやWAON", value: "イオンカードやWAONをよく使う" },
      { label: "J:COMのサービス", value: "J:COMのサービスを使っている" },
      { label: "九州電力やBBIQ", value: "九州電力やBBIQを使っている" },
      { label: "特にない", value: "特にない" },
    ],
  },
  /* ── Q11: 光回線の種別（任意／Q9で「家のネット」を選んだときのみ） ── */
  {
    key: "q11",
    question: "家で使っている光回線は？",
    subtitle: "光セット割の適用可能性を正しく案内するために使います",
    summaryLabel: "光回線",
    showWhen: (ans) => {
      const q9 = ans.q9;
      if (!Array.isArray(q9)) return false;
      return q9.some(
        (v) => v === "家のネットをすでに使っている" || v === "家のネットをまとめられそう"
      );
    },
    options: [
      { label: "ドコモ光", value: "docomo_hikari" },
      { label: "SoftBank 光 / SoftBank Air", value: "softbank_hikari" },
      { label: "auひかり", value: "au_hikari" },
      { label: "J:COM", value: "jcom" },
      { label: "BB.excite光", value: "bb_excite_hikari" },
      { label: "その他の光回線", value: "other" },
      { label: "まだ決めていない / なし", value: "none" },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   ヘルパー
   ═══════════════════════════════════════════════════════════ */

function isQuestionVisible(
  qdef: QDef,
  answers: Record<string, string | string[]>
): boolean {
  if (!qdef.showWhen) return true;
  return qdef.showWhen(answers);
}

function findNextUnanswered(
  current: number,
  answersMap: Record<string, string | string[]>
): number | null {
  for (let i = current + 1; i < QUESTIONS.length; i++) {
    if (!isQuestionVisible(QUESTIONS[i], answersMap)) continue;
    if (!(QUESTIONS[i].key in answersMap)) return i;
  }
  for (let i = 0; i < current; i++) {
    if (!isQuestionVisible(QUESTIONS[i], answersMap)) continue;
    if (!(QUESTIONS[i].key in answersMap)) return i;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════
   回答済み行
   ═══════════════════════════════════════════════════════════ */

function AnsweredRow({
  qdef,
  answer,
  onEdit,
}: {
  qdef: QDef;
  answer: string | string[];
  onEdit: () => void;
}) {
  const displayValue = Array.isArray(answer)
    ? answer.join("、")
    : qdef.options.find((o) => o.value === answer)?.label ?? answer;

  return (
    <div className="flex items-center gap-2 rounded-xl bg-white border border-gray-100 px-3 py-2.5 shadow-sm">
      <span className="shrink-0 text-[11px] font-semibold text-gray-400 w-16">
        {qdef.summaryLabel}
      </span>
      <span className="flex-1 text-[13px] text-gray-700 truncate">
        {displayValue}
      </span>
      <button
        onClick={onEdit}
        className="shrink-0 text-[11px] text-blue-500 font-medium px-2 py-1 rounded-lg active:bg-blue-50"
      >
        変更
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   アクティブ質問
   ═══════════════════════════════════════════════════════════ */

function ActiveQuestion({
  qdef,
  qIndex,
  visibleIndex,
  visibleTotal,
  currentMulti,
  onSingle,
  onMultiToggle,
  onMultiConfirm,
}: {
  qdef: QDef;
  qIndex: number;
  visibleIndex: number;
  visibleTotal: number;
  currentMulti: string[];
  onSingle: (val: string) => void;
  onMultiToggle: (val: string) => void;
  onMultiConfirm: () => void;
}) {
  const isMulti = !!qdef.multi;
  const noneValues = ["特にない", "使えなさそう", "わからない"];

  return (
    <div className="rounded-2xl bg-white p-4 shadow-md border border-blue-100">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
          {visibleIndex + 1}
        </span>
        <span className="text-[11px] text-gray-400">
          {visibleIndex + 1} / {visibleTotal}
        </span>
      </div>

      <h3 className="text-[15px] font-bold text-gray-800">{qdef.question}</h3>
      {qdef.subtitle && (
        <p className="mt-0.5 text-[11px] text-gray-400 leading-relaxed">{qdef.subtitle}</p>
      )}

      {/* 選択肢 */}
      {isMulti ? (
        <>
          <div className="mt-3 grid grid-cols-1 gap-1.5">
            {qdef.options.map((opt) => {
              const checked = currentMulti.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => onMultiToggle(opt.value)}
                  className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-[12px] font-medium transition-all ${
                    checked
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 active:scale-[0.98]"
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px]">
                    {checked ? "✓" : ""}
                  </span>
                  <span className="leading-tight">{opt.label}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={onMultiConfirm}
            disabled={currentMulti.length === 0}
            className={`mt-3 w-full rounded-xl py-2.5 text-sm font-bold transition-all ${
              currentMulti.length > 0
                ? "bg-blue-600 text-white active:scale-[0.98]"
                : "bg-gray-200 text-gray-400"
            }`}
          >
            次へ
          </button>
        </>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {qdef.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSingle(opt.value)}
              className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-[13px] font-medium text-gray-700 transition-all active:scale-[0.98] active:border-blue-400 active:bg-blue-50"
            >
              <span>{opt.label}</span>
              {opt.hint && (
                <span className="text-[11px] text-gray-400">{opt.hint}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   メインコンポーネント
   ═══════════════════════════════════════════════════════════ */

interface DiagnosisFlowV2Props {
  onComplete: (answers: RecommendAnswers) => void;
}

export default function DiagnosisFlowV2({ onComplete }: DiagnosisFlowV2Props) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const activeRef = useRef<HTMLDivElement>(null);

  // 表示可能な質問リスト
  const visibleQuestions = useMemo(
    () => QUESTIONS.filter((q) => isQuestionVisible(q, answers)),
    [answers]
  );
  const visibleKeys = useMemo(
    () => new Set(visibleQuestions.map((q) => q.key)),
    [visibleQuestions]
  );
  const totalQ = visibleQuestions.length;
  const allAnswered = visibleQuestions.every((q) => q.key in answers);

  // Q3の表示/非表示が変わったとき、非表示になったQ3の回答を削除
  useEffect(() => {
    const q3Def = QUESTIONS[2]; // Q3 index = 2
    const q3Visible = isQuestionVisible(q3Def, answers);
    if (!q3Visible && q3Def.key in answers) {
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[q3Def.key];
        return next;
      });
      // アクティブがQ3なら次へ進む
      if (activeIndex === 2) {
        const next = findNextUnanswered(2, answers);
        if (next !== null) setActiveIndex(next);
      }
    }
  }, [answers.q2]); // eslint-disable-line react-hooks/exhaustive-deps

  // Q11（光回線種別）: Q9の変化でnet_bundleが外れたらQ11の回答を削除
  useEffect(() => {
    const q11Idx = QUESTIONS.findIndex((q) => q.key === "q11");
    if (q11Idx < 0) return;
    const q11Def = QUESTIONS[q11Idx];
    const q11Visible = isQuestionVisible(q11Def, answers);
    if (!q11Visible && q11Def.key in answers) {
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[q11Def.key];
        return next;
      });
      if (activeIndex === q11Idx) {
        const next = findNextUnanswered(q11Idx, answers);
        if (next !== null) setActiveIndex(next);
      }
    }
  }, [answers.q9]); // eslint-disable-line react-hooks/exhaustive-deps

  // activeIndex が変わったらスクロール
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex]);

  // 単一選択
  const handleSingle = useCallback(
    (value: string) => {
      const qdef = QUESTIONS[activeIndex];
      const newAnswers = { ...answers, [qdef.key]: value };
      setAnswers(newAnswers);
      const next = findNextUnanswered(activeIndex, newAnswers);
      setActiveIndex(next ?? activeIndex);
    },
    [activeIndex, answers]
  );

  // 複数選択トグル
  const handleMultiToggle = useCallback(
    (value: string) => {
      const noneValues = ["特にない", "使えなさそう", "わからない"];
      setMultiSelected((prev) => {
        if (noneValues.includes(value)) return [value];
        const without = prev.filter((v) => !noneValues.includes(v));
        return without.includes(value)
          ? without.filter((v) => v !== value)
          : [...without, value];
      });
    },
    []
  );

  // 複数選択確定
  const handleMultiConfirm = useCallback(() => {
    if (multiSelected.length === 0) return;
    const qdef = QUESTIONS[activeIndex];
    const newAnswers = { ...answers, [qdef.key]: multiSelected };
    setAnswers(newAnswers);
    const next = findNextUnanswered(activeIndex, newAnswers);
    setActiveIndex(next ?? activeIndex);
    setMultiSelected([]);
  }, [multiSelected, activeIndex, answers]);

  // 回答変更
  const handleEdit = useCallback(
    (idx: number) => {
      setActiveIndex(idx);
      const qdef = QUESTIONS[idx];
      if (qdef.multi) {
        const current = answers[qdef.key];
        setMultiSelected(Array.isArray(current) ? [...current] : []);
      }
    },
    [answers]
  );

  // 診断実行
  const handleSubmit = useCallback(() => {
    if (!allAnswered) return;
    const result: RecommendAnswers = {
      q1: (answers.q1 as string) || "",
      q2: (answers.q2 as string) || "",
      q3: (answers.q3 as string) || "",
      q4: (answers.q4 as string) || "",
      q5: (answers.q5 as string) || "",
      q6: (answers.q6 as string) || "",
      q7: (answers.q7 as string) || "",
      q8: (answers.q8 as string) || "",
      q9: (answers.q9 as string[]) || [],
      q10: (answers.q10 as string[]) || [],
    };
    if (typeof answers.q11 === "string") {
      result.q11 = answers.q11;
    }
    onComplete(result);
  }, [allAnswered, answers, onComplete]);

  // 進捗率
  const answered = visibleQuestions.filter((q) => q.key in answers).length;
  const pct = Math.round((answered / totalQ) * 100);

  // 可視質問内でのインデックス計算
  const getVisibleIndex = (qdefKey: string) =>
    visibleQuestions.findIndex((q) => q.key === qdefKey);

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-8">
      {/* ─ プログレスバー ─ */}
      <div className="sticky top-0 z-20 bg-white shadow-sm">
        <div className="px-4 py-2.5 flex items-center gap-3">
          <span className="text-[11px] font-semibold text-gray-500">
            {answered}/{totalQ}
          </span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ─ 質問リスト ─ */}
      <div className="mx-4 mt-3 space-y-2">
        {QUESTIONS.map((qdef, idx) => {
          // 非表示質問はスキップ
          if (!isQuestionVisible(qdef, answers)) return null;

          const isActive = idx === activeIndex;
          const isAnswered = qdef.key in answers;
          const vIdx = getVisibleIndex(qdef.key);

          if (isActive) {
            return (
              <div key={qdef.key} ref={activeRef}>
                <ActiveQuestion
                  qdef={qdef}
                  qIndex={idx}
                  visibleIndex={vIdx}
                  visibleTotal={totalQ}
                  currentMulti={multiSelected}
                  onSingle={handleSingle}
                  onMultiToggle={handleMultiToggle}
                  onMultiConfirm={handleMultiConfirm}
                />
              </div>
            );
          }

          if (isAnswered) {
            return (
              <AnsweredRow
                key={qdef.key}
                qdef={qdef}
                answer={answers[qdef.key]}
                onEdit={() => handleEdit(idx)}
              />
            );
          }

          // 未回答・非アクティブ → グレーアウト
          return (
            <div
              key={qdef.key}
              className="rounded-xl bg-gray-100 px-3 py-2.5 text-[12px] text-gray-300"
            >
              Q{vIdx + 1}. {qdef.question}
            </div>
          );
        })}
      </div>

      {/* ─ 診断ボタン ─ */}
      {allAnswered && (
        <div className="mx-4 mt-5">
          <button
            onClick={handleSubmit}
            className="w-full rounded-2xl bg-blue-600 py-4 text-base font-bold text-white shadow-lg active:scale-[0.98] transition-all"
          >
            この条件で診断する →
          </button>
          <p className="mt-2 text-center text-[11px] text-gray-400">
            上の回答はいつでも「変更」で直せます
          </p>
        </div>
      )}
    </div>
  );
}
