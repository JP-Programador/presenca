import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = "", ...rest }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-ink dark:text-white">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={[
            "h-11 rounded-md border bg-white px-3 text-sm text-ink placeholder:text-ink/40",
            "dark:bg-[#242424] dark:text-white dark:placeholder:text-white/40",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            error ? "border-danger" : "border-ink/20 dark:border-white/20",
            className,
          ].join(" ")}
          {...rest}
        />
        {error && <span className="text-xs font-medium text-danger">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
