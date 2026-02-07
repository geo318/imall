import { redirect } from "@/i18n/navigation.server";
import { getSuperadminSession } from "@/lib/superadmin";

export default function SuperadminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = getSuperadminSession();
  if (!session) {
    return redirect("/superadmin/login");
  }

  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
