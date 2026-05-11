import { Geist, Geist_Mono, Caveat } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "../components/UIElements";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
});

export const metadata = {
  title: "[RPG] Bloodbath",
  description: "The bath of blood shall start!",
  icons: {
    icon: "/app/icon.png",
    shortcut: "/app/icon.png",
    apple: "/app/icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} antialiased`}>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}