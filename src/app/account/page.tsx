import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Orb } from "@/components/Orb";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const who = user.tgId ? `Telegram · ${String(user.tgId)}` : user.phone ? `Телефон · ${user.phone}` : user.id;

  return (
    <div className="app auth">
      <div className="auth-card">
        <Orb className="auth-orb" />
        <h2>С возвращением 🌙</h2>
        <p className="sub">Ты вошла. Здесь скоро появится «Забота+», история и настройки приватности.</p>
        <div className="account-who">{who}</div>
        <a className="btn-primary" href="/chat">Открыть чат с Асей</a>
        <a className="btn-ghost" href="/account/settings">Настройки и приватность</a>
        <LogoutButton />
      </div>
    </div>
  );
}
