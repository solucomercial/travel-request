import type { Metadata } from "next";
import { Archivo_Black, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const appHeading = Archivo_Black({
  variable: "--font-app-heading",
  weight: "400",
  subsets: ["latin"],
});

const appSans = IBM_Plex_Sans({
  variable: "--font-app-sans",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portal de Viagens Corporativas",
  description: "Sistema interno de solicitacao, aprovacao e compra de viagens.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${appHeading.variable} ${appSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
