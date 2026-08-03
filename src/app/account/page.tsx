import { getCurrentUser } from "@/lib/auth";
import { Orb } from "@/components/Orb";
import { LogoutButton } from "@/components/LogoutButton";
import AuthGate from "@/components/AuthGate";
import { Icon, type IconName } from "@/components/Icon";

export const dynamic = "force-dynamic";

const TILES: { href: string; ic: IconName; t: string }[] = [
  { href: "/account/plus", ic: "plus", t: "Забота+" },
  { href: "/account/memory", ic: "memory", t: "То, что Ася о тебе знает" },
  { href: "/account/sessions", ic: "sessions", t: "Сессия с Асей" },
  { href: "/account/skills", ic: "skills", t: "Навыки" },
  { href: "/account/network", ic: "network", t: "Сеть — знакомства по согласию" },
  { href: "/account/health", ic: "health", t: "Здоровье" },
  { href: "/account/settings", ic: "settings", t: "Настройки и приватность" },
];

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthGate />;

  const who = user.tgId ? `Telegram · ${String(user.tgId)}` : user.phone ? `Телефон · ${user.phone}` : user.id;

  return (
    <div className="app auth">
      <div className="auth-card">
        <Orb className="auth-orb" />
        <h2>С возвращением 🌙</h2>
        <p className="sub">Твой личный кабинет: «Забота+», история и настройки приватности.</p>
        <div className="account-who">{who}</div>
        <a className="btn-primary" href="/chat">Открыть чат с Асей</a>
        <div className="account-tiles">
          {TILES.map((x) => (
            <a className="account-tile" href={x.href} key={x.href}>
              <span className="at-ic"><Icon name={x.ic} /></span>
              <span className="at-t">{x.t}</span>
              <span className="at-go">›</span>
            </a>
          ))}
        </div>
        <LogoutButton />
      </div>
    </div>
  );
}
