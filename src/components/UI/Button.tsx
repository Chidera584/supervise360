interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  type?: 'button' | 'submit' | 'reset';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  size = 'md',
  disabled = false,
  className = '',
  title,
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  const variantStyles = {
    primary: 'bg-accent text-white hover:bg-accent-hover shadow-accent/20',
    secondary: 'bg-primary text-white hover:bg-slate-800',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-none',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  const dangerFix = variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700 shadow-none' : variantStyles[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseStyles} ${sizeStyles[size]} ${dangerFix} ${className}`}
    >
      {children}
    </button>
  );
}
