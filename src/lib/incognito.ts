"use client";

// Клиентское шифрование инкогнито-переписки (AES-GCM, Web Crypto).
// Ключ генерится и живёт ТОЛЬКО в браузере этого устройства (localStorage) и никогда
// не отправляется на сервер. Сервер хранит лишь нечитаемый шифротекст. Честная оговорка
// для интерфейса: чтобы ответить, модель читает сообщение в моменте — читаемого следа не остаётся.

function keyName(userId: string): string {
  return `asya_inc_key_${userId}`;
}

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function loadOrCreateKey(userId: string): Promise<CryptoKey | null> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return null;
  const name = keyName(userId);
  try {
    const raw = localStorage.getItem(name);
    if (raw) {
      return await crypto.subtle.importKey("raw", fromB64(raw), "AES-GCM", true, ["encrypt", "decrypt"]);
    }
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const exported = await crypto.subtle.exportKey("raw", key);
    localStorage.setItem(name, toB64(exported));
    return key;
  } catch {
    return null;
  }
}

export type IncCrypto = {
  encrypt: (text: string) => Promise<{ iv: string; data: string } | null>;
  decrypt: (iv: string, data: string) => Promise<string | null>;
};

// Готовит шифратор для инкогнито. Возвращает null, если Web Crypto недоступен —
// тогда UI работает в чисто эфемерном режиме (ничего не хранит).
export async function getIncCrypto(userId: string): Promise<IncCrypto | null> {
  const key = await loadOrCreateKey(userId);
  if (!key) return null;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  return {
    async encrypt(text: string) {
      try {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
        return { iv: toB64(iv.buffer), data: toB64(ct) };
      } catch {
        return null;
      }
    },
    async decrypt(iv: string, data: string) {
      try {
        const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(data));
        return dec.decode(pt);
      } catch {
        return null;
      }
    },
  };
}

// Забыть ключ устройства — после этого прежние инкогнито-записи уже не расшифровать (так и задумано).
export function forgetIncKey(userId: string): void {
  try {
    localStorage.removeItem(keyName(userId));
  } catch {
    /* ничего */
  }
}

// Забыть ВСЕ инкогнито-ключи на этом устройстве (для «стереть приватные записи» в настройках).
export function forgetAllIncKeys(): void {
  try {
    const rm: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("asya_inc_key_")) rm.push(k);
    }
    rm.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("asya_inc_seen");
  } catch {
    /* ничего */
  }
}
