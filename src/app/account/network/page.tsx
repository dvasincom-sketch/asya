import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import NetworkScreen from "@/components/NetworkScreen";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <NetworkScreen />;
}
