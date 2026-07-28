import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import MemoryScreen from "@/components/MemoryScreen";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <MemoryScreen />;
}
