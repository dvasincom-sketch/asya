import { redirect } from "next/navigation";

export default function Home() {
  // На шаге 2 главная ведёт сразу в чат. Позже здесь будет лендинг ася.онлайн + вход.
  redirect("/chat");
}
