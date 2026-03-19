import { createClient } from "@/lib/supabase/server";
import DiscoverClient from "./client";

export default async function DiscoverPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch all relevant relationships in one query to avoid multiple round-trips
  const { data: allRelationships } = await supabase
    .from("friendships")
    .select(`
      *,
      sender:profiles!user_id1(*),
      receiver:profiles!user_id2(*)
    `)
    .or(`user_id1.eq.${user.id},user_id2.eq.${user.id}`);

  const relationships = allRelationships || [];

  // 1. Pending requests received by us (to accept/reject)
  const pendingRequests = relationships.filter(r => 
    r.user_id2 === user.id && r.status === "pending"
  ).map(r => ({ ...r, profile: r.sender }));

  // 2. Sent pending requests (to show "Requested" status)
  const sentRequestIds = new Set(
    relationships
      .filter(r => r.user_id1 === user.id && r.status === "pending")
      .map(r => r.user_id2)
  );

  // 3. Accepted friends
  const friendIds = new Set(
    relationships
      .filter(r => r.status === "accepted")
      .map(r => r.user_id1 === user.id ? r.user_id2 : r.user_id1)
  );

  // 4. Blocked users
  const blockedUsers = relationships
    .filter(r => r.status === "blocked")
    .map(r => {
      const isSender = r.user_id1 === user.id;
      return { 
        id: r.id, 
        profile: isSender ? r.receiver : r.sender 
      };
    });

  const blockedUserIds = new Set(
    relationships
      .filter(r => r.status === "blocked")
      .map(r => r.user_id1 === user.id ? r.user_id2 : r.user_id1)
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-6 hidden md:block">Discover</h1>
        <DiscoverClient 
          userId={user.id} 
          initialPending={pendingRequests || []}
          initialBlocked={blockedUsers as { id: string; profile: { id: string; username: string; unique_id: string; avatar_url: string | null } }[]}
          blockedUserIds={Array.from(blockedUserIds)}
          sentRequestIds={Array.from(sentRequestIds)}
          friendIds={Array.from(friendIds)}
        />
      </div>
    </div>
  );
}
