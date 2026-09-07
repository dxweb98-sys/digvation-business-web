import { DSkeleton } from '@digvation/ui';

export function AuthenticationLoading() {
  return (
    <main className="min-h-screen bg-[var(--color-background)] p-6 lg:p-8" aria-busy="true">
      <div className="mx-auto max-w-6xl space-y-6">
        <DSkeleton className="h-16 w-full" />
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <DSkeleton className="h-64" />
          <div className="space-y-4">
            <DSkeleton className="h-8 w-52" />
            <DSkeleton className="h-28 w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
