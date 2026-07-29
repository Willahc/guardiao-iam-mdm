import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/og.png`;
  return {
    title: "Guardião — Lifecycle de acessos",
    description: "Onboarding, mudanças e desligamentos auditáveis, combinando automações, simulações e tarefas manuais.",
    openGraph: {
      title: "Guardião — Lifecycle de acessos",
      description: "Controle admissões e desligamentos sem depender de planilha ou de uma suíte IGA enterprise.",
      images: [{ url: socialImage, width: 1536, height: 1024, alt: "Guardião Lifecycle de acessos" }],
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
