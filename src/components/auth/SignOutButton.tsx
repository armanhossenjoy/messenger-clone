"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }} 
      title="Sign Out" 
      className="hover:bg-neutral-100 text-neutral-500 shrink-0"
    >
      <LogOut className="w-4 h-4" />
    </Button>
  );
}
