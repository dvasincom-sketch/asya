// Извлечение текста из PDF без внешних сервисов: файл не покидает наш сервер.
// Сканы и фотографии здесь не распознаются — для них нужен OCR (пока не подключён).

export type PdfResult = { text: string; pages: number };

export async function extractPdfText(buf: Buffer): Promise<PdfResult> {
  // Динамический импорт: pdfjs — ESM-модуль, тянем его только когда реально нужен.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // В Node воркер не нужен — отключаем, иначе pdfjs попытается его загрузить.
  const gt = pdfjs.getDocument({
    data: new Uint8Array(buf),
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  });
  const doc = await gt.promise;

  const parts: string[] = [];
  const max = Math.min(doc.numPages, 30); // разумный предел на один документ
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Собираем строки: pdfjs отдаёт куски текста, склеиваем с переносами по вертикали.
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const item of content.items as { str?: string; transform?: number[] }[]) {
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
    page.cleanup();
  }

  await doc.destroy().catch(() => {});
  return { text: parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim(), pages: doc.numPages };
}
