import './globals.css'; // 引入樣式檔 (等一下會建)

export const metadata = {
  title: 'Safety App',
  description: 'Admin Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}