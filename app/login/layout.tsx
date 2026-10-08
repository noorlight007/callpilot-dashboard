import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: {
    absolute: "Sign in | CallPilot",
  },
  description:
    "Sign in to your CallPilot account to manage your phone lines, AI screening calls and ATS sync.",
  alternates: {
    canonical: "https://panel.callpilot.pro/login",
  },
  robots: {
    index: true,
    follow: false,
  }, // login is the only indexable panel URL
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
