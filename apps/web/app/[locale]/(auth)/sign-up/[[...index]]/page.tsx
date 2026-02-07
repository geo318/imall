import { Heart, Shield, Zap } from "lucide-react";
import { MarketHubLogo } from "@/assets";
import { Link } from "@/i18n/navigation.server";
import { SignUpSlot } from "../../_components/sign-up-slot";

const features = [
  {
    icon: Shield,
    title: "Secure Shopping",
    desc: "Your data is always protected",
  },
  { icon: Zap, title: "Fast Checkout", desc: "Quick and seamless experience" },
  { icon: Heart, title: "Save Favorites", desc: "Build your wishlist" },
];

export default function SignUpPage() {
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
          <Link href="/" className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <MarketHubLogo className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Marketplace</span>
          </Link>

          {/* Main Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                Discover Amazing <br /> Products & Vendors
              </h1>
              <p className="text-lg text-white/80 max-w-md">
                Join thousands of happy customers who shop with confidence on our trusted
                marketplace.
              </p>
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
          <p className="text-white/60 text-sm">© 2024 Marketplace. All rights reserved.</p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden p-6 border-b border-border flex-shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <MarketHubLogo className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">Marketplace</span>
          </Link>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 min-h-0">
          <div className="w-full max-w-md space-y-8">
            {/* Header */}
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground tracking-tight">
                Create an account
              </h2>
              <p className="text-muted-foreground">Fill in your details to get started</p>
            </div>

            <SignUpSlot />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border lg:hidden flex-shrink-0">
          <p className="text-center text-sm text-muted-foreground">
            © 2024 Marketplace. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
