# Ася — приложение (Next.js + TypeScript + Prisma)

Каркас продукта на зафиксированном стеке.

**Готово:**
- **Шаги 1–2** — чат `/chat` на дизайне из v3, подключён к Timeweb AI Gateway со стримингом и кризисным фильтром.
- **Шаг 3** — PostgreSQL через Prisma + **вход**: Telegram Login и телефон по SMS-коду, серверные сессии, экраны `/login` и `/account`.

## Стек
Next.js (App Router) · React · TypeScript · Prisma · PostgreSQL · Timeweb AI Gateway · (далее) grammY, ЮKassa.

## Структура
```
src/
├─ app/
│  ├─ layout.tsx · globals.css       # фон-аврора, темы, дизайн-токены
│  ├─ page.tsx                       # → /chat
│  ├─ chat/page.tsx                  # чат с Асей
│  ├─ login/page.tsx                 # вход: Telegram + телефон
│  ├─ account/page.tsx               # кабинет (защищён сессией)
│  └─ api/
│     ├─ chat/route.ts               # прокси к Timeweb: стрим + кризис
│     ├─ me/route.ts                 # текущий пользователь
│     └─ auth/
│        ├─ telegram/route.ts        # проверка подписи Telegram
│        ├─ otp/request/route.ts     # отправка SMS-кода
│        ├─ otp/verify/route.ts      # проверка кода + вход
│        └─ logout/route.ts
├─ components/                       # Orb, ChatWindow, CrisisCard, LogoutButton
└─ lib/                              # prompt, crisis, timeweb, prisma, auth, telegram, sms, otp, phone
prisma/schema.prisma                 # User, Message, Memory, Consent, Subscription, CrisisEvent, OtpCode, Session
```

## Настройка окружения
```bash
cp .env.example .env
```
Заполни:
- `TIMEWEB_API_KEY`, `TIMEWEB_MODEL` — доступ к модели.
- `DATABASE_URL` — строка подключения PostgreSQL.
- `TELEGRAM_BOT_TOKEN` — токен бота от @BotFather; у бота задай домен командой `/setdomain` (для локали подойдёт `localhost`).
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` — юзернейм бота без `@`.
- `SMS_API_ID` — api_id от sms.ru. **Если пусто — код входа печатается в лог сервера** (удобно тестировать без реальных SMS).

## База данных
```bash
npm run prisma:generate     # сгенерировать клиент
npm run prisma:migrate      # создать таблицы (prisma migrate dev)
```

## Запуск
```bash
npm install
npm run dev                 # http://localhost:3000
```
- `/chat` — чат (работает и без входа).
- `/login` — вход через Telegram или телефон.
- `/account` — кабинет (редиректит на `/login`, если не вошёл).

## Как проверить вход
- **Телефон:** на `/login` введи номер → «Получить код». Без `SMS_API_ID` код появится в логе `npm run dev` → введи его → попадёшь в `/account`.
- **Telegram:** нужен реальный бот с заданным доменом; кнопка входа появится, если задан `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.

## Дальше по плану
4. Память и история разговоров (с учётом тумблеров приватности).
5. Экран настроек/приватности (порт v3): удаление в один клик, экспорт.
6. Подписка «Забота+» + ЮKassa + платный гейт.
7. Онбординг + согласие (152-ФЗ).
8. Telegram-бот на grammY — тот же backend и БД.

## Заметки
- Ключи только в `.env` (в `.gitignore`).
- Кризисный фильтр (слой 1) — в `src/lib/crisis.ts`, номера помощи проверить перед запуском.
- Сессия — непрозрачный токен в httpOnly-куке `asya_session`, запись в таблице `Session`.
