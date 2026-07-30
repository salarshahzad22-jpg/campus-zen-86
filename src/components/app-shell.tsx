import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bot,
  BookOpen,
  Brain,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assignments", label: "Assignments", icon: ClipboardList },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/exams", label: "Exams", icon: GraduationCap },
  { to: "/resources", label: "Resources", icon: BookOpen },
  { to: "/ask-ai", label: "Ask Campus AI", icon: Bot },
  { to: "/ai-assistant", label: "Study Planner", icon: Brain },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

const ADMIN_NAV = { to: "/admin", label: "Admin panel", icon: ShieldCheck } as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const navItems = isAdmin ? [...NAV, ADMIN_NAV] : [...NAV];


  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const currentPath = location.pathname;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-background px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <GraduationCap className="h-4 w-4" />
          </span>
          Campus Helper
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:sticky top-0 z-20 h-screen w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="hidden lg:flex items-center gap-2 px-6 py-5 font-semibold border-b border-sidebar-border">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </span>
            Campus Helper AI
          </div>
          <nav className="p-3 space-y-1 mt-2 lg:mt-0">
            {NAV.map((item) => {
              const active = currentPath.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-sidebar-border">
            <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-10 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
        )}

        <main className="flex-1 min-w-0 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
