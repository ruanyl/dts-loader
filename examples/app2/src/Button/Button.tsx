import * as React from "react";

import styles from "./Button.css";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  customLabel: string;
}

export const Button = ({ customLabel, ...rest }: ButtonProps) => (
  <button {...rest} className={styles.primary}>
    {customLabel}
  </button>
);
