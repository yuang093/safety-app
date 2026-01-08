import './globals.css'; // 引入樣式檔 (等一下會建)

export const metadata = {
  title: '供應商工安認證申請表',
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