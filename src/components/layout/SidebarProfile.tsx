"use client";

import { useState } from "react";
import { Profile } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { ProfileEditModal } from "@/components/profile/ProfileEditModal";
import { SignOutButton } from "@/components/auth/SignOutButton";

export function SidebarProfile({ profile }: { profile: Profile }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <>
      <div className="p-4 flex items-center justify-between border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => setIsEditModalOpen(true)}>
            <Avatar className="w-10 h-10 border border-neutral-100 group-hover:opacity-80 transition-opacity">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-neutral-900 text-white text-xs">
                {profile.display_name?.[0]?.toUpperCase() || profile.username[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-full">
              <Settings className="w-3 h-3 text-white" />
            </div>
          </div>
          <div className="text-sm">
            <p className="font-bold text-neutral-900 leading-none mb-1 truncate max-w-[120px]">
              {profile.display_name || profile.username}
            </p>
            <p className="text-[10px] text-neutral-400 font-mono tracking-tight">
              {profile.unique_id}
            </p>
          </div>
        </div>
        <SignOutButton />
      </div>

      <ProfileEditModal
        profile={profile}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </>
  );
}
