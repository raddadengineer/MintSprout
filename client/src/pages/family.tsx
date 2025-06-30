import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Trash2, Plus, Edit, Users, Wallet, Settings, BarChart3 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface Child {
  id: number;
  name: string;
  age: number;
  totalEarned: string;
  completedJobs: number;
  learningStreak: number;
}

interface Job {
  id: number;
  title: string;
  description: string;
  amount: string;
  status: string;
  assignedToId: number;
  recurrence: string;
}

interface Payment {
  id: number;
  amount: string;
  spendingAmount: string;
  savingsAmount: string;
  rothIraAmount: string;
  brokerageAmount: string;
  createdAt: string;
  childId: number;
}

const childFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.number().min(1, "Age must be at least 1").max(18, "Age must be 18 or less"),
});

type ChildFormData = z.infer<typeof childFormSchema>;

export default function FamilyPage() {
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ["/api/children"],
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/payments"],
  });

  const { data: accountTypes } = useQuery({
    queryKey: [`/api/account-types/${user?.familyId}`],
    enabled: !!user?.familyId,
  });

  const form = useForm<ChildFormData>({
    resolver: zodResolver(childFormSchema),
    defaultValues: {
      name: "",
      age: 10,
    },
  });

  const createChildMutation = useMutation({
    mutationFn: (data: ChildFormData) =>
      apiRequest("POST", "/api/children", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Child added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      setIsChildModalOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add child",
        variant: "destructive",
      });
    },
  });

  const updateChildMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & ChildFormData) =>
      apiRequest("PATCH", `/api/children/${id}`, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Child updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      setIsChildModalOpen(false);
      setEditingChild(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update child",
        variant: "destructive",
      });
    },
  });

  const deleteChildMutation = useMutation({
    mutationFn: (childId: number) =>
      apiRequest("DELETE", `/api/children/${childId}`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Child removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove child",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ChildFormData) => {
    if (editingChild) {
      updateChildMutation.mutate({ id: editingChild.id, ...data });
    } else {
      createChildMutation.mutate(data);
    }
  };

  const handleEditChild = (child: Child) => {
    setEditingChild(child);
    form.setValue("name", child.name);
    form.setValue("age", child.age);
    setIsChildModalOpen(true);
  };

  const handleDeleteChild = (childId: number) => {
    if (confirm("Are you sure you want to remove this child? This action cannot be undone.")) {
      deleteChildMutation.mutate(childId);
    }
  };

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case "assigned":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Assigned</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">In Progress</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Awaiting Approval</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const totalFamilyEarnings = children?.reduce((total: number, child: Child) => 
    total + parseFloat(child.totalEarned || "0"), 0) || 0;

  const totalActiveJobs = jobs?.filter((job: Job) => 
    job.status !== "approved").length || 0;

  const totalCompletedJobs = jobs?.filter((job: Job) => 
    job.status === "approved").length || 0;

  if (childrenLoading || jobsLoading || paymentsLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading family data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Family Management</h1>
          <p className="text-gray-600 mt-1">Manage your family's financial learning journey</p>
        </div>
      </div>

      {/* Family Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Children</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{children?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Family Earnings</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalFamilyEarnings.toString())}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActiveJobs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Jobs</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompletedJobs}</div>
          </CardContent>
        </Card>
      </div>

      {/* Children Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Children</CardTitle>
              <CardDescription>Manage your children's profiles and progress</CardDescription>
            </div>
            <Dialog open={isChildModalOpen} onOpenChange={setIsChildModalOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingChild(null);
                  form.reset();
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Child
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md mx-4">
                <DialogHeader>
                  <DialogTitle>
                    {editingChild ? "Edit Child" : "Add New Child"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter child's name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="Enter child's age"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2 pt-4">
                      <Button 
                        type="submit" 
                        disabled={createChildMutation.isPending || updateChildMutation.isPending}
                        className="flex-1"
                      >
                        {editingChild ? "Update Child" : "Add Child"}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setIsChildModalOpen(false);
                          setEditingChild(null);
                          form.reset();
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {children?.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No children added yet</h3>
              <p className="text-gray-600 mb-4">Add your first child to start their financial learning journey</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {children?.map((child: Child) => (
                <Card key={child.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{child.name}</h3>
                        <p className="text-sm text-gray-600">Age {child.age}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditChild(child)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteChild(child.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Earned:</span>
                      <span className="font-medium">{formatCurrency(child.totalEarned || "0")}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Jobs Completed:</span>
                      <span className="font-medium">{child.completedJobs || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Learning Streak:</span>
                      <span className="font-medium">{child.learningStreak || 0} days</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
          <CardDescription>Overview of recent job activity across the family</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs?.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs created yet</h3>
              <p className="text-gray-600">Create jobs for your children to start earning</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs?.slice(0, 10).map((job: Job) => {
                const assignedChild = children?.find((child: Child) => child.id === job.assignedToId);
                return (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{job.title}</h4>
                      <p className="text-sm text-gray-600">
                        Assigned to {assignedChild?.name} • {formatCurrency(job.amount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {getJobStatusBadge(job.status)}
                      <Badge variant="outline" className="text-xs">
                        {job.recurrence}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>Latest payments made to children</CardDescription>
        </CardHeader>
        <CardContent>
          {payments?.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No payments yet</h3>
              <p className="text-gray-600">Payments will appear here when jobs are approved</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments?.slice(0, 10).map((payment: Payment) => {
                const assignedChild = children?.find((child: Child) => child.id === payment.childId);
                return (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{formatCurrency(payment.amount)} to {assignedChild?.name}</h4>
                      <p className="text-sm text-gray-600">{formatDate(payment.createdAt)}</p>
                    </div>
                    <div className="text-right text-sm text-gray-600">
                      <div>Spending: {formatCurrency(payment.spendingAmount)}</div>
                      <div>Savings: {formatCurrency(payment.savingsAmount)}</div>
                      {accountTypes?.rothIraEnabled && (
                        <div>Roth IRA: {formatCurrency(payment.rothIraAmount)}</div>
                      )}
                      {accountTypes?.brokerageEnabled && (
                        <div>Brokerage: {formatCurrency(payment.brokerageAmount)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}