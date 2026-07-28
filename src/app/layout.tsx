import type { Metadata } from "next";
import { Unbounded } from "next/font/google";
import "./globals.css";

// Футуристичный дисплейный шрифт с поддержкой кириллицы — для главной.
const display = Unbounded({
  subsets: ["cyrillic", "latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ася — поговорить",
  description: "Тёплая подружка, с которой можно поговорить — когда тревожно, грустно или просто хочется, чтобы услышали.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="dusk" className={display.variable}>
      <body>
        <div className="ambient">
          <span className="a1" />
          <span className="a2" />
          <span className="a3" />
        </div>
        {children}
      </body>
    </html>
  );
}
