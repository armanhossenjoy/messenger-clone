import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MainResponsiveLayout } from "@/components/layout/MainResponsiveLayout";

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
    <MainResponsiveLayout sidebar={<Sidebar user={user} profile={profile} />}>
      {children}
    </MainResponsiveLayout>
  );
}
