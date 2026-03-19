"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { usePathname } from "next/navigation";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type Friend = {
  id: string;
  username: string;
  avatar_url: string | null;
  last_message?: string;
  is_online?: boolean;
};

export function FriendList({ 
  initialFriends, 
  userId 
}: { 
  initialFriends: Friend[], 
  userId: string 
}) {
  const [friends, setFriends] = useState<Friend[]>(initialFriends);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // 1. Presence Subscription
    const presenceChannel = supabase.channel("online-users");
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set<string>();
        for (const key in state) {
          const presences = state[key] as unknown as { user_id: string }[];
          presences.forEach(p => online.add(p.user_id));
        }
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    // 2. Friendships Subscription (New Friends & Unfriends)
    const friendshipChannel = supabase.channel("friendship-updates")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen for ALL events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "friendships",
        },
        async (payload) => {
          // Handle DELETION (Unfriend/Block)
          if (payload.eventType === "DELETE") {
            const oldId = payload.old.id;
            // Since we can't easily know which friend was deleted from payload.old without full replication,
            // the safest robust way is to mark for refresh or filter if we find it.
            // Actually, just refetching is best for the sidebar.
            router.refresh();
            return;
          }

          const rel = payload.new;
          if (rel.user_id1 === userId || rel.user_id2 === userId) {
            if (rel.status === "accepted") {
              const friendId = rel.user_id1 === userId ? rel.user_id2 : rel.user_id1;
              const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", friendId)
                .single();
              
              if (profile) {
                setFriends(prev => {
                  if (prev.find(f => f.id === profile.id)) return prev;
                  return [profile, ...prev];
                });
              }
            } else if (rel.status === "blocked" || rel.status === "pending") {
              // If it's not accepted anymore, remove from list
              setFriends(prev => prev.filter(f => f.id !== rel.user_id1 && f.id !== rel.user_id2));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(friendshipChannel);
    };
  }, [supabase, userId]);

  if (friends.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mb-3 border border-neutral-100">
          <MessageCircle className="w-5 h-5 text-neutral-400" />
        </div>
        <h3 className="text-sm font-semibold text-neutral-900 leading-none mb-1.5">No chats yet</h3>
        <p className="text-xs text-neutral-500 max-w-[200px] leading-relaxed">
          Go to Discover to find friends and start chatting.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-neutral-100 px-2 py-2">
      <AnimatePresence>
        {friends.map((friend, index) => (
          <motion.div
            key={friend.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link 
              href={`/chat/${friend.id}`}
              className={clsx(
                "flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group",
                pathname === `/chat/${friend.id}` ? "bg-blue-50/50" : "hover:bg-neutral-50"
              )}
            >
              <div className="relative">
                <Avatar className="w-12 h-12 border border-neutral-100 group-hover:scale-105 transition-transform">
                  <AvatarImage src={friend.avatar_url || undefined} />
                  <AvatarFallback className="bg-neutral-100 text-neutral-600">
                    {friend.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={clsx(
                  "absolute bottom-0.5 right-0.5 w-3.5 h-3.5 border-2 border-white rounded-full transition-colors",
                  onlineUsers.has(friend.id) ? "bg-green-500 animate-pulse-subtle" : "bg-neutral-300"
                )}></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className={clsx(
                    "font-semibold text-sm truncate transition-colors",
                    pathname === `/chat/${friend.id}` ? "text-blue-600" : "text-neutral-900"
                  )}>
                    {friend.username}
                  </p>
                </div>
                <p className="text-xs text-neutral-500 truncate">
                  {onlineUsers.has(friend.id) ? "Online" : "Offline"}
                </p>
              </div>
            </Link>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
