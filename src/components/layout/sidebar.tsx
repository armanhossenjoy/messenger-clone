import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SidebarNav } from "./SidebarNav";
import { FriendList } from "./FriendList";
import { SidebarProfile } from "./SidebarProfile";
import { Profile } from "@/lib/types";

export async function Sidebar({ user, profile }: { user: User, profile: Profile | null }) {
  const supabase = createClient();
  
  if (!profile) return null;
  
  // Fetch all sidebar data in parallel
  const [friends1Res, friends2Res, pendingRes] = await Promise.all([
    supabase
      .from("friendships")
      .select("*, friend:profiles!user_id2(*)")
      .eq("user_id1", user.id)
      .eq("status", "accepted"),
    supabase
      .from("friendships")
      .select("*, friend:profiles!user_id1(*)")
      .eq("user_id2", user.id)
      .eq("status", "accepted"),
    supabase
      .from("friendships")
      .select("*", { count: "exact", head: true })
      .eq("user_id2", user.id)
      .eq("status", "pending")
  ]);

  const friends = [
    ...(friends1Res.data?.map((f) => (f as unknown as { friend: Profile }).friend) || []),
    ...(friends2Res.data?.map((f) => (f as unknown as { friend: Profile }).friend) || [])
  ];

  // Fetch latest messages to show previews
  const { data: latestMessages } = await supabase
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const friendsWithLastMessage = friends.map(friend => {
    const lastMsg = latestMessages?.find(
      m => (m.sender_id === friend.id && m.receiver_id === user.id) || 
           (m.sender_id === user.id && m.receiver_id === friend.id)
    );
    return { ...friend, lastMessage: lastMsg || null };
  });

  const pendingCount = pendingRes.count;

  return (
    <div className="w-full h-full flex flex-col bg-neutral-50/30">
      <SidebarProfile profile={profile} />

      <SidebarNav initialRequestCount={pendingCount || 0} userId={user.id} />

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
        <FriendList initialFriends={friendsWithLastMessage as any} userId={user.id} />
      </div>
    </div>
  );
}
