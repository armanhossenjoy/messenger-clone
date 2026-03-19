import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatClient from "./chat-client";

export default async function ChatPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const otherUserId = params.id;

  // Verify friendship
  const { data: friendship } = await supabase
    .from("friendships")
    .select("status")
    .or(`and(user_id1.eq.${user.id},user_id2.eq.${otherUserId}),and(user_id1.eq.${otherUserId},user_id2.eq.${user.id})`)
    .eq("status", "accepted")
    .single();

  if (!friendship) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-500">
        You must be friends to chat.
      </div>
    );
  }

  // Get other user's profile
  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", otherUserId)
    .single();

  // Load initial messages
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
    .order("created_at", { ascending: true })
    .limit(50);

  return (
    <ChatClient 
      currentUserId={user.id} 
      otherUser={otherProfile} 
      initialMessages={messages || []} 
    />
  );
}
