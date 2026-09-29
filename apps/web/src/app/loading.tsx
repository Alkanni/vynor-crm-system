import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function RootLoading() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-n-surface-1">
      <LoadingSpinner size="lg" label="Loading VYNOR CRM…" />
    </div>
  );
}
