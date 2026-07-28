import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ася — поговорить",
  description: "Тёплая подружка, с которой можно поговорить — когда тревожно, грустно или просто хочется, чтобы услышали.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="dusk">
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
