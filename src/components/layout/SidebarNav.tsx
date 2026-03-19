"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function SidebarNav({ initialRequestCount, userId }: { initialRequestCount: number, userId: string }) {
  const pathname = usePathname();
  const [requestCount, setRequestCount] = useState(initialRequestCount);
  const supabase = createClient();

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("user_id2", userId)
        .eq("status", "pending");
      setRequestCount(count || 0);
    };

    const channel = supabase.channel("sidebar-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
        },
        async () => {
          // On any change involving us, just refetch the count
          await fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);
  
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
            "w-full justify-center text-xs font-medium h-9 relative",
            pathname === "/discover" ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50"
          )}
        >
          <Users className="w-4 h-4 mr-2" />
          Discover
          {requestCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 bg-red-500 text-white rounded-full text-[10px] items-center justify-center font-bold animate-in zoom-in duration-300">
              {requestCount}
            </span>
          )}
        </Button>
      </Link>
    </div>
  );
}
