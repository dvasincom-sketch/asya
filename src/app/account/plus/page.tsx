import AuthGate from "@/components/AuthGate";
import { getCurrentUser } from "@/lib/auth";
import PlusScreen from "@/components/PlusScreen";

export const dynamic = "force-dynamic";

export default async function PlusPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthGate />;
  return <PlusScreen />;
}
