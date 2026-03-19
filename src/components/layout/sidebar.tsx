import { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/server";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { SidebarNav } from "./SidebarNav";
import { FriendList } from "./FriendList";

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
      <div className="flex-1 overflow-y-auto bg-white flex flex-col min-h-0">
        <FriendList initialFriends={friends as { id: string; username: string; avatar_url: string | null }[]} userId={user.id} />
      </div>
    </div>
  );
}
