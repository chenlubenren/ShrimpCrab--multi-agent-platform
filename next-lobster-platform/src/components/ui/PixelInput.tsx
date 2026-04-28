'use client';

import { forwardRef } from 'react';

interface PixelInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
}

export const PixelInput = forwardRef<HTMLInputElement, PixelInputProps>(({
  value,
  onChange,
  placeholder = '',
  className = '',
  onKeyDown,
  disabled = false
}, ref) => {
  return (
    <input
      ref={ref}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      disabled={disabled}
      className={`
        w-full
        bg-pixel-white
        border-4
        border-pixel-black
        font-pixel
        text-pixel-black
        px-4
        py-2
        placeholder:text-pixel-black/50
        focus:outline-none
        focus:border-pixel-blue
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${className}
      `}
      style={{
        boxShadow: 'inset 2px 2px 0px 0px #101010'
      }}
    />
  );
});

PixelInput.displayName = 'PixelInput';
