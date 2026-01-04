'use client';

import { SignUp } from "@clerk/nextjs";

const appearance = {
  variables: {
    colorPrimary: "#0f172a",
    colorText: "#0f172a",
    colorBackground: "#f8fafc",
    colorInputBackground: "#ffffff",
  },
  elements: {
    card: "shadow-xl border border-slate-200",
    formButtonPrimary: "bg-slate-900 hover:bg-slate-800",
    formFieldInput: "bg-white border-slate-200 focus:ring-slate-900",
    footerActionLink: "text-slate-900 hover:text-slate-700",
  },
} as const;

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          appearance={appearance}
          afterSignUpUrl="/"
        />
      </div>
    </div>
  );
}
