import { redirect } from "@/i18n/navigation.server";
import { getSuperadminSession } from "@/lib/superadmin";
import { SuperadminLoginForm } from "./superadmin-login-form";

export default async function SuperadminLoginPage() {
  const session = await getSuperadminSession();
  if (session) {
    return redirect("/superadmin");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Superadmin
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
          <p className="text-sm text-slate-600">Access the global shop management console.</p>
        </div>
        <SuperadminLoginForm />
      </div>
    </div>
  );
}
