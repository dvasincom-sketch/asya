# Ася — приложение (Next.js + TypeScript + Prisma)

Каркас продукта на зафиксированном стеке. Сейчас реализованы **шаги 1–2**: рабочий чат `/chat` на дизайне из v3, подключённый к Timeweb AI Gateway со стримингом и кризисным фильтром. Схема БД (Prisma) уже лежит готовой под следующие шаги (вход, память, история, подписка, бот).

## Стек
Next.js (App Router) · React · TypeScript · Prisma · PostgreSQL · Timeweb AI Gateway · (далее) grammY, ЮKassa.

## Структура
```
src/
├─ app/
│  ├─ layout.tsx          # общий фон-аврора, темы
│  ├─ page.tsx            # → /chat (позже: лендинг ася.онлайн)
│  ├─ globals.css         # дизайн-токены из v3
│  ├─ chat/page.tsx       # экран чата
│  └─ api/chat/route.ts   # прокси к Timeweb: стрим + кризис
├─ components/            # Orb, ChatWindow, CrisisCard
└─ lib/                   # prompt, crisis, timeweb, prisma
prisma/schema.prisma      # модели БД (User, Message, Memory, Consent, Subscription, ...)
```

## Запуск (шаги 1–2, только чат — БД не нужна)
```bash
cp .env.example .env       # впиши TIMEWEB_API_KEY и TIMEWEB_MODEL
npm install
npm run dev                # http://localhost:3000  → /chat
```
Точное имя модели узнать: `curl https://api.timeweb.ai/v1/models -H "Authorization: Bearer $TIMEWEB_API_KEY"`.

## Когда подключим БД (шаг 3+)
```bash
# заполни DATABASE_URL в .env (PostgreSQL)
npm run prisma:generate
npm run prisma:migrate     # создаст таблицы
```

## Дальше по плану (документ «Стек и архитектура»)
3. Вход: Telegram Login + телефон-OTP, сессии.
4. Память и история (с учётом тумблеров приватности).
5. Экран настроек/приватности (порт v3): удаление в один клик, экспорт.
6. Подписка «Забота+» + ЮKassa + платный гейт.
7. Онбординг + согласие (152-ФЗ).
8. Telegram-бот на grammY — тот же backend и БД.

## Заметки
- Ключи только в `.env`, во фронт не попадают (чат ходит через свой `/api/chat`).
- Кризисный фильтр (слой 1) срабатывает до вызова модели; номера помощи — в `src/lib/crisis.ts`, проверить перед запуском.
- Дизайн — из прототипа v3; экраны онбординга/истории/настроек переносятся компонентами на следующих шагах.
