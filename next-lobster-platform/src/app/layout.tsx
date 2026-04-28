import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lobster Architecture Platform | 龙虾架构平台',
  description: 'AI Agent Team Management Platform | AI智能体团队管理平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        {/* Header */}
        <header className="bg-pixel-black border-b-4 border-pixel-white px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-pixel-red border-4 border-pixel-white flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-pixel-white">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h1 className="flex items-center gap-3">
                <span className="chinese-large text-pixel-white">龙虾架构平台</span>
                <span className="font-pixel text-xl text-pixel-white/70">LOBSTER ARCHITECTURE</span>
              </h1>
            </div>
            <div className="font-pixel text-pixel-yellow text-sm hidden md:block">
              AI TEAM ORCHESTRATION v1.0
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto p-4 bg-pixel-white min-h-[calc(100vh-120px)]">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-pixel-black border-t-4 border-pixel-red py-4">
          <div className="max-w-7xl mx-auto text-center font-pixel text-pixel-white text-xs">
            <p>龙虾架构平台 - 高效AI团队协作 | Efficient AI Team Collaboration</p>
            <p className="mt-1 text-pixel-red">READY.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
