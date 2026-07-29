import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/og.png`;
  return {
    title: "Guardião — Identity Control Plane",
    description: "Perfis de acesso por área, colaboradores e inventário de notebooks.",
    openGraph: {
      title: "Guardião — Identity Control Plane",
      description: "IAM, MDM e Zero Trust em um único plano operacional.",
      images: [{ url: socialImage, width: 1536, height: 1024, alt: "Guardião Identity Control Plane" }],
    },
    twitter: { card: "summary_large_image", images: [socialImage] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem("guardiao-theme");document.documentElement.dataset.theme=t||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch{}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
