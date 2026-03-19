"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, UserPlus, Check, X, Clock, ChevronLeft, Ban } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type Profile = {
  id: string;
  username: string;
  unique_id: string;
  avatar_url: string | null;
};

type PendingRequest = {
  id: string;
  profile: Profile;
};

export default function DiscoverClient({ 
  userId, 
  initialPending,
  initialBlocked = [],
  blockedUserIds: initialBlockedIds = [],
  sentRequestIds: initialSent,
  friendIds: initialFriends
}: { 
  userId: string, 
  initialPending: PendingRequest[],
  initialBlocked?: { id: string; profile: Profile }[],
  blockedUserIds?: string[],
  sentRequestIds: string[],
  friendIds: string[]
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>(initialPending);
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; profile: Profile }[]>(initialBlocked);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set(initialBlockedIds));
  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set(initialSent));
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set(initialFriends));
  useEffect(() => {
    setBlockedUserIds(new Set(blockedUsers.map(u => u.profile.id)));
  }, [blockedUsers]);
  
  const supabase = createClient();
  const router = useRouter();

  const handleUnblock = async (relationshipId: string) => {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", relationshipId);

    if (error) {
      toast.error("Failed to unblock user");
    } else {
      setBlockedUsers(prev => prev.filter(u => u.id !== relationshipId));
      toast.success("User unblocked");
      router.refresh();
    }
  };

  useEffect(() => {
    // Subscribe to incoming friend requests
    const channel = supabase.channel(`incoming-requests-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "friendships",
          filter: `user_id2=eq.${userId}`,
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", payload.new.user_id1)
            .single();
            
          if (profile) {
            setPendingRequests(prev => [
              { id: payload.new.id, profile },
              ...prev
            ]);
            toast.info(`New friend request from ${profile.username}!`);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "friendships",
        },
        (payload) => {
          setPendingRequests(prev => prev.filter(req => req.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", userId)
      .or(`username.ilike.%${query}%,unique_id.ilike.%${query}%`)
      .limit(10);
      
    if (error) {
      toast.error("Error searching users");
    } else {
      setResults(data || []);
    }
    setLoading(false);
  };

  const sendRequest = async (targetId: string) => {
    const { error } = await supabase
      .from("friendships")
      .insert({
        user_id1: userId,
        user_id2: targetId,
        status: "pending"
      });

    if (error) {
      toast.error("Could not send friend request");
    } else {
      toast.success("Friend request sent!");
      setSentRequestIds(prev => new Set(prev).add(targetId));
    }
  };

  const handleRequest = async (requestId: string, targetId: string, action: "accepted" | "blocked" | "rejected") => {
    if (action === "rejected") {
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", requestId);
      if (!error) {
        setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        toast.success("Friend request rejected");
      }
      return;
    }

    const { error } = await supabase
      .from("friendships")
      .update({ status: action })
      .eq("id", requestId);

    if (error) {
      toast.error(`Could not ${action} request`);
    } else {
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      if (action === "accepted") {
        setFriendIds(prev => new Set(prev).add(targetId));
        toast.success("Friend request accepted!");
        router.refresh();
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white md:bg-transparent">
      {/* Mobile Header */}
      <div className="md:hidden h-16 flex items-center px-4 border-b border-neutral-200 bg-white sticky top-0 z-10 shrink-0">
        <Link href="/" className="-ml-2 p-2 text-neutral-500 hover:text-neutral-900 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-lg font-bold text-neutral-900 ml-1">Discover</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">Pending Requests</h2>
            <div className="grid gap-4">
              {pendingRequests.map(req => (
                <Card key={req.id} className="p-4 flex items-center justify-between border-neutral-200 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={req.profile?.avatar_url || undefined} />
                      <AvatarFallback>{req.profile?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{req.profile?.username}</p>
                      <p className="text-xs text-neutral-500">{req.profile?.unique_id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleRequest(req.id, req.profile.id, "accepted")}>
                      <Check className="w-4 h-4 mr-1" /> Accept
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleRequest(req.id, req.profile.id, "rejected")}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Search Section */}
        <section>
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">Find Friends</h2>
          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <Input 
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by username or ID (e.g. johndoe#1234)" 
              className="bg-white"
            />
            <Button type="submit" disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </form>

          <div className="grid gap-4">
            {results.length === 0 && query && !loading && (
              <p className="text-neutral-500 text-sm">No users found.</p>
            )}
            <AnimatePresence>
              {results.map((profile, index) => {
                const isFriend = friendIds.has(profile.id);
                const isSent = sentRequestIds.has(profile.id);
                
                return (
                  <motion.div
                    key={profile.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="p-4 flex items-center justify-between border-neutral-200/60 shadow-sm transition-all hover:border-blue-200 hover:shadow-md">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback>{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{profile.username}</p>
                          <p className="text-xs text-neutral-500">{profile.unique_id}</p>
                        </div>
                      </div>
                      
                      {isFriend ? (
                        <Button variant="secondary" size="sm" disabled>
                          <Check className="w-4 h-4 mr-2" /> Friends
                        </Button>
                      ) : isSent ? (
                        <Button variant="outline" size="sm" disabled>
                          <Clock className="w-4 h-4 mr-2" /> Pending
                        </Button>
                      ) : blockedUserIds.has(profile.id) ? (
                        <Button variant="outline" size="sm" disabled className="text-red-500 border-red-200 bg-red-50">
                          <Ban className="w-4 h-4 mr-2" /> Blocked
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => sendRequest(profile.id)}>
                          <UserPlus className="w-4 h-4 mr-2" /> Add Friend
                        </Button>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>

        {/* Blocked Users Section */}
        {blockedUsers.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">Blocked Users</h2>
            <div className="grid gap-4">
              {blockedUsers.map(blocked => (
                <Card key={blocked.id} className="p-4 flex items-center justify-between border-neutral-200 shadow-sm opacity-75">
                  <div className="flex items-center gap-3">
                    <Avatar className="grayscale">
                      <AvatarImage src={blocked.profile?.avatar_url || undefined} />
                      <AvatarFallback>{blocked.profile?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-neutral-400 line-through">{blocked.profile?.username}</p>
                      <p className="text-xs text-neutral-500">{blocked.profile?.unique_id}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleUnblock(blocked.id)}>
                    Unblock
                  </Button>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
