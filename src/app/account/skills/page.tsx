import AuthGate from "@/components/AuthGate";
import { getCurrentUser } from "@/lib/auth";
import SkillsScreen from "@/components/SkillsScreen";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthGate />;
  return <SkillsScreen />;
}
