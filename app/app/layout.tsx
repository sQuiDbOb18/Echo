import "./globals.css";
import { Providers } from "../components/providers";

export const metadata = {
  title: "Echo | Agentic market intelligence",
  description: "Follow mock tokenized-stock strategies on Base Sepolia.",
  other: {
    "base:app_id": "6aa0cf75450b6ef2717403b2",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
