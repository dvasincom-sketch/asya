import { getCurrentUser } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";
import RoomScreen from "@/components/RoomScreen";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return <AuthGate />;
  return <RoomScreen roomId={params.id} />;
}
