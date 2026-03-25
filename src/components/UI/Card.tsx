interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 shadow-sm shadow-slate-900/5 p-6 ${className}`}>
      {children}
    </div>
  );
}
