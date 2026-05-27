import { useEffect } from "react";
import { APP_TITLE_SUFFIX } from "../config/branding";

export default function DashboardPage() {
  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} · Dashboard`;
  }, []);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-2 text-sm text-slate-500">
        Pending bills and to-dos will appear here.
      </p>
    </div>
  );
}
