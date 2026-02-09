// ============================================================================
// ADMIN LAYOUT — /admin/*
// Minimal layout with no doctor sidebar. Used for admin-only pages.
// ============================================================================

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {children}
    </div>
  );
}
