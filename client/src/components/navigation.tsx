import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";

interface Child {
  id: number;
  name: string;
  age: number;
}

// Context so other pages can read the selected child
export const SelectedChildContext = createContext<{ selectedChildId: string; setSelectedChildId: (id: string) => void }>({
  selectedChildId: "",
  setSelectedChildId: () => { },
});
export const useSelectedChild = () => useContext(SelectedChildContext);

export function Navigation() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [selectedChildId, setSelectedChildId] = useState<string>("");

  const { data: children } = useQuery({
    queryKey: ["/api/children"],
    enabled: user?.role === "parent",
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const isActive = (path: string) => {
    return location === path || location.startsWith(path);
  };

  const navItems: { href: string; icon: string; label: string }[] = [
    { href: "/dashboard", icon: "🏠", label: "Home" },
    { href: "/jobs", icon: "✅", label: "Jobs" },
    { href: "/learn", icon: "🎓", label: "Learn" },
    { href: "/payments", icon: "💰", label: "Money" },
    { href: "/reports", icon: "📊", label: "Reports" },
    ...(user?.role === "parent" ? [{ href: "/family", icon: "👨‍👩‍👧‍👦", label: "Family" }] : []),
  ];

  return (
    <SelectedChildContext.Provider value={{ selectedChildId, setSelectedChildId }}>
      <nav className="bg-white shadow-sm border-b-2 border-primary/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center mr-2 shadow-md">
                  <span className="text-white font-black text-xl">🌱</span>
                </div>
                <h1 className="text-xl font-black text-gray-900">MintSprout</h1>
              </div>

              <div className="hidden md:block ml-8">
                <div className="flex space-x-1">
                  {navItems.map(({ href, icon, label }) => (
                    <Link key={href} href={href}>
                      <Button
                        variant={isActive(href) ? "default" : "ghost"}
                        className={`font-bold ${isActive(href) ? "mint-primary" : "text-gray-600 hover:text-primary"}`}
                      >
                        {icon} {label}
                      </Button>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {user?.role === "parent" && children && (
                <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                  <SelectTrigger className="w-44 font-bold">
                    <SelectValue placeholder="👶 Select child" />
                  </SelectTrigger>
                  <SelectContent>
                    {(children as Child[]).map((child: Child) => (
                      <SelectItem key={child.id} value={child.id.toString()} className="font-medium">
                        {child.name} (Age {child.age})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center space-x-2">
                <Avatar className="w-9 h-9 ring-2 ring-primary/30">
                  <AvatarFallback className="bg-gradient-to-br from-green-400 to-green-600 text-white font-black text-sm">
                    {getInitials(user?.name || "")}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:block font-bold text-gray-700">{user?.name}</span>
                <Button variant="ghost" onClick={logout} className="text-gray-500 hover:text-gray-800 font-bold text-sm">
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 z-50 shadow-lg">
          <div className="flex">
            {navItems.slice(0, 5).map(({ href, icon, label }) => (
              <Link key={href} href={href} className="flex-1">
                <Button
                  variant="ghost"
                  className={`w-full h-16 flex flex-col items-center justify-center space-y-1 rounded-none ${isActive(href)
                    ? "text-primary bg-primary/5 font-black"
                    : "text-gray-400 hover:text-gray-600 font-bold"
                    }`}
                >
                  <span className="text-xl">{icon}</span>
                  <span className="text-xs font-bold">{label}</span>
                </Button>
              </Link>
            ))}
            {user?.role === "parent" && (
              <Link href="/family" className="flex-1">
                <Button
                  variant="ghost"
                  className={`w-full h-16 flex flex-col items-center justify-center space-y-1 rounded-none ${isActive("/family")
                    ? "text-primary bg-primary/5 font-black"
                    : "text-gray-400 hover:text-gray-600 font-bold"
                    }`}
                >
                  <span className="text-xl">👪</span>
                  <span className="text-xs font-bold">Family</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>
    </SelectedChildContext.Provider>
  );
}
