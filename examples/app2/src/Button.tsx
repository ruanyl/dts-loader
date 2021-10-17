import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  customLabel: string;
}

const Button = ({ customLabel, ...rest }: ButtonProps) => (
  <button {...rest}>{customLabel}</button>
);

export default Button;
