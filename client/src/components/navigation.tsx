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
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface Child {
  id: number;
  name: string;
  age: number;
}

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

  return (
    <nav className="bg-white shadow-sm border-b-2 border-primary/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 flex items-center">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mr-2">
                <span className="text-white font-bold text-lg">🌱</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">MintSprout</h1>
            </div>
            
            <div className="hidden md:block ml-8">
              <div className="flex space-x-1">
                <Link href="/dashboard">
                  <Button
                    variant={isActive("/dashboard") ? "default" : "ghost"}
                    className={isActive("/dashboard") ? "mint-primary" : "text-gray-600 hover:text-primary"}
                  >
                    🏠 Dashboard
                  </Button>
                </Link>
                <Link href="/jobs">
                  <Button
                    variant={isActive("/jobs") ? "default" : "ghost"}
                    className={isActive("/jobs") ? "mint-primary" : "text-gray-600 hover:text-primary"}
                  >
                    ✅ Jobs
                  </Button>
                </Link>
                <Link href="/learn">
                  <Button
                    variant={isActive("/learn") ? "default" : "ghost"}
                    className={isActive("/learn") ? "mint-primary" : "text-gray-600 hover:text-primary"}
                  >
                    🎓 Learn
                  </Button>
                </Link>
                <Link href="/reports">
                  <Button
                    variant={isActive("/reports") ? "default" : "ghost"}
                    className={isActive("/reports") ? "mint-primary" : "text-gray-600 hover:text-primary"}
                  >
                    📊 Reports
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {user?.role === "parent" && children && (
              <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child: Child) => (
                    <SelectItem key={child.id} value={child.id.toString()}>
                      {child.name} (Age {child.age})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <div className="flex items-center space-x-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-white font-medium">
                  {getInitials(user?.name || "")}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block font-medium text-gray-700">{user?.name}</span>
              <Button variant="ghost" onClick={logout} className="text-gray-600 hover:text-gray-800">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
        <div className="flex justify-around">
          <Link href="/dashboard">
            <Button variant="ghost" className={`flex flex-col items-center space-y-1 ${isActive("/dashboard") ? "text-primary" : "text-gray-400"}`}>
              <span className="text-lg">🏠</span>
              <span className="text-xs font-medium">Home</span>
            </Button>
          </Link>
          <Link href="/jobs">
            <Button variant="ghost" className={`flex flex-col items-center space-y-1 ${isActive("/jobs") ? "text-primary" : "text-gray-400"}`}>
              <span className="text-lg">✅</span>
              <span className="text-xs font-medium">Jobs</span>
            </Button>
          </Link>
          <Link href="/learn">
            <Button variant="ghost" className={`flex flex-col items-center space-y-1 ${isActive("/learn") ? "text-primary" : "text-gray-400"}`}>
              <span className="text-lg">🎓</span>
              <span className="text-xs font-medium">Learn</span>
            </Button>
          </Link>
          <Link href="/reports">
            <Button variant="ghost" className={`flex flex-col items-center space-y-1 ${isActive("/reports") ? "text-primary" : "text-gray-400"}`}>
              <span className="text-lg">📊</span>
              <span className="text-xs font-medium">Reports</span>
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
