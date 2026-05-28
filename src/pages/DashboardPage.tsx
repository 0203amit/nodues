import { useEffect } from "react";
import { APP_TITLE_SUFFIX } from "../config/branding";
import { useAuth } from "../contexts/AuthContext";
import { useBootstrap } from "../contexts/BootstrapContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const { setupResult } = useBootstrap();

  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} · Dashboard`;
  }, []);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-slate-900">
        {user ? `Welcome, ${user.name}` : "Dashboard"}
      </h1>
      {user && (
        <p className="mt-1 text-sm text-slate-500">
          Signed in as {user.email}
        </p>
      )}
      {setupResult && (
        <p className="mt-4 text-sm text-slate-600">
          Your workspace is ready. Pending bills and to-dos will appear here.
        </p>
      )}
    </div>
  );
}
