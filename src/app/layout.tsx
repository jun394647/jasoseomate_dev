import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import SessionProvider from "@/components/SessionProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "자소서메이트",
  description: "나의 경험과 우수 자소서를 참고해 자기소개서를 작성해주는 개인용 도우미",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex bg-[#fcfcfb] dark:bg-[#0d0d0d] text-[#0b0b0b] dark:text-white">
        <SessionProvider>
          <Sidebar />
          <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pt-14 md:pt-0">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">{children}</div>
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
