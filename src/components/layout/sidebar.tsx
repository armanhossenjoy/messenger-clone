import { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/server";
import { Search, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { SidebarNav } from "./SidebarNav";

export async function Sidebar({ user, profile }: { user: User, profile: Record<string, string> | null }) {
  const supabase = createClient();
  
  // Fetch accepted friends
  const { data: friendships1 } = await supabase
    .from("friendships")
    .select("*, friend:profiles!user_id2(*)")
    .eq("user_id1", user.id)
    .eq("status", "accepted");
    
  const { data: friendships2 } = await supabase
    .from("friendships")
    .select("*, friend:profiles!user_id1(*)")
    .eq("user_id2", user.id)
    .eq("status", "accepted");
    
  const friends = [
    ...(friendships1?.map(f => f.friend) || []),
    ...(friendships2?.map(f => f.friend) || [])
  ];

  return (
    <div className="w-full h-full flex flex-col bg-neutral-50/30">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border border-neutral-100">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-neutral-900 text-white text-xs">
              {profile?.username?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <p className="font-semibold text-neutral-900 leading-none mb-1">{profile?.username || "..."}</p>
            <p className="text-[11px] text-neutral-500 font-mono tracking-tight">{profile?.unique_id || "..."}</p>
          </div>
        </div>
        <SignOutButton />
      </div>

      <SidebarNav />

      {/* Search */}
      <div className="p-4 py-3 bg-white">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
          <Input 
            placeholder="Search messages..." 
            className="pl-8 bg-neutral-50 border-neutral-200 shadow-none text-sm h-9"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto bg-white flex flex-col">
        {friends.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mb-3 border border-neutral-100">
              <MessageCircle className="w-5 h-5 text-neutral-400" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 leading-none mb-1.5">No chats yet</h3>
            <p className="text-xs text-neutral-500 max-w-[200px] leading-relaxed">
              Go to Discover to find friends and start chatting.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 px-2 py-2">
            {friends.map((friend: { id: string; username: string; avatar_url: string }) => (
              <Link 
                key={friend.id} 
                href={`/chat/${friend.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors"
              >
                <div className="relative">
                  <Avatar className="w-12 h-12 border border-neutral-100">
                    <AvatarImage src={friend.avatar_url || undefined} />
                    <AvatarFallback className="bg-neutral-100 text-neutral-600">
                      {friend.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {/* We will add presence indicator here later */}
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-neutral-300 border-2 border-white rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm text-neutral-900 truncate">
                      {friend.username}
                    </p>
                  </div>
                  <p className="text-xs text-neutral-500 truncate">
                    Tap to start chatting
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
