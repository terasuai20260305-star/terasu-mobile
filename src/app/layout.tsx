import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "てらすモバイル｜あなたに最適な携帯プランを3問で診断",
  description:
    "たった3つの質問に答えるだけで、あなたに最適な携帯プランを1件ご提案。比較不要・登録不要・完全無料。月3,000円以上の節約も。",
  openGraph: {
    title: "てらすモバイル｜あなたに最適な携帯プランを3問で診断",
    description:
      "たった3つの質問に答えるだけで、あなたに最適な携帯プランを1件ご提案。比較不要・登録不要・完全無料。",
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary",
    title: "てらすモバイル｜携帯プランを3問で診断",
    description:
      "あなたに最適な携帯プランを1件ご提案。比較不要・登録不要・完全無料。",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-[#f8f9fa] font-sans text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
