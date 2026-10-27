import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sign Lab · Portal 请求签名工具",
  description: "在浏览器本地生成并校验 Portal AES Sign。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
