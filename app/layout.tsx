import "./globals.css";
import { Providers } from "./providers";
import { Header } from "../components/Header";
import { Press_Start_2P } from "next/font/google";
import type { Metadata } from "next";
import { MatrixBg } from "../components/MatrixBg";

const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

export const metadata = {
  title: "BRRR Raffle Arcade",
  description: "USDC raffles • BRRR staking rewards",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={pixel.variable}>
      <body>
        <MatrixBg />
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}

