"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Info, Send, Phone, MoreVertical, Paperclip, ChevronLeft, UserMinus, Ban } from "lucide-react";
import { clsx } from "clsx";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { Message, Profile } from "@/lib/types";

export default function ChatClient({ 
  currentUserId, 
  otherUser, 
  initialMessages 
}: { 
  currentUserId: string, 
  otherUser: Profile, 
  initialMessages: Message[] 
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const chatId = [currentUserId, otherUser.id].sort().join("-");

  const handleUnfriend = async () => {
    // 1. Delete friendship
    const { error: relError } = await supabase
      .from("friendships")
      .delete()
      .or(`and(user_id1.eq.${currentUserId},user_id2.eq.${otherUser.id}),and(user_id1.eq.${otherUser.id},user_id2.eq.${currentUserId})`);

    if (relError) {
      toast.error("Failed to unfriend");
      return;
    }

    // 2. Delete messages
    await supabase
      .from("messages")
      .delete()
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},receiver_id.eq.${currentUserId})`);

    toast.success("Unfriended and chat history cleared");
    router.push("/");
    router.refresh();
  };

  const handleBlock = async () => {
    // 1. Update relationship status to 'blocked'
    const { error: relError } = await supabase
      .from("friendships")
      .update({ status: "blocked" })
      .or(`and(user_id1.eq.${currentUserId},user_id2.eq.${otherUser.id}),and(user_id1.eq.${otherUser.id},user_id2.eq.${currentUserId})`);

    if (relError) {
      toast.error("Failed to block user");
      return;
    }

    // 2. Delete messages
    await supabase
      .from("messages")
      .delete()
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},receiver_id.eq.${currentUserId})`);

    toast.success("User blocked and chat history cleared");
    router.push("/");
    router.refresh();
  };

  // Scroll to bottom
  useEffect(() => {
    setMounted(true);
    if (mounted) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, otherUserTyping, mounted]);

  useEffect(() => {
    // 1. Messages Subscription
    const messageChannel = supabase.channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as Message;
          const isFromOther = newMessage.sender_id === otherUser.id && newMessage.receiver_id === currentUserId;
          const isFromSelf = newMessage.sender_id === currentUserId && newMessage.receiver_id === otherUser.id;
          
          if (isFromOther || isFromSelf) {
            setMessages((prev) => {
              if (prev.find(m => m.id === newMessage.id)) return prev;
              return [...prev, newMessage];
            });

            if (isFromOther) {
              supabase
                .from("messages")
                .update({ status: "seen", seen_at: new Date().toISOString() })
                .eq("id", newMessage.id)
                .then();
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          if (updatedMessage.sender_id === currentUserId || updatedMessage.receiver_id === currentUserId) {
            setMessages((prev) => prev.map(m => m.id === updatedMessage.id ? updatedMessage : m));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
        },
        () => {
          setMessages([]);
        }
      )
      .subscribe();

    // 2. Typing indicator
    const typingChannel = supabase.channel(`typing:${chatId}`);
    typingChannel
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload.userId === otherUser.id) {
          setOtherUserTyping(payload.payload.isTyping);
        }
      })
      .subscribe();

    // 3. Presence
    const presenceChannel = supabase.channel("online-users");
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        let found = false;
        for (const key in state) {
          const presences = state[key] as unknown as { user_id: string }[];
          if (presences.some((p) => p.user_id === otherUser.id)) {
            found = true;
            break;
          }
        }
        setIsOnline(found);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          });
        }
      });

    // 4. Mark unread as seen
    const markAsSeen = async () => {
      await supabase
        .from("messages")
        .update({ status: "seen", seen_at: new Date().toISOString() })
        .eq("receiver_id", currentUserId)
        .eq("sender_id", otherUser.id)
        .neq("status", "seen");
    };
    markAsSeen();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [supabase, currentUserId, otherUser.id, chatId]);

  // Typing broadcast
  useEffect(() => {
    const typingChannel = supabase.channel(`typing:${chatId}`);
    if (newMessage.length > 0 && !isTyping) {
      setIsTyping(true);
      typingChannel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: currentUserId, isTyping: true }
      });
    } else if (newMessage.length === 0 && isTyping) {
      setIsTyping(false);
      typingChannel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: currentUserId, isTyping: false }
      });
    }
  }, [newMessage, isTyping, currentUserId, chatId, supabase]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim()) return;

    const content = newMessage.trim();
    setNewMessage("");
    setIsTyping(false);

    const optimisticMessage: Message = {
      id: crypto.randomUUID(),
      sender_id: currentUserId,
      receiver_id: otherUser.id,
      content,
      image_url: null,
      status: "sent",
      delivered_at: null,
      seen_at: null,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMessage]);

    const { error } = await supabase
      .from("messages")
      .insert({
        id: optimisticMessage.id,
        sender_id: currentUserId,
        receiver_id: otherUser.id,
        content,
        status: "sent",
      });

    if (error) {
      toast.error("Failed to send message");
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be less than 5MB");
      return;
    }

    setUploading(true);
    const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
    const filePath = `${currentUserId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("chat_images")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Failed to upload image");
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("chat_images")
      .getPublicUrl(filePath);

    const optimisticImageMessage: Message = {
      id: crypto.randomUUID(),
      sender_id: currentUserId,
      receiver_id: otherUser.id,
      content: "",
      image_url: publicUrlData.publicUrl,
      created_at: new Date().toISOString(),
      status: "sent",
      delivered_at: null,
      seen_at: null,
    };
    setMessages(prev => [...prev, optimisticImageMessage]);

    const { error } = await supabase
      .from("messages")
      .insert({
        id: optimisticImageMessage.id,
        sender_id: currentUserId,
        receiver_id: otherUser.id,
        content: "",
        image_url: publicUrlData.publicUrl,
        status: "sent",
      });

    if (error) {
      toast.error("Failed to send image");
      setMessages(prev => prev.filter(m => m.id !== optimisticImageMessage.id));
    }
    
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      <LayoutGroup>
        {/* Header */}
        <header className="h-16 border-b border-neutral-200/60 flex items-center justify-between px-4 md:px-6 glass sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/" className="md:hidden -ml-1 p-1 text-neutral-500 hover:text-neutral-900 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <div className="relative">
              <Avatar className="w-10 h-10 border border-neutral-100">
                <AvatarImage src={otherUser.avatar_url || undefined} />
                <AvatarFallback className="bg-neutral-100 text-neutral-600">
                  {(otherUser.display_name || otherUser.username)?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className={clsx(
                "absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white rounded-full transition-colors",
                isOnline ? "bg-green-500 animate-pulse-subtle" : "bg-neutral-300"
              )}></span>
            </div>
            <div className="flex flex-col min-w-0">
              <h2 className="text-sm font-bold text-neutral-900 truncate tracking-tight">
                {otherUser.display_name || otherUser.username}
              </h2>
              <p className="text-[10px] text-neutral-500 font-medium tracking-tight">
                {otherUser.display_name ? `@${otherUser.username}` : (isOnline ? "Online now" : "Offline")}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-neutral-400">
            <Button variant="ghost" size="icon" className="hover:text-blue-500">
              <Phone className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="hover:text-neutral-900">
              <Info className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon", className: "hover:text-neutral-900" })}>
                <MoreVertical className="w-5 h-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleUnfriend} className="text-amber-600 focus:text-amber-600">
                  <UserMinus className="w-4 h-4 mr-2" />
                  Unfriend
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleBlock} className="text-red-600 focus:text-red-600 font-medium">
                  <Ban className="w-4 h-4 mr-2" />
                  Block User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-neutral-50/30 scroll-smooth">
          <AnimatePresence initial={false}>
            {messages.map((message) => {
              const isOwn = message.sender_id === currentUserId;
              return (
                <motion.div 
                  key={message.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={clsx("flex flex-col", isOwn ? "items-end" : "items-start")}
                >
                  <div 
                    className={clsx(
                      "max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm transition-all duration-200",
                      isOwn 
                        ? "bg-blue-500 text-white rounded-br-sm highlight-white/10" 
                        : "bg-white border border-neutral-200/60 text-neutral-900 rounded-bl-sm"
                    )}
                  >
                    {message.image_url && (
                      <div className="mb-2 relative rounded-xl overflow-hidden bg-neutral-100 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={message.image_url} 
                          alt="Shared image" 
                          className="max-w-full max-h-[300px] object-contain group-hover:scale-[1.02] transition-transform duration-300" 
                        />
                      </div>
                    )}
                    {message.content && <p className="text-[15px] leading-relaxed break-words">{message.content}</p>}
                    
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className={clsx(
                        "text-[10px]",
                        isOwn ? "text-blue-100/70" : "text-neutral-400"
                      )}>
                        {mounted ? format(new Date(message.created_at), "p") : "..."}
                      </span>
                      {isOwn && (
                        <span className="flex">
                          {message.status === "sent" && (
                            <svg className="w-3.5 h-3.5 text-blue-100/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {message.status === "delivered" && (
                            <svg className="w-3.5 h-3.5 text-blue-100/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7m-4 0l4 4L19 7" />
                            </svg>
                          )}
                          {message.status === "seen" && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7m-4 0l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {otherUserTyping && (
            <div className="flex items-start">
              <div className="bg-white border border-neutral-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </main>

        {/* Composer */}
        <footer className="p-4 bg-white border-t border-neutral-200 shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-end gap-2 max-w-4xl mx-auto">
            <input 
              type="file" 
              accept="image/*"
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="text-neutral-500 shrink-0 h-10 w-10 hover:bg-neutral-100"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <span className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin"/> : <Paperclip className="w-5 h-5" />}
            </Button>
            <div className="flex-1 relative">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Message..."
                className="pr-12 bg-neutral-50 border-neutral-200 rounded-full h-10 shadow-none focus-visible:ring-1 focus-visible:ring-blue-500"
              />
            </div>
            <Button 
              type="submit" 
              size="icon" 
              className="shrink-0 h-10 w-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
              disabled={(!newMessage.trim() && !fileInputRef.current?.files?.length) || uploading}
            >
              <Send className="w-4 h-4 ml-0.5" />
            </Button>
          </form>
        </footer>
      </LayoutGroup>
    </div>
  );
}
