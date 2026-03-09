"use client";

import {
  Input as ClerkInput,
  Label as ClerkLabel,
  Field,
  FieldError,
  GlobalError,
} from "@clerk/elements/common";
import * as SignIn from "@clerk/elements/sign-in";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@repo/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { type FormEvent, type MouseEvent, useEffect, useState } from "react";
import { useClerkReady } from "@/app/_components/clerk-provider-slot-client";
import { Link } from "@/i18n/navigation.client";
import { useLocale, useTranslations } from "@/i18n/provider";
import { FacebookIcon } from "./facebook-icon";
import { GoogleIcon } from "./google-icon";
import { SignInSkeleton } from "./sign-in-skeleton";

function SignInForm() {
  const t = useTranslations();
  const [showPassword, setShowPassword] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [clientErrors, setClientErrors] = useState<
    Partial<Record<"identifier" | "code" | "password", string>>
  >({});
  const clerk = useClerk();
  const locale = useLocale();
  const localePrefix = `/${locale}`;
  const oauthCallbackPath = `${localePrefix}/sso-callback`;
  const oauthCompletePath = `${localePrefix}/`;

  const handleOAuth = async (provider: "google" | "facebook") => {
    if (!clerk?.client) return;
    setOauthError(null);
    try {
      await clerk.client.signIn.authenticateWithRedirect({
        strategy: `oauth_${provider}`,
        redirectUrl: `${globalThis.location.origin}${oauthCallbackPath}`,
        redirectUrlComplete: `${globalThis.location.origin}${oauthCompletePath}`,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[auth][sign-in] OAuth redirect failed", error);
      }
      setOauthError(t("auth.errors.oauthFailed"));
    }
  };

  const setClientError = (field: "identifier" | "code" | "password", message: string | null) => {
    setClientErrors((previous) => {
      if (!message) {
        if (!(field in previous)) return previous;
        const next = { ...previous };
        delete next[field];
        return next;
      }
      if (previous[field] === message) return previous;
      return { ...previous, [field]: message };
    });
  };

  const getValidationMessage = (
    input: HTMLInputElement,
    type: "email" | "password" | "otp",
  ): string | null => {
    if (input.validity.valueMissing) {
      return t("auth.validation.required");
    }

    if (type === "email" && input.validity.typeMismatch) {
      return t("auth.validation.invalidEmail");
    }

    if (type === "password" && input.validity.tooShort) {
      return t("auth.validation.passwordMin", { count: input.minLength });
    }

    if (
      type === "otp" &&
      (input.validity.tooShort || input.validity.tooLong || input.validity.patternMismatch)
    ) {
      return t("auth.validation.otpFormat");
    }

    return null;
  };

  const handleInputValidation =
    (field: "identifier" | "code" | "password", type: "email" | "password" | "otp") =>
    (event: FormEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      input.setCustomValidity("");
      const message = input.validity.valid ? null : getValidationMessage(input, type);
      setClientError(field, message);
    };

  const handleInvalidValidation =
    (field: "identifier" | "code" | "password", type: "email" | "password" | "otp") =>
    (event: FormEvent<HTMLInputElement>) => {
      event.preventDefault();
      const input = event.currentTarget;
      const message = getValidationMessage(input, type);
      input.setCustomValidity(message ?? "");
      setClientError(field, message);
    };

  const ensureClientValidation = (event: MouseEvent<HTMLButtonElement>) => {
    const form = event.currentTarget.closest("form");
    if (!form) return;
    if (!form.reportValidity()) {
      event.preventDefault();
    }
  };

  return (
    <SignIn.Root routing="path">
      <SignIn.Step name="start">
        <div className="space-y-6">
          <GlobalError className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" />
          {oauthError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {oauthError}
            </div>
          ) : null}

          {/* OAuth Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuth("google")}
              className="w-full h-11 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
            >
              <GoogleIcon className="w-5 h-5 mr-2" />
              {t("auth.signIn.google")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuth("facebook")}
              className="w-full h-11 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
            >
              <FacebookIcon className="w-5 h-5 mr-2" />
              {t("auth.signIn.facebook")}
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">
                {t("auth.common.orContinueWithEmail")}
              </span>
            </div>
          </div>

          {/* Email Input */}
          <div className="space-y-2">
            <Field name="identifier">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                {t("auth.common.emailAddress")}
              </ClerkLabel>
              <ClerkInput
                type="email"
                required
                autoComplete="email"
                placeholder={t("auth.common.emailPlaceholder")}
                onInput={handleInputValidation("identifier", "email")}
                onInvalid={handleInvalidValidation("identifier", "email")}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {clientErrors.identifier ? (
                <p className="mt-1 block text-sm text-red-600">{clientErrors.identifier}</p>
              ) : (
                <FieldError className="mt-1 block text-sm text-red-600" />
              )}
            </Field>
          </div>

          {/* Continue Button */}
          <SignIn.Action submit asChild>
            <Button
              type="submit"
              onClick={ensureClientValidation}
              className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
            >
              {t("auth.common.continue")}
            </Button>
          </SignIn.Action>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-slate-600">
            {t("auth.signIn.noAccount")}{" "}
            <Link
              href="/sign-up"
              className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              {t("auth.signIn.signUpLink")}
            </Link>
          </p>
        </div>
      </SignIn.Step>

      <SignIn.Step name="verifications">
        <SignIn.Strategy name="email_code">
          <div className="space-y-6">
            <GlobalError className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" />
            <div className="space-y-2">
              <Field name="code">
                <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                  {t("auth.common.verificationCode")}
                </ClerkLabel>
                <ClerkInput
                  type="otp"
                  required
                  length={6}
                  placeholder={t("auth.common.verificationCodePlaceholder")}
                  onInput={handleInputValidation("code", "otp")}
                  onInvalid={handleInvalidValidation("code", "otp")}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {clientErrors.code ? (
                  <p className="mt-1 block text-sm text-red-600">{clientErrors.code}</p>
                ) : (
                  <FieldError className="mt-1 block text-sm text-red-600" />
                )}
              </Field>
            </div>

            <SignIn.Action submit asChild>
              <Button
                type="submit"
                onClick={ensureClientValidation}
                className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
              >
                {t("auth.common.verify")}
              </Button>
            </SignIn.Action>

            <SignIn.Action navigate="start" asChild>
              <Button type="button" variant="ghost" className="w-full h-11">
                {t("auth.common.back")}
              </Button>
            </SignIn.Action>
          </div>
        </SignIn.Strategy>

        <SignIn.Strategy name="password">
          <div className="space-y-6">
            <GlobalError className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" />
            <div className="space-y-2">
              <Field name="password">
                <div className="flex items-center justify-between mb-2">
                  <ClerkLabel className="text-sm font-medium text-foreground">
                    {t("auth.common.password")}
                  </ClerkLabel>
                  <SignIn.Action navigate="forgot-password" asChild>
                    <button
                      type="button"
                      className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      {t("auth.signIn.forgotPassword")}
                    </button>
                  </SignIn.Action>
                </div>
                <div className="relative">
                  <ClerkInput
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder={t("auth.signIn.passwordPlaceholder")}
                    onInput={handleInputValidation("password", "password")}
                    onInvalid={handleInvalidValidation("password", "password")}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-11 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={
                      showPassword ? t("auth.common.hidePassword") : t("auth.common.showPassword")
                    }
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {clientErrors.password ? (
                  <p className="mt-1 block text-sm text-red-600">{clientErrors.password}</p>
                ) : (
                  <FieldError className="mt-1 block text-sm text-red-600" />
                )}
              </Field>
            </div>

            <SignIn.Action submit asChild>
              <Button
                type="submit"
                onClick={ensureClientValidation}
                className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
              >
                {t("auth.signIn.submitPassword")}
              </Button>
            </SignIn.Action>

            <SignIn.Action navigate="start" asChild>
              <Button type="button" variant="ghost" className="w-full h-11">
                {t("auth.common.back")}
              </Button>
            </SignIn.Action>
          </div>
        </SignIn.Strategy>
      </SignIn.Step>

      <SignIn.Step name="forgot-password">
        <div className="space-y-6">
          <GlobalError className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" />
          <div className="space-y-2">
            <Field name="identifier">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                {t("auth.common.emailAddress")}
              </ClerkLabel>
              <ClerkInput
                type="email"
                required
                autoComplete="email"
                placeholder={t("auth.common.emailPlaceholder")}
                onInput={handleInputValidation("identifier", "email")}
                onInvalid={handleInvalidValidation("identifier", "email")}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {clientErrors.identifier ? (
                <p className="mt-1 block text-sm text-red-600">{clientErrors.identifier}</p>
              ) : (
                <FieldError className="mt-1 block text-sm text-red-600" />
              )}
            </Field>
          </div>

          <SignIn.Action submit asChild>
            <Button
              type="submit"
              onClick={ensureClientValidation}
              className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
            >
              {t("auth.signIn.sendResetLink")}
            </Button>
          </SignIn.Action>

          <SignIn.Action navigate="start" asChild>
            <Button type="button" variant="ghost" className="w-full h-11">
              {t("auth.common.back")}
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
