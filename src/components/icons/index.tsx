'use client';

import { cn } from '@/lib/utils';

interface IconProps {
  className?: string;
}

export function Drum({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('w-4 h-4', className)}
    >
      <ellipse cx="12" cy="9" rx="10" ry="5" />
      <path d="M2 9v6c0 2.761 4.477 5 10 5s10-2.239 10-5V9" />
      <path d="M2 9l3.5 3.5" />
      <path d="M22 9l-3.5 3.5" />
      <path d="M12 9v11" />
    </svg>
  );
}

export function Piano({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('w-4 h-4', className)}
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 4v10" />
      <path d="M10 4v10" />
      <path d="M14 4v10" />
      <path d="M18 4v10" />
      <path d="M4 14h16" />
      <rect x="5" y="4" width="2" height="6" fill="currentColor" />
      <rect x="9" y="4" width="2" height="6" fill="currentColor" />
      <rect x="13" y="4" width="2" height="6" fill="currentColor" />
      <rect x="17" y="4" width="2" height="6" fill="currentColor" />
    </svg>
  );
}
