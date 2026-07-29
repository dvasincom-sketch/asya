import type { Metadata, Viewport } from "next";
import { Unbounded } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const display = Unbounded({
  subsets: ["cyrillic", "latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ася — поговорить",
  description: "Тёплая подружка, с которой можно поговорить — когда тревожно, грустно или просто хочется, чтобы услышали.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Ася" },
};

export const viewport: Viewport = {
  themeColor: "#181120",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="dusk" className={display.variable}>
      <head>
        {/* Telegram Mini App SDK — до гидрации, чтобы window.Telegram был доступен на старте. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
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
