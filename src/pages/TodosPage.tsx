import { useEffect } from "react";
import { APP_TITLE_SUFFIX } from "../config/branding";

export default function TodosPage() {
  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} · To-Dos`;
  }, []);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-slate-900">To-Dos</h1>
      <p className="mt-2 text-sm text-slate-500">
        To-do list with categories and filters will appear here.
      </p>
    </div>
  );
}
