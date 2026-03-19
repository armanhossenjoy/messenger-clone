"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export function SidebarNav() {
  const pathname = usePathname();
  
  return (
    <div className="p-2 flex gap-1 bg-white border-b border-neutral-200">
      <Link href="/" className="flex-1">
        <Button 
          variant="ghost" 
          className={clsx(
            "w-full justify-center text-xs font-medium h-9",
            pathname === "/" || pathname?.startsWith("/chat") ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50"
          )}
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Chats
        </Button>
      </Link>
      <Link href="/discover" className="flex-1">
        <Button 
          variant="ghost" 
          className={clsx(
            "w-full justify-center text-xs font-medium h-9",
            pathname === "/discover" ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50"
          )}
        >
          <Users className="w-4 h-4 mr-2" />
          Discover
        </Button>
      </Link>
    </div>
  );
}
