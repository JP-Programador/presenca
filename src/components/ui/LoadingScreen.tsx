export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface dark:bg-[#1A1A1A]">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        role="status"
        aria-label="Carregando"
      />
    </div>
  );
}
