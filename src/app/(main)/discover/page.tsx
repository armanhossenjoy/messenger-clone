import { createClient } from "@/lib/supabase/server";
import DiscoverClient from "./client";

export default async function DiscoverPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get pending friend requests received by the current user
  const { data: pendingRequests } = await supabase
    .from("friendships")
    .select("*, profile:profiles!user_id1(*)") // get the profile of the sender
    .eq("user_id2", user.id)
    .eq("status", "pending");

  // Get sent pending requests (to show "Requested")
  const { data: sentRequests } = await supabase
    .from("friendships")
    .select("user_id2")
    .eq("user_id1", user.id)
    .eq("status", "pending");

  // Get accepted friends
  const { data: acceptedFriends1 } = await supabase
    .from("friendships")
    .select("user_id2")
    .eq("user_id1", user.id)
    .eq("status", "accepted");
    
  const { data: acceptedFriends2 } = await supabase
    .from("friendships")
    .select("user_id1")
    .eq("user_id2", user.id)
    .eq("status", "accepted");

  const sentRequestIds = new Set(sentRequests?.map(r => r.user_id2) || []);
  const friendIds = new Set([
    ...(acceptedFriends1?.map(r => r.user_id2) || []),
    ...(acceptedFriends2?.map(r => r.user_id1) || [])
  ]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Discover</h1>
        <DiscoverClient 
          userId={user.id} 
          initialPending={pendingRequests || []}
          sentRequestIds={Array.from(sentRequestIds)}
          friendIds={Array.from(friendIds)}
        />
      </div>
    </div>
  );
}
