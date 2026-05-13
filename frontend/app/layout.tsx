import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coldplay Chat",
  description: "A Coldplay-focused chat interface powered by your local backend.",
  icons: {
    icon: "https://eustore.coldplay.com/cdn/shop/files/heart_favicon.png?v=1770660766",
    shortcut: "https://eustore.coldplay.com/cdn/shop/files/heart_favicon.png?v=1770660766",
    apple: "https://eustore.coldplay.com/cdn/shop/files/heart_favicon.png?v=1770660766"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
