import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useKidMode } from "@/hooks/use-kid-mode";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState, createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { YOUNGEST_NAV } from "@/lib/youngest-ui";
import { taskLabels } from "@/lib/task-labels";
import { Menu as MenuIcon, Check, ChevronDown } from "lucide-react";

interface Child {
  id: number;
  name: string;
  age: number;
}

type NavItem = { href: string; icon: string; label: string };

export const SelectedChildContext = createContext<{ selectedChildId: string; setSelectedChildId: (id: string) => void }>({
  selectedChildId: "",
  setSelectedChildId: () => { },
});
export const useSelectedChild = () => useContext(SelectedChildContext);

export function Navigation() {
  const { user, logout } = useAuth();
  const { mode: kidMode } = useKidMode();
  const [location] = useLocation();
  const [selectedChildId, setSelectedChildId] = useState<string>("");

  const { data: children } = useQuery<Child[]>({
    queryKey: ["/api/children"],
    enabled: user?.role === "parent",
  });

  useEffect(() => {
    if (user?.role !== "parent") return;
    if (!children || children.length === 0) return;
    if (selectedChildId) return;
    setSelectedChildId(children[0].id.toString());
  }, [children, selectedChildId, user?.role]);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase();

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location === "/" || location === "/dashboard" || location.startsWith("/dashboard/");
    }
    return location === path || location.startsWith(`${path}/`);
  };

  const isYoungest = user?.role === "child" && kidMode === "youngest";
  const taskNavLabel = taskLabels(user?.role === "parent" ? "parent" : "child", kidMode).nav;

  const navItems: NavItem[] = useMemo(() => {
    const base: NavItem[] = [
      { href: "/dashboard", icon: "🏠", label: "Home" },
      { href: "/jobs", icon: "✅", label: taskNavLabel },
      { href: "/learn", icon: "🎓", label: "Learn" },
      { href: "/payments", icon: "💰", label: kidMode === "older" ? "Money" : "My Money" },
      { href: "/savings", icon: "🎯", label: "Goals" },
      { href: "/spending", icon: "🛒", label: "Spending" },
      { href: "/donations", icon: "❤️", label: "Donations" },
      { href: "/activity", icon: "🧾", label: "History" },
      { href: "/reports", icon: "📊", label: "Reports" },
    ];

    let items: NavItem[];
    if (user?.role === "child" && (kidMode === "youngest" || kidMode === "younger")) {
      items = base.filter((i) =>
        kidMode === "youngest"
          ? ["/dashboard", "/jobs", "/learn", "/payments"].includes(i.href)
          : ["/dashboard", "/jobs", "/learn", "/payments", "/savings"].includes(i.href),
      );
    } else {
      items = [
        ...base,
        ...(user?.role === "parent"
          ? [
              { href: "/controls", icon: "🛡️", label: "Controls" },
              { href: "/family", icon: "👨‍👩‍👧‍👦", label: "Family" },
            ]
          : []),
      ];
    }

    if (isYoungest) {
      return items.map((item) => {
        const youngest = YOUNGEST_NAV[item.href as keyof typeof YOUNGEST_NAV];
        return youngest ? { ...item, icon: youngest.icon, label: youngest.label } : item;
      });
    }
    return items;
  }, [user?.role, kidMode, isYoungest, taskNavLabel]);

  const activeItem = navItems.find((i) => isActive(i.href));

  return (
    <SelectedChildContext.Provider value={{ selectedChildId, setSelectedChildId }}>
      <nav className="bg-white shadow-sm border-b-2 border-primary/10 sticky top-0 z-40 w-full overflow-hidden pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 gap-2 min-w-0">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0 min-w-0">
              <div className="w-9 h-9 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-md shrink-0">
                <span className="text-white font-black text-lg">🌱</span>
              </div>
              <span className="font-black text-gray-900 truncate hidden sm:inline">MintSprout</span>
            </Link>

            {/* Mobile only — pages menu */}
            <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 font-bold gap-1.5 px-3"
                  aria-label="Open navigation menu"
                >
                  <MenuIcon className="h-4 w-4 shrink-0" />
                  <span className="hidden min-[400px]:inline">Menu</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-[75vh] overflow-y-auto">
                {activeItem && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                      Current: {activeItem.icon} {activeItem.label}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                {navItems.map(({ href, icon, label }) => (
                  <DropdownMenuItem
                    key={href}
                    asChild
                    className={`cursor-pointer font-medium ${isActive(href) ? "bg-primary/10 text-primary font-bold" : ""}`}
                  >
                    <Link href={href} className="flex w-full items-center gap-2">
                      <span>{icon}</span>
                      {label}
                      {isActive(href) && <Check className="h-4 w-4 ml-auto text-primary" />}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            </div>

            <div className="flex-1" />

            {/* Account — child switch + logout */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full p-0">
                  <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-gradient-to-br from-green-400 to-green-600 text-white font-black text-xs">
                      {getInitials(user?.name || "?")}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-bold truncate">{user?.name}</DropdownMenuLabel>
                {user?.role === "parent" && children && children.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                      View as child
                    </DropdownMenuLabel>
                    {children.map((child) => (
                      <DropdownMenuItem
                        key={child.id}
                        className="cursor-pointer font-medium"
                        onClick={() => setSelectedChildId(child.id.toString())}
                      >
                        <span className="flex-1">{child.name}</span>
                        {selectedChildId === child.id.toString() && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer font-medium">
                  {isYoungest ? "🚪 Bye" : "Logout"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tablet/desktop: quick links without opening the menu */}
          <nav className="hidden md:block border-t border-primary/5" aria-label="Main navigation">
            <div className="flex gap-1 overflow-x-auto py-2 mint-scroll-tabs">
              <div className="inline-flex gap-1 min-w-0">
                {navItems.map(({ href, icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`inline-flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                      isActive(href)
                        ? "bg-primary/10 text-primary"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <span aria-hidden>{icon}</span>
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        </div>
      </nav>
    </SelectedChildContext.Provider>
  );
}
