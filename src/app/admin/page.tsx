"use client";

import { useEffect } from "react";

// Единая админка теперь на /admin/community. Старый адрес — редирект (с сохранением query, в т.ч. ?key=).
export default function AdminIndex() {
  useEffect(() => {
    const q = window.location.search || "";
    window.location.replace(`/admin/community${q}`);
  }, []);
  return null;
}
