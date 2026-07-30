// Реквизиты и версия документов. Заполняются переменными окружения,
// чтобы юридические страницы не требовали правки кода.
export const LEGAL = {
  // Версия согласия — при изменении документов поднимай дату, тогда согласие спросим заново.
  version: "2026-07-30",
  service: "Ася",
  site: process.env.NEXT_PUBLIC_SITE_HOST || "ася.online",
  operator: process.env.NEXT_PUBLIC_OPERATOR_NAME || "ИП (укажите ФИО)",
  inn: process.env.NEXT_PUBLIC_OPERATOR_INN || "(укажите ИНН)",
  ogrnip: process.env.NEXT_PUBLIC_OPERATOR_OGRNIP || "(укажите ОГРНИП)",
  address: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS || "(укажите адрес)",
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "hello@asya.online",
  price: process.env.NEXT_PUBLIC_PLUS_PRICE || "300 ₽",
  updated: "30 июля 2026 года",
};
