import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  ListTodo,
  Landmark,
  Settings,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "../../config/branding";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/bills", label: "Bills", Icon: Receipt },
  { to: "/todos", label: "To-Dos", Icon: ListTodo },
  { to: "/rentals", label: "Rentals", Icon: Landmark },
  { to: "/settings", label: "Settings", Icon: Settings },
];

function UserAvatar({
  name,
  picture,
}: {
  name: string;
  picture: string;
}) {
  const [imgError, setImgError] = useState(false);
  const initial = name.charAt(0).toUpperCase() || "?";

  if (!picture || imgError) {
    return (
      <span
        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-700 text-sm font-medium text-white"
        aria-hidden="true"
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={picture}
      alt=""
      className="h-8 w-8 flex-shrink-0 rounded-full"
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
    />
  );
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate("/");
  }

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex-shrink-0">
          <NavLink to="/dashboard" className="group focus:outline-none">
            <span className="text-lg font-semibold text-indigo-700 group-focus:ring-2 group-focus:ring-indigo-500 group-focus:ring-offset-2 rounded">
              {APP_NAME}
            </span>
            <span className="block text-xs text-slate-500">{APP_TAGLINE}</span>
          </NavLink>
        </div>

        {/* Desktop nav links */}
        <div className="hidden sm:flex sm:items-center sm:gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <item.Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Desktop user identity + sign out */}
        {user && (
          <div className="hidden sm:flex sm:items-center sm:gap-3 sm:border-l sm:border-slate-200 sm:pl-4">
            <div className="flex items-center gap-2">
              <UserAvatar name={user.name} picture={user.picture} />
              <span className="text-sm font-medium text-slate-700">
                {user.name}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-indigo-700 transition-colors hover:text-indigo-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-slate-200 sm:hidden">
          <div className="px-4 py-2">
            {/* Mobile user identity + sign out */}
            {user && (
              <div className="border-b border-slate-200 pb-2 mb-2">
                <div className="flex items-center gap-3 px-3 py-2">
                  <UserAvatar name={user.name} picture={user.picture} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {user.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleSignOut();
                  }}
                  className="flex min-h-11 min-w-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-slate-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}

            {/* Nav links */}
            <div className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`
                  }
                >
                  <item.Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
