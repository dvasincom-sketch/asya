import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SessionsScreen from "@/components/SessionsScreen";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <SessionsScreen />;
}
