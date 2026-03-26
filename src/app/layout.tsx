import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "てらすモバイル｜携帯プランを3問でスキャン",
  description:
    "あなたの携帯プラン、3問でスキャンします。今より安くなるか、今すぐ確認。無料・登録不要。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-[#f8f9fa] text-gray-900 antialiased">{children}</body>
    </html>
  );
}
