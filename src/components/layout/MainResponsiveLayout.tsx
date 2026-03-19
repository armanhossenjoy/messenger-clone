"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainResponsiveLayout({ 
  sidebar, 
  children 
}: { 
  sidebar: React.ReactNode; 
  children: React.ReactNode 
}) {
  const pathname = usePathname();
  const isChatPage = pathname.startsWith("/chat/");
  const isDiscoverPage = pathname.startsWith("/discover");

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar Container */}
      <aside className={cn(
        "h-full border-r border-neutral-200 transition-all duration-300 ease-in-out shrink-0",
        // On mobile: show only if not on a chat page. On desktop: always show and set width.
        isChatPage ? "hidden md:flex md:w-80 lg:w-96" : "flex w-full md:w-80 lg:w-96"
      )}>
        {sidebar}
      </aside>

      {/* Main Content Container */}
      <main className={cn(
        "flex-1 flex flex-col bg-neutral-50/50 relative h-full",
        // On mobile: hide if we are in the "friend list" view (the home page).
        !isChatPage && !isDiscoverPage ? "hidden md:flex" : "flex"
      )}>
        {children}
      </main>
    </div>
  );
}
