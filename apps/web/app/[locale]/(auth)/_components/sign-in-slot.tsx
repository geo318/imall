"use client";

import { Input as ClerkInput, Label as ClerkLabel, Field } from "@clerk/elements/common";
import * as SignIn from "@clerk/elements/sign-in";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@repo/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useClerkReady } from "@/app/_components/clerk-provider-slot-client";
import { defaultLocale } from "@/i18n/config";
import { Link } from "@/i18n/navigation.client";
import { useLocale } from "@/i18n/provider";
import { FacebookIcon } from "./facebook-icon";
import { GoogleIcon } from "./google-icon";
import { SignInSkeleton } from "./sign-in-skeleton";

function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const clerk = useClerk();
  const locale = useLocale();
  const localePrefix = locale === defaultLocale ? "" : `/${locale}`;
  const signInPath = `${localePrefix}/sign-in`;

  const handleOAuth = async (provider: "google" | "facebook") => {
    if (!clerk?.client) return;
    await clerk.client.signIn.authenticateWithRedirect({
      strategy: `oauth_${provider}`,
      redirectUrl: `${globalThis.location.origin}${localePrefix}/`,
      redirectUrlComplete: `${globalThis.location.origin}${localePrefix}/`,
    });
  };

  return (
    <SignIn.Root routing="path" path={signInPath}>
      <SignIn.Step name="start">
        <div className="space-y-6">
          {/* OAuth Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuth("google")}
              className="w-full h-11 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
            >
              <GoogleIcon className="w-5 h-5 mr-2" />
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuth("facebook")}
              className="w-full h-11 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
            >
              <FacebookIcon className="w-5 h-5 mr-2" />
              Facebook
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">Or continue with email</span>
            </div>
          </div>

          {/* Email Input */}
          <div className="space-y-2">
            <Field name="identifier">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                Email address
              </ClerkLabel>
              <ClerkInput
                type="email"
                placeholder="name@example.com"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </Field>
          </div>

          {/* Continue Button */}
          <SignIn.Action submit asChild>
            <Button
              type="submit"
              className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
            >
              Continue
            </Button>
          </SignIn.Action>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-slate-600">
            Don't have an account?{" "}
            <Link
              href="/sign-up"
              className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </SignIn.Step>

      <SignIn.Step name="verifications">
        <SignIn.Strategy name="email_code">
          <div className="space-y-6">
            <div className="space-y-2">
              <Field name="code">
                <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                  Verification code
                </ClerkLabel>
                <ClerkInput
                  type="text"
                  placeholder="Enter 6-digit code"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </Field>
            </div>

            <SignIn.Action submit asChild>
              <Button
                type="submit"
                className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
              >
                Verify
              </Button>
            </SignIn.Action>

            <SignIn.Action navigate="start" asChild>
              <Button type="button" variant="ghost" className="w-full h-11">
                Back
              </Button>
            </SignIn.Action>
          </div>
        </SignIn.Strategy>

        <SignIn.Strategy name="password">
          <div className="space-y-6">
            <div className="space-y-2">
              <Field name="password">
                <div className="flex items-center justify-between mb-2">
                  <ClerkLabel className="text-sm font-medium text-foreground">Password</ClerkLabel>
                  <SignIn.Action navigate="forgot-password" asChild>
                    <button
                      type="button"
                      className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </SignIn.Action>
                </div>
                <div className="relative">
                  <ClerkInput
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-11 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </Field>
            </div>

            <SignIn.Action submit asChild>
              <Button
                type="submit"
                className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
              >
                Sign In
              </Button>
            </SignIn.Action>

            <SignIn.Action navigate="start" asChild>
              <Button type="button" variant="ghost" className="w-full h-11">
                Back
              </Button>
            </SignIn.Action>
          </div>
        </SignIn.Strategy>
      </SignIn.Step>

      <SignIn.Step name="forgot-password">
        <div className="space-y-6">
          <div className="space-y-2">
            <Field name="identifier">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                Email address
              </ClerkLabel>
              <ClerkInput
                type="email"
                placeholder="name@example.com"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </Field>
          </div>

          <SignIn.Action submit asChild>
            <Button
              type="submit"
              className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
            >
              Send reset link
            </Button>
          </SignIn.Action>

          <SignIn.Action navigate="start" asChild>
            <Button type="button" variant="ghost" className="w-full h-11">
              Back
            </Button>
          </SignIn.Action>
        </div>
      </SignIn.Step>
    </SignIn.Root>
  );
}

export function SignInSlot() {
  const [mounted, setMounted] = useState(false);
  const clerkReady = useClerkReady();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Wait for both client mount and Clerk to be ready before rendering Clerk Elements
  if (!mounted || !clerkReady) {
    return <SignInSkeleton />;
  }

  return <SignInForm />;
}
