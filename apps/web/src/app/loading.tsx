import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function RootLoading() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
      <LoadingSpinner size="lg" label="Loading application..." />
      <p className="text-sm text-muted-foreground animate-pulse">Loading VYNOR CRM...</p>
    </div>
  );
}
