import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import PlusScreen from "@/components/PlusScreen";

export const dynamic = "force-dynamic";

export default async function PlusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <PlusScreen />;
}
