import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Child {
  id: number;
  name: string;
  age: number;
  totalEarned: string;
  completedJobs: number;
}

interface Payment {
  id: number;
  jobId: number;
  childId: number;
  amount: string;
  spendingAmount: string;
  savingsAmount: string;
  rothIraAmount: string;
  brokerageAmount: string;
  createdAt: string;
}

const COLORS = {
  spending: "#3B82F6",
  savings: "#22C55E", 
  rothIra: "#8B5CF6",
  brokerage: "#F59E0B",
};

export default function Reports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedChildId, setSelectedChildId] = useState<string>("all");
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0], // today
  });

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ["/api/children"],
    enabled: user?.role === "parent",
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/payments"],
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const isLoading = childrenLoading || paymentsLoading || jobsLoading;

  // Filter data based on selected child and date range
  const filteredPayments = payments?.filter((payment: Payment) => {
    const paymentDate = new Date(payment.createdAt);
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    
    const isInDateRange = paymentDate >= startDate && paymentDate <= endDate;
    const isSelectedChild = selectedChildId === "all" || payment.childId.toString() === selectedChildId;
    
    return isInDateRange && isSelectedChild;
  }) || [];

  // Calculate totals
  const totalEarned = filteredPayments.reduce((sum: number, payment: Payment) => 
    sum + parseFloat(payment.amount), 0
  );

  const categoryTotals = filteredPayments.reduce((acc: any, payment: Payment) => {
    acc.spending += parseFloat(payment.spendingAmount);
    acc.savings += parseFloat(payment.savingsAmount);
    acc.rothIra += parseFloat(payment.rothIraAmount);
    acc.brokerage += parseFloat(payment.brokerageAmount);
    return acc;
  }, { spending: 0, savings: 0, rothIra: 0, brokerage: 0 });

  // Prepare chart data
  const pieChartData = [
    { name: "Spending", value: categoryTotals.spending, color: COLORS.spending },
    { name: "Savings", value: categoryTotals.savings, color: COLORS.savings },
    { name: "Roth IRA", value: categoryTotals.rothIra, color: COLORS.rothIra },
    { name: "Brokerage", value: categoryTotals.brokerage, color: COLORS.brokerage },
  ].filter(item => item.value > 0);

  // Monthly earnings data
  const monthlyData = filteredPayments.reduce((acc: any, payment: Payment) => {
    const month = new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    
    if (!acc[month]) {
      acc[month] = { month, spending: 0, savings: 0, rothIra: 0, brokerage: 0, total: 0 };
    }
    
    acc[month].spending += parseFloat(payment.spendingAmount);
    acc[month].savings += parseFloat(payment.savingsAmount);
    acc[month].rothIra += parseFloat(payment.rothIraAmount);
    acc[month].brokerage += parseFloat(payment.brokerageAmount);
    acc[month].total += parseFloat(payment.amount);
    
    return acc;
  }, {});

  const monthlyChartData = Object.values(monthlyData).sort((a: any, b: any) => 
    new Date(a.month).getTime() - new Date(b.month).getTime()
  );

  // Child comparison data (for parents)
  const childComparisonData = user?.role === "parent" ? 
    children?.map((child: Child) => {
      const childPayments = filteredPayments.filter((p: Payment) => p.childId === child.id);
      const total = childPayments.reduce((sum: number, p: Payment) => sum + parseFloat(p.amount), 0);
      const jobCount = jobs?.filter((job: any) => job.assignedToId === child.id && job.status === "approved").length || 0;
      
      return {
        name: child.name,
        totalEarned: total,
        jobsCompleted: jobCount,
        age: child.age,
      };
    }).filter((child: any) => child.totalEarned > 0) : [];

  const handleExportCSV = async () => {
    try {
      const csvData = filteredPayments.map((payment: Payment) => {
        const child = children?.find((c: Child) => c.id === payment.childId);
        const job = jobs?.find((j: any) => j.id === payment.jobId);
        
        return {
          Date: new Date(payment.createdAt).toLocaleDateString(),
          Child: child?.name || "Unknown",
          Job: job?.title || "Unknown",
          "Total Amount": parseFloat(payment.amount).toFixed(2),
          "Spending Amount": parseFloat(payment.spendingAmount).toFixed(2),
          "Savings Amount": parseFloat(payment.savingsAmount).toFixed(2),
          "Roth IRA Amount": parseFloat(payment.rothIraAmount).toFixed(2),
          "Brokerage Amount": parseFloat(payment.brokerageAmount).toFixed(2),
        };
      });

      const headers = Object.keys(csvData[0] || {});
      const csvContent = [
        headers.join(","),
        ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `mintsprout-payments-${dateRange.startDate}-to-${dateRange.endDate}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Success!",
        description: "Payment data exported to CSV",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports & Analytics</h1>
        <p className="text-gray-600 text-lg">Track earnings, spending patterns, and financial progress</p>
      </div>

      {/* Filters */}
      <Card className="mint-card mb-8">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {user?.role === "parent" && (
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Child</Label>
                <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                  <SelectTrigger className="mint-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Children</SelectItem>
                    {children?.map((child: Child) => (
                      <SelectItem key={child.id} value={child.id.toString()}>
                        {child.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Start Date</Label>
              <Input
                type="date"
                className="mint-input"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">End Date</Label>
              <Input
                type="date"
                className="mint-input"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              />
            </div>
            
            <div className="flex items-end">
              <Button onClick={handleExportCSV} variant="outline" className="w-full">
                📊 Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="mint-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Earned</p>
                <p className="text-3xl font-bold text-gray-900">${totalEarned.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <span className="text-primary text-xl">💰</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mint-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Savings</p>
                <p className="text-3xl font-bold text-green-600">${categoryTotals.savings.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                <span className="text-green-500 text-xl">🐷</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mint-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Invested</p>
                <p className="text-3xl font-bold text-purple-600">
                  ${(categoryTotals.rothIra + categoryTotals.brokerage).toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                <span className="text-purple-500 text-xl">📈</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mint-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Payments Made</p>
                <p className="text-3xl font-bold text-blue-600">{filteredPayments.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <span className="text-blue-500 text-xl">📋</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="allocation" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3">
          <TabsTrigger value="allocation">Money Allocation</TabsTrigger>
          <TabsTrigger value="trends">Trends Over Time</TabsTrigger>
          {user?.role === "parent" && <TabsTrigger value="children">Child Comparison</TabsTrigger>}
        </TabsList>

        {/* Money Allocation Tab */}
        <TabsContent value="allocation" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <Card className="mint-card">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">💰 Money Distribution</h3>
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <span className="text-4xl mb-2 block">📊</span>
                      <p>No payment data available for the selected period</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card className="mint-card">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">📋 Category Breakdown</h3>
                <div className="space-y-4">
                  {[
                    { name: "Spending", amount: categoryTotals.spending, color: "bg-blue-500", icon: "🛒" },
                    { name: "Savings", amount: categoryTotals.savings, color: "bg-green-500", icon: "🐷" },
                    { name: "Roth IRA", amount: categoryTotals.rothIra, color: "bg-purple-500", icon: "📈" },
                    { name: "Brokerage", amount: categoryTotals.brokerage, color: "bg-yellow-500", icon: "📊" },
                  ].map((category) => (
                    <div key={category.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 ${category.color} rounded-lg flex items-center justify-center`}>
                          <span className="text-white text-sm">{category.icon}</span>
                        </div>
                        <span className="font-medium text-gray-900">{category.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">${category.amount.toFixed(2)}</p>
                        <p className="text-sm text-gray-600">
                          {totalEarned > 0 ? ((category.amount / totalEarned) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trends Over Time Tab */}
        <TabsContent value="trends" className="space-y-6">
          <Card className="mint-card">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">📈 Earnings Trends</h3>
              {monthlyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, ""]} />
                    <Legend />
                    <Bar dataKey="spending" stackId="a" fill={COLORS.spending} name="Spending" />
                    <Bar dataKey="savings" stackId="a" fill={COLORS.savings} name="Savings" />
                    <Bar dataKey="rothIra" stackId="a" fill={COLORS.rothIra} name="Roth IRA" />
                    <Bar dataKey="brokerage" stackId="a" fill={COLORS.brokerage} name="Brokerage" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-500">
                  <div className="text-center">
                    <span className="text-4xl mb-2 block">📈</span>
                    <p>No trend data available for the selected period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Child Comparison Tab (Parent Only) */}
        {user?.role === "parent" && (
          <TabsContent value="children" className="space-y-6">
            <Card className="mint-card">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">👨‍👩‍👧‍👦 Child Performance Comparison</h3>
                {childComparisonData.length > 0 ? (
                  <div className="space-y-4">
                    {childComparisonData.map((child: any) => (
                      <div key={child.name} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                              <span className="text-white font-bold">
                                {child.name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{child.name}</h4>
                              <p className="text-sm text-gray-600">Age {child.age}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary text-lg">${child.totalEarned.toFixed(2)}</p>
                            <p className="text-sm text-gray-600">{child.jobsCompleted} jobs completed</p>
                          </div>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ 
                              width: `${Math.max(10, Math.min(100, (child.totalEarned / Math.max(...childComparisonData.map((c: any) => c.totalEarned))) * 100))}%` 
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    
                    {/* Comparison Chart */}
                    <div className="mt-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={childComparisonData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="totalEarned" fill={COLORS.savings} name="Total Earned ($)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <span className="text-4xl mb-2 block">👨‍👩‍👧‍👦</span>
                      <p>No child data available for comparison</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </main>
  );
}
