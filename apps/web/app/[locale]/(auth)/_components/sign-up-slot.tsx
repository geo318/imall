"use client";

import {
  Input as ClerkInput,
  Label as ClerkLabel,
  Field,
  FieldError,
  GlobalError,
} from "@clerk/elements/common";
import * as SignUp from "@clerk/elements/sign-up";
import { useClerk, useUser } from "@clerk/nextjs";
import { Button } from "@repo/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { type FormEvent, type MouseEvent, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation.client";
import { useLocale, useTranslations } from "@/i18n/provider";
import { FacebookIcon } from "./facebook-icon";
import { GoogleIcon } from "./google-icon";
import { SignUpSkeleton } from "./sign-up-skeleton";

function SignUpForm() {
  const t = useTranslations();
  const [showPassword, setShowPassword] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [generatedUsername] = useState(
    () => `imall_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  );
  const [clientErrors, setClientErrors] = useState<
    Partial<
      Record<
        | "firstName"
        | "lastName"
        | "emailAddress"
        | "password"
        | "code"
        | "idNumber"
        | "birthDate"
        | "consent",
        string
      >
    >
  >({});
  const clerk = useClerk();
  const locale = useLocale();
  const localePrefix = `/${locale}`;
  const oauthCallbackPath = `${localePrefix}/sso-callback`;
  const oauthCompletePath = `${localePrefix}/`;
  const maxBirthDate = new Date();
  maxBirthDate.setFullYear(maxBirthDate.getFullYear() - 18);
  const maxBirthDateValue = `${maxBirthDate.getFullYear()}-${String(maxBirthDate.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(maxBirthDate.getDate()).padStart(2, "0")}`;

  const handleOAuth = async (provider: "google" | "facebook") => {
    if (!clerk?.client) return;
    setOauthError(null);
    try {
      await clerk.client.signUp.authenticateWithRedirect({
        strategy: `oauth_${provider}`,
        redirectUrl: `${globalThis.location.origin}${oauthCallbackPath}`,
        redirectUrlComplete: `${globalThis.location.origin}${oauthCompletePath}`,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[auth][sign-up] OAuth redirect failed", error);
      }
      setOauthError(t("auth.errors.oauthFailed"));
    }
  };

  const setClientError = (
    field:
      | "firstName"
      | "lastName"
      | "emailAddress"
      | "password"
      | "code"
      | "idNumber"
      | "birthDate"
      | "consent",
    message: string | null,
  ) => {
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
    type: "email" | "password" | "name" | "otp" | "idNumber" | "birthDate" | "consent",
  ): string | null => {
    if (type === "idNumber") {
      const normalizedValue = input.value.trim();
      if (normalizedValue === "") {
        return null;
      }
      if (!/^\d{11}$/.test(normalizedValue)) {
        return t("auth.validation.idNumberFormat");
      }
    }

    if (type === "consent" && input.validity.valueMissing) {
      return t("auth.validation.consentRequired");
    }

    if (input.validity.valueMissing) {
      return t("auth.validation.required");
    }

    if (type === "email" && input.validity.typeMismatch) {
      return t("auth.validation.invalidEmail");
    }

    if (type === "name" && input.validity.tooShort) {
      return t("auth.validation.nameMin", { count: input.minLength });
    }

    if (type === "password" && input.validity.tooShort) {
      return t("auth.validation.passwordMin", { count: input.minLength });
    }

    if (type === "birthDate" && input.validity.badInput) {
      return t("auth.validation.invalidBirthDate");
    }

    if (type === "birthDate" && input.validity.rangeOverflow) {
      return t("auth.validation.birthDateMinAge", { count: 18 });
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
    (
      field:
        | "firstName"
        | "lastName"
        | "emailAddress"
        | "password"
        | "code"
        | "idNumber"
        | "birthDate"
        | "consent",
      type: "email" | "password" | "name" | "otp" | "idNumber" | "birthDate" | "consent",
    ) =>
    (event: FormEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      if (type === "idNumber") {
        const digitsOnly = input.value.replace(/\D/g, "").slice(0, 11);
        if (digitsOnly !== input.value) {
          input.value = digitsOnly;
        }
      }
      input.setCustomValidity("");
      const message = getValidationMessage(input, type);
      input.setCustomValidity(message ?? "");
      setClientError(field, message);
    };

  const handleInvalidValidation =
    (
      field:
        | "firstName"
        | "lastName"
        | "emailAddress"
        | "password"
        | "code"
        | "idNumber"
        | "birthDate"
        | "consent",
      type: "email" | "password" | "name" | "otp" | "idNumber" | "birthDate" | "consent",
    ) =>
    (event: FormEvent<HTMLInputElement>) => {
      event.preventDefault();
      const input = event.currentTarget;
      if (type === "idNumber") {
        const digitsOnly = input.value.replace(/\D/g, "").slice(0, 11);
        if (digitsOnly !== input.value) {
          input.value = digitsOnly;
        }
      }
      const message = getValidationMessage(input, type);
      input.setCustomValidity(message ?? "");
      setClientError(field, message);
    };

  const ensureClientValidation = (event: MouseEvent<HTMLButtonElement>) => {
    const form = event.currentTarget.closest("form");
    if (!form) return;
    if (!form.reportValidity()) {
      event.preventDefault();
      return;
    }
    // Clear stale client-side messages so backend Clerk errors can surface immediately.
    setClientErrors((previous) => {
      if (Object.keys(previous).length === 0) {
        return previous;
      }
      return {};
    });
  };

  return (
    <SignUp.Root routing="path" fallback={<SignUpSkeleton />}>
      <SignUp.Step name="start">
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
              {t("auth.signUp.google")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuth("facebook")}
              className="w-full h-11 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
            >
              <FacebookIcon className="w-5 h-5 mr-2" />
              {t("auth.signUp.facebook")}
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

          <div className="space-y-2">
            <Field name="firstName">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                {t("auth.signUp.firstName")}
              </ClerkLabel>
              <ClerkInput
                type="text"
                required
                minLength={2}
                autoComplete="given-name"
                placeholder={t("auth.signUp.firstNamePlaceholder")}
                onInput={handleInputValidation("firstName", "name")}
                onInvalid={handleInvalidValidation("firstName", "name")}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {clientErrors.firstName ? (
                <p className="mt-1 block text-sm text-red-600">{clientErrors.firstName}</p>
              ) : (
                <FieldError className="mt-1 block text-sm text-red-600" />
              )}
            </Field>
          </div>

          <div className="space-y-2">
            <Field name="lastName">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                {t("auth.signUp.lastName")}
              </ClerkLabel>
              <ClerkInput
                type="text"
                required
                minLength={2}
                autoComplete="family-name"
                placeholder={t("auth.signUp.lastNamePlaceholder")}
                onInput={handleInputValidation("lastName", "name")}
                onInvalid={handleInvalidValidation("lastName", "name")}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {clientErrors.lastName ? (
                <p className="mt-1 block text-sm text-red-600">{clientErrors.lastName}</p>
              ) : (
                <FieldError className="mt-1 block text-sm text-red-600" />
              )}
            </Field>
          </div>

          {/* Email Input */}
          <div className="space-y-2">
            <Field name="emailAddress">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                {t("auth.common.emailAddress")}
              </ClerkLabel>
              <ClerkInput
                type="email"
                required
                autoComplete="email"
                placeholder={t("auth.common.emailPlaceholder")}
                onInput={handleInputValidation("emailAddress", "email")}
                onInvalid={handleInvalidValidation("emailAddress", "email")}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {clientErrors.emailAddress ? (
                <p className="mt-1 block text-sm text-red-600">{clientErrors.emailAddress}</p>
              ) : (
                <FieldError className="mt-1 block text-sm text-red-600" />
              )}
            </Field>
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <Field name="password">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                {t("auth.common.password")}
              </ClerkLabel>
              <div className="relative">
                <ClerkInput
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder={t("auth.signUp.passwordPlaceholder")}
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
              ) : null}
              <FieldError name="password" className="mt-1 block text-sm text-red-600" />
            </Field>
          </div>

          {/* Continue Button */}
          <SignUp.Captcha className="min-h-[78px]" />

          <SignUp.Action submit asChild>
            <Button
              type="submit"
              onClick={ensureClientValidation}
              className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
            >
              {t("auth.common.continue")}
            </Button>
          </SignUp.Action>

          {/* Sign In Link */}
          <p className="text-center text-sm text-slate-600">
            {t("auth.signUp.haveAccount")}{" "}
            <Link
              href="/sign-in"
              className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              {t("auth.signUp.signInLink")}
            </Link>
          </p>
        </div>
      </SignUp.Step>

      <SignUp.Step name="verifications">
        <SignUp.Strategy name="email_code">
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

            <SignUp.Action submit asChild>
              <Button
                type="submit"
                onClick={ensureClientValidation}
                className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
              >
                {t("auth.common.verify")}
              </Button>
            </SignUp.Action>

            <SignUp.Action navigate="start" asChild>
              <Button type="button" variant="ghost" className="w-full h-11">
                {t("auth.common.back")}
              </Button>
            </SignUp.Action>
          </div>
        </SignUp.Strategy>
      </SignUp.Step>

      <SignUp.Step name="continue">
        <div className="space-y-6">
          <GlobalError className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" />
          <p className="text-sm text-slate-600">{t("auth.signUp.continueDescription")}</p>

          <div className="space-y-2">
            <Field name="firstName">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                {t("auth.signUp.firstName")}
              </ClerkLabel>
              <ClerkInput
                type="text"
                required
                minLength={2}
                autoComplete="given-name"
                placeholder={t("auth.signUp.firstNamePlaceholder")}
                onInput={handleInputValidation("firstName", "name")}
                onInvalid={handleInvalidValidation("firstName", "name")}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {clientErrors.firstName ? (
                <p className="mt-1 block text-sm text-red-600">{clientErrors.firstName}</p>
              ) : (
                <FieldError className="mt-1 block text-sm text-red-600" />
              )}
            </Field>
          </div>

          <div className="space-y-2">
            <Field name="lastName">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                {t("auth.signUp.lastName")}
              </ClerkLabel>
              <ClerkInput
                type="text"
                required
                minLength={2}
                autoComplete="family-name"
                placeholder={t("auth.signUp.lastNamePlaceholder")}
                onInput={handleInputValidation("lastName", "name")}
                onInvalid={handleInvalidValidation("lastName", "name")}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {clientErrors.lastName ? (
                <p className="mt-1 block text-sm text-red-600">{clientErrors.lastName}</p>
              ) : (
                <FieldError className="mt-1 block text-sm text-red-600" />
              )}
            </Field>
          </div>

          <div className="space-y-2">
            <Field name="unsafeMetadata.idNumber">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                {t("auth.signUp.idNumber")}
              </ClerkLabel>
              <ClerkInput
                type="text"
                maxLength={11}
                inputMode="numeric"
                placeholder={t("auth.signUp.idNumberPlaceholder")}
                onInput={handleInputValidation("idNumber", "idNumber")}
                onInvalid={handleInvalidValidation("idNumber", "idNumber")}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {clientErrors.idNumber ? (
                <p className="mt-1 block text-sm text-red-600">{clientErrors.idNumber}</p>
              ) : (
                <FieldError className="mt-1 block text-sm text-red-600" />
              )}
            </Field>
          </div>

          <div className="space-y-2">
            <Field name="unsafeMetadata.birthDate">
              <ClerkLabel className="text-sm font-medium text-foreground mb-2 block">
                {t("auth.signUp.birthDate")}
              </ClerkLabel>
              <ClerkInput
                type="date"
                required
                max={maxBirthDateValue}
                min="1900-01-01"
                placeholder={t("auth.signUp.birthDatePlaceholder")}
                onInput={handleInputValidation("birthDate", "birthDate")}
                onInvalid={handleInvalidValidation("birthDate", "birthDate")}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {clientErrors.birthDate ? (
                <p className="mt-1 block text-sm text-red-600">{clientErrors.birthDate}</p>
              ) : (
                <FieldError className="mt-1 block text-sm text-red-600" />
              )}
            </Field>
          </div>

          <div className="space-y-2">
            <Field name="unsafeMetadata.consentAccepted">
              <ClerkLabel className="sr-only">{t("auth.signUp.consentLabel")}</ClerkLabel>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <ClerkInput
                  type="checkbox"
                  required
                  value="true"
                  aria-label={t("auth.signUp.consentLabel")}
                  onInput={handleInputValidation("consent", "consent")}
                  onInvalid={handleInvalidValidation("consent", "consent")}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>{t("auth.signUp.consentLabel")}</span>
              </div>
              {clientErrors.consent ? (
                <p className="mt-1 block text-sm text-red-600">{clientErrors.consent}</p>
              ) : (
                <FieldError className="mt-1 block text-sm text-red-600" />
              )}
            </Field>
          </div>

          <Field name="username">
            <ClerkInput type="hidden" value={generatedUsername} readOnly />
          </Field>

          <SignUp.Action submit asChild>
            <Button
              type="submit"
              onClick={ensureClientValidation}
              className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
            >
              {t("auth.common.continue")}
            </Button>
          </SignUp.Action>

          <SignUp.Action navigate="start" asChild>
            <Button type="button" variant="ghost" className="w-full h-11">
              {t("auth.common.back")}
            </Button>
          </SignUp.Action>
        </div>
      </SignUp.Step>

      <SignUp.Step name="restricted">
        <div className="space-y-6">
          <GlobalError className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" />
          <p className="text-sm text-slate-600">{t("auth.signUp.restrictedMessage")}</p>
          <SignUp.Action navigate="start" asChild>
            <Button type="button" variant="outline" className="w-full h-11">
              {t("auth.common.back")}
            </Button>
          </SignUp.Action>
        </div>
      </SignUp.Step>
    </SignUp.Root>
  );
}

export function SignUpSlot() {
  const [mounted, setMounted] = useState(false);
  const { isLoaded: clerkLoaded } = useUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Wait for client mount and Clerk load before rendering Elements.
  if (!mounted || !clerkLoaded) {
    return <SignUpSkeleton />;
  }

  return <SignUpForm />;
}
