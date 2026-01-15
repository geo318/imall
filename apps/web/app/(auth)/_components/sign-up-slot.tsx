"use client";

import { Input as ClerkInput, Label as ClerkLabel, Field } from "@clerk/elements/common";
import * as SignUp from "@clerk/elements/sign-up";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@repo/ui/button";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useClerkReady } from "@/app/_components/clerk-provider-slot-client";
import { GoogleIcon } from "./google-icon";
import { SignUpSkeleton } from "./sign-up-skeleton";

function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const clerk = useClerk();

  const handleOAuth = async (provider: "google") => {
    if (!clerk?.client) return;

    // Try oauth_ prefix first (most common)
    const strategies = [`oauth_${provider}`, provider] as const;

    for (const strategy of strategies) {
      try {
        await clerk.client.signUp.authenticateWithRedirect({
          // @ts-expect-error - Strategy name may vary based on Clerk configuration
          strategy: strategy as "oauth_google" | "oauth_facebook" | "google" | "facebook",
          redirectUrl: `${globalThis.location.origin}/`,
          redirectUrlComplete: `${globalThis.location.origin}/`,
        });
        return; // Success, exit
      } catch (error: unknown) {
        // If it's not a strategy name error, re-throw
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("does not match one of the allowed values")) {
          throw error;
        }
      }
    }

    console.error(
      `OAuth authentication failed for ${provider}. Make sure it's enabled in Clerk Dashboard.`,
    );
  };

  return (
    <SignUp.Root routing="path" path="/sign-up">
      <SignUp.Step name="start">
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

          {/* Name Input */}
          <div className="space-y-2">
            <Field name="firstName">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                First Name
              </ClerkLabel>
              <ClerkInput
                type="text"
                placeholder="John"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </Field>
          </div>

          {/* Last Name Input */}
          <div className="space-y-2">
            <Field name="lastName">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                Last Name
              </ClerkLabel>
              <ClerkInput
                type="text"
                placeholder="Doe"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </Field>
          </div>

          {/* Email Input */}
          <div className="space-y-2">
            <Field name="emailAddress">
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

          {/* Password Input */}
          <div className="space-y-2">
            <Field name="password">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                Password
              </ClerkLabel>
              <div className="relative">
                <ClerkInput
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
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

          {/* Continue Button */}
          <SignUp.Action submit asChild>
            <Button
              type="submit"
              className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
            >
              Continue
            </Button>
          </SignUp.Action>

          {/* Sign In Link */}
          <p className="text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </SignUp.Step>

      <SignUp.Step name="verifications">
        <SignUp.Strategy name="email_code">
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

            <SignUp.Action submit asChild>
              <Button
                type="submit"
                className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
              >
                Verify
              </Button>
            </SignUp.Action>

            <SignUp.Action navigate="start" asChild>
              <Button type="button" variant="ghost" className="w-full h-11">
                Back
              </Button>
            </SignUp.Action>
          </div>
        </SignUp.Strategy>
      </SignUp.Step>
    </SignUp.Root>
  );
}

export function SignUpSlot() {
  const [mounted, setMounted] = useState(false);
  const clerkReady = useClerkReady();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Wait for both client mount and Clerk to be ready before rendering Clerk Elements
  if (!mounted || !clerkReady) {
    return <SignUpSkeleton />;
  }

  return <SignUpForm />;
}
