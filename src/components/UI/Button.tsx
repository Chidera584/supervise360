interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
  /** Compact padding for tables and dense toolbars */
  size?: 'sm' | 'md';
  title?: string;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  className = '',
  size = 'md',
  title,
}: ButtonProps) {
  const sizeStyles = size === 'sm' ? 'px-3 py-1.5 text-sm rounded-md' : 'px-4 py-2 rounded-lg';

  const baseStyles = `inline-flex items-center justify-center gap-2 ${sizeStyles} font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`;

  const variantStyles = {
    primary: 'bg-accent text-white hover:bg-accent-hover shadow-sm shadow-accent/15',
    secondary: 'bg-primary text-white hover:bg-slate-800 shadow-sm',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
