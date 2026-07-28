import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SettingsScreen from "@/components/SettingsScreen";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <SettingsScreen />;
}
