import { useState } from 'react';
import type { ActionFeedbackState } from '../components/ui/ActionFeedback';

export function useActionFeedback() {
  const [feedback, setFeedback] = useState<ActionFeedbackState | null>(null);

  return {
    feedback,
    clear() {
      setFeedback(null);
    },
    showPending(message: string) {
      setFeedback({
        kind: 'pending',
        message,
      });
    },
    showSuccess(message: string) {
      setFeedback({
        kind: 'success',
        message,
      });
    },
    showError(message: string) {
      setFeedback({
        kind: 'error',
        message,
      });
    },
  };
}
