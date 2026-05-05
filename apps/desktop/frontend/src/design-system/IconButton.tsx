import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
  children: ReactNode;
};

export function IconButton({ children, className, ...props }: IconButtonProps) {
  const classes = ["icon-button", className].filter(Boolean).join(" ");

  return (
    <button className={classes} type="button" {...props}>
      {children}
    </button>
  );
}
