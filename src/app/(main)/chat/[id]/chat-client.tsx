"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Info, Send, Phone, MoreVertical, Paperclip } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
};

export default function ChatClient({ 
  currentUserId, 
  otherUser, 
  initialMessages 
}: { 
  currentUserId: string, 
  otherUser: { id: string; username: string; avatar_url: string | null }, 
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
  
  const chatId = [currentUserId, otherUser.id].sort().join("-");

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherUserTyping]);

  useEffect(() => {
    // 1. Messages Subscription
    const messageChannel = supabase.channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${otherUser.id}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();

    // 2. Typing indicator broadcast
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
          if (presences.some(p => p.user_id === otherUser.id)) {
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

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [supabase, currentUserId, otherUser.id, chatId]);

  // Handle typing broadcast
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
    if (!newMessage.trim() && !fileInputRef.current?.files?.length) return;

    const content = newMessage.trim();
    setNewMessage("");
    setIsTyping(false);

    // Optimistic update for text
    const optimisticMessage: Message = {
      id: crypto.randomUUID(),
      sender_id: currentUserId,
      receiver_id: otherUser.id,
      content,
      image_url: null,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMessage]);

    // Send to Supabase
    const { error } = await supabase
      .from("messages")
      .insert({
        id: optimisticMessage.id,
        sender_id: currentUserId,
        receiver_id: otherUser.id,
        content
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
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${currentUserId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("chat_images")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Failed to upload image");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from("chat_images")
      .getPublicUrl(filePath);

    // Send message with image
    const { error } = await supabase
      .from("messages")
      .insert({
        sender_id: currentUserId,
        receiver_id: otherUser.id,
        content: "",
        image_url: data.publicUrl
      });

    if (error) {
      toast.error("Failed to send image message");
    } else {
      // Optimistic append
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        sender_id: currentUserId,
        receiver_id: otherUser.id,
        content: "",
        image_url: data.publicUrl,
        created_at: new Date().toISOString()
      }]);
    }
    
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="h-16 border-b border-neutral-200 flex items-center justify-between px-6 bg-white shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="w-10 h-10 border border-neutral-100">
              <AvatarImage src={otherUser.avatar_url || undefined} />
              <AvatarFallback className="bg-neutral-100 text-neutral-600">
                {otherUser.username?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className={clsx(
              "absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white rounded-full transition-colors",
              isOnline ? "bg-green-500" : "bg-neutral-300"
            )} />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-900 leading-none mb-1">{otherUser.username}</h2>
            <p className="text-xs text-neutral-500">{isOnline ? 'Active now' : 'Offline'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-neutral-400">
          <Button variant="ghost" size="icon" className="hover:text-blue-500">
            <Phone className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="hover:text-neutral-900">
            <Info className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="hover:text-neutral-900">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50/30">
        {messages.map((message) => {
          const isOwn = message.sender_id === currentUserId;
          return (
            <div key={message.id} className={clsx("flex flex-col", isOwn ? "items-end" : "items-start")}>
              <div 
                className={clsx(
                  "max-w-[70%] px-4 py-2 rounded-2xl",
                  isOwn 
                    ? "bg-blue-500 text-white rounded-br-sm" 
                    : "bg-white border border-neutral-200 text-neutral-900 rounded-bl-sm shadow-sm"
                )}
              >
                {message.image_url && (
                  <div className="mb-2 relative rounded-xl overflow-hidden bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={message.image_url || undefined} alt="Shared image" className="max-w-full max-h-[300px] object-contain" />
                  </div>
                )}
                {message.content && <p className="text-[15px] leading-relaxed break-words">{message.content}</p>}
              </div>
              <span className="text-[10px] text-neutral-400 mt-1 mx-1">
                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
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
      </div>

      {/* Composer */}
      <div className="p-4 bg-white border-t border-neutral-200 shrink-0">
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
      </div>
    </div>
  );
}
