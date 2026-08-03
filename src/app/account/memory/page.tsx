import AuthGate from "@/components/AuthGate";
import { getCurrentUser } from "@/lib/auth";
import MemoryScreen from "@/components/MemoryScreen";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthGate />;
  return <MemoryScreen />;
}
