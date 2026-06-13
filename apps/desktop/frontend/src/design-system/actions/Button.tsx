import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "danger" | "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, className, variant = "secondary", ...props },
  ref,
) {
  const classes = ["button", `button-${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} ref={ref} type="button" {...props}>
      {children}
    </button>
  );
});
