import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "携帯料金を3問でスキャン | てらすAI 固定費最適化",
  description:
    "今のキャリアより安いプランがあるか、3問に答えるだけで今すぐわかります。無料・登録不要・1分以内。",
  openGraph: {
    title: "あなたの携帯料金、まだ高いかもしれません。",
    description:
      "3問に答えるだけで今すぐ確認。無料・登録不要。",
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary",
    title: "携帯料金を3問でスキャン | てらすAI",
    description:
      "3問に答えるだけで今すぐ確認。無料・登録不要。",
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
