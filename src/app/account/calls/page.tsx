import { getCurrentUser } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";
import CallsScreen from "@/components/CallsScreen";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthGate />;
  return <CallsScreen />;
}
