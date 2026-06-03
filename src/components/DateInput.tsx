'use client';

import { useRef } from 'react';

interface DateInputProps {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  className?: string;
  id?: string;
}

export default function DateInput({ name, defaultValue, required, className, id }: DateInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  function handleClick() {
    try {
      ref.current?.showPicker();
    } catch {
      // Fallback: einige Browser unterstuetzen showPicker() nicht
    }
  }

  return (
    <input
      ref={ref}
      id={id ?? name}
      name={name}
      type="date"
      defaultValue={defaultValue ?? ''}
      required={required}
      className={className ?? 'input cursor-pointer'}
      onClick={handleClick}
      readOnly={false}
    />
  );
}
