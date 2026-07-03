'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Automatically close sidebar when navigation path changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent background scroll when sidebar drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-slate-800 font-sans relative overflow-x-hidden">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200/60 bg-white/75 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo Brand */}
          <Link href="/" className="flex items-center space-x-1 group">
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900">
                Planning<span className="text-violet-600">OS</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-medium tracking-wide -mt-1 uppercase">
                UK planning audit MVP
              </span>
            </div>
          </Link>

          {/* Top-Right Toggle Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 active:scale-95 transition-all text-slate-600 cursor-pointer z-50 focus:outline-none"
            aria-label="Toggle planning panel"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Page Content */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto relative">
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 w-full">
          {children}
        </main>
      </div>

      {/* Shadcn-Style Sheet Sidebar Drawer */}
      {/* Overlay Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-zinc-950/20 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
        />
      )}

      {/* Sliding Sidebar Drawer Container */}
      <div
        className={`fixed top-0 right-0 h-full w-[350px] sm:w-[400px] bg-white border-l border-zinc-200 z-50 shadow-2xl transition-transform duration-300 ease-in-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        {/* Header inside Sidebar drawer */}
        <div className="h-16 border-b border-zinc-100 flex items-center justify-between px-6 shrink-0">
          <div>
            <span className="font-bold text-sm tracking-tight text-slate-900">
              Planning<span className="text-violet-600">OS</span> Dashboard
            </span>
            <span className="block text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
              Applications & Tools
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-zinc-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Body with overflow handling */}
        <div className="flex-1 overflow-y-auto">
          <Sidebar />
        </div>
      </div>
    </div>
  );
}
