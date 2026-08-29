import { Suspense } from 'react';
import FineTuneContent from '@/components/fine-tune/fine-tune-content';

export default function FineTunePage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground p-6 text-sm">Loading analysis…</div>}>
      <FineTuneContent />
    </Suspense>
  );
}
