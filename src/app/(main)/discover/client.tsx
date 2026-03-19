"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, UserPlus, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";

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
  sentRequestIds: initialSent,
  friendIds: initialFriends
}: { 
  userId: string, 
  initialPending: PendingRequest[],
  sentRequestIds: string[],
  friendIds: string[]
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>(initialPending);
  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set(initialSent));
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set(initialFriends));
  
  const supabase = createClient();
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    
    // Search by username or unique_id
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
    <div className="space-y-8">
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
          {results.map(profile => {
            const isFriend = friendIds.has(profile.id);
            const isSent = sentRequestIds.has(profile.id);
            
            return (
              <Card key={profile.id} className="p-4 flex items-center justify-between border-neutral-200 shadow-sm transition-all hover:border-neutral-300">
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
                ) : (
                  <Button size="sm" onClick={() => sendRequest(profile.id)}>
                    <UserPlus className="w-4 h-4 mr-2" /> Add Friend
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
