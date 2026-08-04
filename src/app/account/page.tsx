import { getCurrentUser } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";
import ProfileScreen from "@/components/ProfileScreen";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthGate />;
  return <ProfileScreen />;
}
