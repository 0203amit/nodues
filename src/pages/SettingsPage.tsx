import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Receipt, Tags, History, Bell } from 'lucide-react';
import { APP_TITLE_SUFFIX } from '../config/branding';

interface SettingsCard {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string | null;
  disabled?: boolean;
}

const CARDS: SettingsCard[] = [
  {
    label: 'Properties',
    description: 'Manage your properties',
    icon: Building2,
    to: '/settings/properties',
  },
  {
    label: 'Bill Types',
    description: 'Configure bill categories',
    icon: Receipt,
    to: '/settings/bill-types',
  },
  {
    label: 'Categories',
    description: 'Manage to-do categories',
    icon: Tags,
    to: '/settings/categories',
  },
  {
    label: 'Activity Log',
    description: 'View recent actions',
    icon: History,
    to: '/settings/activity-log',
  },
  {
    label: 'Notifications',
    description: 'Coming soon',
    icon: Bell,
    to: null,
    disabled: true,
  },
];

export default function SettingsPage() {
  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} \u00b7 Settings`;
  }, []);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Settings</h1>

      <div className="flex flex-col gap-3">
        {CARDS.map((card) => {
          const Icon = card.icon;

          if (card.disabled || !card.to) {
            return (
              <div
                key={card.label}
                className="bg-white border border-slate-200 rounded-lg p-4 opacity-50 cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-base font-semibold text-slate-900">{card.label}</p>
                    <p className="text-sm text-slate-600">{card.description}</p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={card.label}
              to={card.to}
              className="bg-white border border-slate-200 rounded-lg p-4
                         hover:bg-slate-50 transition-colors cursor-pointer
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-indigo-700 flex-shrink-0" />
                <div>
                  <p className="text-base font-semibold text-slate-900">{card.label}</p>
                  <p className="text-sm text-slate-600">{card.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
