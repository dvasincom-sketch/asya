import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SkillsScreen from "@/components/SkillsScreen";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <SkillsScreen />;
}
