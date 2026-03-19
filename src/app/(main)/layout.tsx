import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar user={user} profile={profile} />
      <main className="flex-1 flex flex-col bg-neutral-50/50 relative">
        {children}
      </main>
    </div>
  );
}
