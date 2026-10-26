import { MessageCircle } from 'lucide-react';

export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div
        className="relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500 text-white shadow-sm"
        style={{ width: size, height: size }}
      >
        <MessageCircle size={size * 0.55} strokeWidth={2.5} fill="white" className="text-transparent" />
        <span
          className="absolute -top-0.5 -right-0.5 rounded-full bg-violet-400 ring-2 ring-white dark:ring-navy-900"
          style={{ width: size * 0.22, height: size * 0.22 }}
        />
      </div>
      {size >= 28 && (
        <span className="font-bold text-lg tracking-tight text-main">BLOOP</span>
      )}
    </div>
  );
}

export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500 text-white shadow-sm ${className}`}
      style={{ width: size, height: size }}
    >
      <MessageCircle size={size * 0.55} strokeWidth={2.5} fill="white" className="text-transparent" />
      <span
        className="absolute -top-0.5 -right-0.5 rounded-full bg-violet-400 ring-2 ring-white dark:ring-navy-900"
        style={{ width: size * 0.22, height: size * 0.22 }}
      />
    </div>
  );
}
