import { getCurrentUser } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";
import RoomsMessenger from "@/components/RoomsMessenger";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthGate />;
  return <RoomsMessenger />;
}
