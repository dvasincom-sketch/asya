// Клиент к API записи салона (insalon). Все вызовы идут с сервера Асей:
// так нет проблем с CORS, а адрес и настройки салона не попадают в браузер.
const BASE = (process.env.SALON_API_URL || "https://insalon.onrender.com").replace(/\/$/, "");
const API = `${BASE}/api/booking`;

export const SALON = {
  enabled: process.env.SALON_ENABLED !== "0",
  name: process.env.SALON_NAME || "HeadSPA Beauty",
  bookingUrl: `${BASE}/booking/`,
};

export type Category = { id: number; title: string; weight?: number };
export type Service = {
  id: number;
  title: string;
  price_min?: number;
  price_max?: number;
  seance_length?: number;
  comment?: string;
};
export type Staff = { id: number; name: string; specialization?: string; avatar?: string; rating?: number };

// Render засыпает, первый запрос может подниматься долго — даём щедрый таймаут.
async function req<T>(path: string, init?: RequestInit, timeoutMs = 45000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`salon ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function getCategories(): Promise<Category[]> {
  return req<Category[]>("/categories");
}

export function getServices(categoryId: number): Promise<Service[]> {
  return req<Service[]>(`/services?category_id=${categoryId}`);
}

export function getSlots(date: string, duration: number, serviceId: number): Promise<{ date: string; slots: string[] }> {
  return req(`/slots?date=${encodeURIComponent(date)}&duration=${duration}&service_id=${serviceId}`);
}

export function getStaff(datetime: string, duration: number, serviceId: number): Promise<Staff[]> {
  return req<Staff[]>(`/staff?datetime=${encodeURIComponent(datetime)}&duration=${duration}&service_id=${serviceId}`);
}

export function getNearestSlot(duration: number, serviceId = 0): Promise<{ date: string | null; time: string | null }> {
  return req(`/nearest_slot?duration=${duration}&service_id=${serviceId}`);
}

export type CreateBooking = {
  service_id: number;
  service_title: string;
  datetime: string; // "YYYY-MM-DD HH:MM"
  duration: number;
  total_price: number;
  master_id: number;
  master_name: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
};

export function createBooking(
  data: CreateBooking,
): Promise<{ booking_id: number; payment_url: string; confirmation_token: string | null }> {
  return req("/create", { method: "POST", body: JSON.stringify(data) }, 60000);
}
