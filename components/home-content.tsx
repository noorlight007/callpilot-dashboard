'use client';

import { Plus, ArrowUp } from 'lucide-react';

export function HomeContent() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-400/30 blur-3xl animate-float" />
      <div className="w-full max-w-2xl space-y-8 relative">
        {/* Header */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight gradient-text animate-fade-up">
          Chat prompts
        </h1>

        {/* Empty State */}
        <div className="glass rounded-3xl flex flex-col items-center justify-center py-12 sm:py-20 px-6 space-y-8 animate-scale-in">
          {/* Icon */}
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full gradient-bg flex items-center justify-center shadow-lg shadow-blue-500/30 animate-float">
            <span className="absolute inset-0 rounded-full animate-pulse-ring" />
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          </div>

          {/* Text */}
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-gray-100 text-center animate-fade-up" style={{ animationDelay: '100ms' }}>
            Create a chat prompt
          </h2>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto animate-fade-up" style={{ animationDelay: '160ms' }}>
            <button className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-violet-500 text-white px-6 py-3 rounded-full font-semibold shadow-lg shadow-blue-500/30 hover:from-blue-500 hover:to-violet-400 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition whitespace-nowrap">
              <Plus size={18} />
              <span>Create</span>
            </button>
            <div className="relative flex-1 sm:flex-none">
              <input
                type="text"
                placeholder="Generate..."
                className="w-full px-4 py-3 pr-11 bg-white/70 dark:bg-white/5 border border-blue-100 dark:border-white/10 rounded-full text-sm placeholder-slate-500 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-600 transition">
                <ArrowUp size={18} />
              </button>
            </div>
          </div>

          {/* Suggestion Tags */}
          <div className="flex flex-wrap gap-2 justify-center">
            {['Trip planner', 'Image generator', 'Code debugger', 'Research assistant', 'Decision helper'].map((t, i) => (
              <button
                key={t}
                style={{ animationDelay: `${240 + i * 60}ms` }}
                className="animate-fade-up px-3 py-1.5 bg-blue-50 dark:bg-white/10 text-blue-700 dark:text-blue-200 text-xs font-medium rounded-full border border-blue-100 dark:border-white/10 hover:bg-gradient-to-r hover:from-blue-600 hover:to-violet-500 hover:text-white hover:border-transparent hover:-translate-y-0.5 transition"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
