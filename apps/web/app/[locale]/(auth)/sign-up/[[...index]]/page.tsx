import { Heart, Shield, Zap } from "lucide-react";
import { MarketHubLogo } from "@/assets";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation.server";
import { getTranslations } from "@/i18n/server";
import { AuthCopyright } from "../../_components/auth-copyright";
import { SignUpSlot } from "../../_components/sign-up-slot";

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations(locale as Locale);
  const features = [
    {
      icon: Shield,
      title: t("auth.layout.features.secure.title"),
      desc: t("auth.layout.features.secure.desc"),
    },
    {
      icon: Zap,
      title: t("auth.layout.features.fast.title"),
      desc: t("auth.layout.features.fast.desc"),
    },
    {
      icon: Heart,
      title: t("auth.layout.features.favorites.title"),
      desc: t("auth.layout.features.favorites.desc"),
    },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-500 relative overflow-y-auto">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1 flex-shrink-0">
            <MarketHubLogo width={32} height={32} className="h-8 w-8" />
            <span className="-ml-1 whitespace-nowrap font-bold text-xl text-white">Mall</span>
          </Link>

          {/* Main Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                {t("auth.layout.heroTitle")}
              </h1>
              <p className="text-lg text-white/80 max-w-md">{t("auth.layout.heroDescription")}</p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10"
                  >
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{feature.title}</h3>
                      <p className="text-sm text-white/70">{feature.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <AuthCopyright className="text-white/60 text-sm" />
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden p-6 border-b border-border flex-shrink-0">
          <Link href="/" className="flex items-center gap-1 flex-shrink-0">
            <MarketHubLogo width={32} height={32} className="h-8 w-8" />
            <span className="-ml-1 whitespace-nowrap font-bold text-xl">Mall</span>
          </Link>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 min-h-0">
          <div className="w-full max-w-md space-y-8">
            {/* Header */}
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground tracking-tight">
                {t("auth.signUp.title")}
              </h2>
              <p className="text-muted-foreground">{t("auth.signUp.subtitle")}</p>
            </div>

            <SignUpSlot />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border lg:hidden flex-shrink-0">
          <AuthCopyright className="text-center text-sm text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
