// Извлечение текста из PDF без внешних сервисов: файл не покидает наш сервер.
// Используем unpdf — сборку pdf.js без зависимостей от браузерного окружения
// (обычный pdfjs-dist в серверной сборке Next спотыкается на DOM и воркере).
// Сканы и фотографии здесь не распознаются — для них нужен OCR (пока не подключён).

export type PdfResult = { text: string; pages: number };

// Подстраховки для старых версий Node: pdf.js местами использует свежие методы.
function ensureGlobals(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  const P = Promise as unknown as { withResolvers?: unknown };
  if (typeof P.withResolvers !== "function") {
    P.withResolvers = function withResolvers<T>() {
      let resolve!: (v: T | PromiseLike<T>) => void;
      let reject!: (e?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }
  // Эти классы нужны только для отрисовки; для текста достаточно пустых заглушек.
  if (typeof g.DOMMatrix === "undefined") {
    g.DOMMatrix = class {
      constructor() {
        /* заглушка */
      }
    };
  }
  if (typeof g.Path2D === "undefined") {
    g.Path2D = class {
      constructor() {
        /* заглушка */
      }
    };
  }
}

type TextItem = { str?: string; transform?: number[] };

export async function extractPdfText(buf: Buffer): Promise<PdfResult> {
  ensureGlobals();

  const { getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(buf));

  const parts: string[] = [];
  const max = Math.min(doc.numPages, 30); // разумный предел на один документ
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // Собираем строки: pdf.js отдаёт куски текста, склеиваем по вертикальной позиции —
    // так сохраняется структура таблицы «показатель — результат — норма».
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const item of content.items as TextItem[]) {
      const s = item.str ?? "";
      const y = item.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        if (line.trim()) lines.push(line.trim());
        line = "";
      }
      line += (line && !line.endsWith(" ") && s && !s.startsWith(" ") ? " " : "") + s;
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    parts.push(lines.join("\n"));
  }

  return { text: parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim(), pages: doc.numPages };
}
