'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { buttonClass, dangerButtonClass } from './ui';

export function SubmitButton({ children, className = buttonClass }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? 'Saving…' : children}
    </button>
  );
}

/** A submit button that asks for confirmation first. Place inside a <form> bound to a server action. */
export function ConfirmButton({ children, message }: { children: ReactNode; message: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={dangerButtonClass}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" className={buttonClass} onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
