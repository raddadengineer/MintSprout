import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { JobCreationModal } from "@/components/job-creation-modal";
import { PaymentApprovalModal } from "@/components/payment-approval-modal";
import { JobIcon } from "@/components/job-icon";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Filter, Edit, Trash2, Calendar, DollarSign, User, MoreHorizontal, Eye } from "lucide-react";

export default function Jobs() {
  const { user } = useAuth();
  const [showJobModal, setShowJobModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedJobs, setSelectedJobs] = useState<number[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [editingPayment, setEditingPayment] = useState(false);
  const [paymentAllocation, setPaymentAllocation] = useState({
    spendingAmount: 0,
    savingsAmount: 0,
    rothIraAmount: 0,
    brokerageAmount: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [childFilter, setChildFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [activeTab, setActiveTab] = useState("active");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const { data: children } = useQuery({
    queryKey: ["/api/children"],
  });

  const { data: accountTypes } = useQuery({
    queryKey: [`/api/account-types/${user?.familyId}`],
    enabled: !!user?.familyId,
  });

  // Fetch payment data for the selected job when editing
  const { data: existingPayment } = useQuery({
    queryKey: [`/api/payments/job/${selectedJob?.id}`],
    enabled: !!selectedJob?.id && selectedJob?.status === "approved" && editingPayment,
  });

  const { data: payments } = useQuery({
    queryKey: ["/api/payments"],
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; [key: string]: any }) =>
      apiRequest("PATCH", `/api/jobs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({
        title: "Success!",
        description: "Job updated successfully",
      });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({
        title: "Success!",
        description: "Job deleted successfully",
      });
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ jobId, allocation }: { jobId: number; allocation: any }) =>
      apiRequest("PATCH", `/api/payments/job/${jobId}`, allocation),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: [`/api/payments/job/${variables.jobId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      toast({
        title: "Success!",
        description: "Payment allocation updated successfully",
      });
    },
  });

  const handleJobAction = (jobId: number, status: string) => {
    updateJobMutation.mutate({ id: jobId, status });
  };

  const handleDeleteJob = (jobId: number) => {
    if (confirm("Are you sure you want to delete this job?")) {
      deleteJobMutation.mutate(jobId);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "assigned":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Assigned</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">In Progress</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Awaiting Approval</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Approved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getChildName = (childId: number) => {
    if (!children || !Array.isArray(children)) return "Unknown";
    const child = children.find((c: any) => c.id === childId);
    return child?.name || "Unknown";
  };

  const filterJobs = (jobsList: any[]) => {
    if (!jobsList) return [];
    
    return jobsList.filter(job => {
      const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           job.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      const matchesChild = childFilter === "all" || job.childId.toString() === childFilter;
      
      return matchesSearch && matchesStatus && matchesChild;
    });
  };

  const sortJobs = (jobsList: any[]) => {
    if (!jobsList) return [];
    
    return [...jobsList].sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "amount":
          return parseFloat(b.amount) - parseFloat(a.amount);
        case "name":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  };

  const activeJobs = jobs && Array.isArray(jobs) ? sortJobs(filterJobs(jobs.filter((job: any) => 
    ["assigned", "in_progress", "completed"].includes(job.status)
  ))) : [];

  const completedJobs = jobs && Array.isArray(jobs) ? sortJobs(filterJobs(jobs.filter((job: any) => 
    job.status === "approved"
  ))) : [];

  const getJobStats = () => {
    if (!jobs || !Array.isArray(jobs)) return { total: 0, pending: 0, completed: 0, totalEarnings: 0 };
    
    const pending = jobs.filter((job: any) => ["assigned", "in_progress", "completed"].includes(job.status)).length;
    const completed = jobs.filter((job: any) => job.status === "approved").length;
    const totalEarnings = jobs
      .filter((job: any) => job.status === "approved")
      .reduce((sum: number, job: any) => sum + parseFloat(job.amount), 0);
      
    return {
      total: jobs.length,
      pending,
      completed,
      totalEarnings
    };
  };

  const stats = getJobStats();

  const renderJobCard = (job: any) => (
    <Card key={job.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <JobIcon iconName={job.icon} className="h-6 w-6 text-gray-600" />
            <div>
              <h3 className="font-semibold text-gray-900">{job.title}</h3>
              <p className="text-sm text-gray-600">{job.description}</p>
              <div className="flex items-center space-x-4 mt-1">
                <span className="text-xs text-gray-500 flex items-center">
                  <User className="h-3 w-3 mr-1" />
                  {getChildName(job.childId)}
                </span>
                <span className="text-xs text-gray-500 flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {new Date(job.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-primary mb-1">
              ${parseFloat(job.amount).toFixed(2)}
            </div>
            {getStatusBadge(job.status)}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            {job.status === "assigned" && user?.role === "child" && (
              <Button size="sm" onClick={() => handleJobAction(job.id, "in_progress")} className="text-xs">
                Start Job
              </Button>
            )}
            {job.status === "in_progress" && user?.role === "child" && (
              <Button size="sm" onClick={() => handleJobAction(job.id, "completed")} className="text-xs">
                Mark Complete
              </Button>
            )}
            {job.status === "completed" && user?.role === "parent" && (
              <Button size="sm" onClick={() => {
                setSelectedJob(job);
                setShowPaymentModal(true);
              }} className="text-xs">
                Approve & Pay
              </Button>
            )}
          </div>
          
          {user?.role === "parent" && job.status !== "approved" && (
            <div className="flex space-x-1">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setSelectedJob(job);
                  setShowEditModal(true);
                }}
                className="text-xs px-2"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => handleDeleteJob(job.id)}
                className="text-xs px-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Management</h1>
        </div>
        {user?.role === "parent" && (
          <Button
            onClick={() => setShowJobModal(true)}
            className="mint-primary mint-button"
          >
            ➕ Create New Job
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      {user?.role === "parent" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
              <div className="text-sm text-gray-600">Active Jobs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">${stats.totalEarnings.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Total Paid</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{children && Array.isArray(children) ? children.length : 0}</div>
              <div className="text-sm text-gray-600">Children</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Awaiting Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
        {user?.role === "parent" && children && Array.isArray(children) && children.length > 0 && (
          <Select value={childFilter} onValueChange={setChildFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by child" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Children</SelectItem>
              {children.map((child: any) => (
                <SelectItem key={child.id} value={child.id.toString()}>
                  {child.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="amount">Highest Amount</SelectItem>
            <SelectItem value="name">Alphabetical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Job Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Active Jobs ({activeJobs.length})</TabsTrigger>
          <TabsTrigger value="completed">Job History ({completedJobs.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-6">
          {activeJobs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeJobs.map(renderJobCard)}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <DollarSign className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Jobs</h3>
                <p className="text-gray-500 mb-4">
                  {user?.role === "parent" 
                    ? "Create new jobs to get started with earning opportunities for your children."
                    : "No jobs have been assigned to you yet. Check back later!"}
                </p>
                {user?.role === "parent" && (
                  <Button onClick={() => setShowJobModal(true)} className="mint-primary">
                    Create First Job
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="completed" className="mt-6">
          {completedJobs.length > 0 ? (
            <div className="space-y-4">
              {user?.role === "parent" && (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-gray-600">
                      <strong>{completedJobs.length}</strong> completed jobs • Total paid: <strong>${completedJobs.reduce((sum: number, job: any) => sum + parseFloat(job.amount), 0).toFixed(2)}</strong>
                    </div>
                    {selectedJobs.length > 0 && (
                      <div className="text-sm text-blue-600 font-medium">
                        {selectedJobs.length} selected
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowBulkActions(!showBulkActions)}
                      className="text-xs"
                    >
                      {showBulkActions ? "Cancel Selection" : "Select Multiple"}
                    </Button>
                    {selectedJobs.length > 0 && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          if (window.confirm(`Delete ${selectedJobs.length} selected jobs? This action cannot be undone.`)) {
                            selectedJobs.forEach(jobId => handleDeleteJob(jobId));
                            setSelectedJobs([]);
                            setShowBulkActions(false);
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Delete Selected ({selectedJobs.length})
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        if (window.confirm(`Export ${completedJobs.length} completed jobs to CSV?`)) {
                          console.log("Exporting completed jobs...");
                        }
                      }}
                      className="text-xs"
                    >
                      Export Data
                    </Button>
                  </div>
                </div>
              )}
              {completedJobs.map((job: any) => (
                <Card key={job.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {showBulkActions && user?.role === "parent" && (
                          <input
                            type="checkbox"
                            checked={selectedJobs.includes(job.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedJobs(prev => [...prev, job.id]);
                              } else {
                                setSelectedJobs(prev => prev.filter(id => id !== job.id));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        )}
                        <JobIcon iconName={job.icon} className="h-5 w-5 text-gray-500" />
                        <div>
                          <h4 className="font-medium text-gray-900">{job.title}</h4>
                          <p className="text-sm text-gray-600">{job.description}</p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-gray-500 flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              {getChildName(job.childId)}
                            </span>
                            <span className="text-xs text-gray-500 flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              Completed {new Date(job.updatedAt || job.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600 mb-1">
                            ${parseFloat(job.amount).toFixed(2)}
                          </div>
                          {getStatusBadge(job.status)}
                        </div>
                        {user?.role === "parent" && (
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setSelectedJob(job);
                                setShowPaymentModal(true);
                              }}
                              className="text-xs px-3"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Details
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setSelectedJob(job);
                                setEditingPayment(false);
                                setShowEditModal(true);
                              }}
                              className="text-xs px-3"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to remove "${job.title}" from the job history? This action cannot be undone.`)) {
                                  handleDeleteJob(job.id);
                                }
                              }}
                              className="text-xs px-3 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <Calendar className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Completed Jobs</h3>
                <p className="text-gray-500">
                  Completed and approved jobs will appear here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <JobCreationModal isOpen={showJobModal} onClose={() => setShowJobModal(false)} />
      <PaymentApprovalModal 
        isOpen={showPaymentModal} 
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedJob(null);
        }} 
        job={selectedJob}
      />
      
      {/* Enhanced Edit Dialog */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Edit Job {selectedJob?.status === "approved" ? "(Completed)" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <Input 
                value={selectedJob?.title || ""} 
                onChange={(e) => setSelectedJob((prev: any) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Input 
                value={selectedJob?.description || ""} 
                onChange={(e) => setSelectedJob((prev: any) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Amount ($)</label>
              <Input 
                type="number"
                step="0.01"
                value={selectedJob?.amount || ""} 
                onChange={(e) => setSelectedJob((prev: any) => ({ ...prev, amount: e.target.value }))}
              />
              {selectedJob?.status === "approved" && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Changing the amount of a completed job will not update payment balances
                </p>
              )}
            </div>
            
            {selectedJob?.status === "approved" && (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> This is a completed job. You can edit job details or payment allocations.
                  </p>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant={!editingPayment ? "default" : "outline"}
                    onClick={() => setEditingPayment(false)}
                    className="text-xs"
                  >
                    Job Details
                  </Button>
                  <Button 
                    size="sm" 
                    variant={editingPayment ? "default" : "outline"}
                    onClick={() => {
                      setEditingPayment(true);
                      if (existingPayment) {
                        setPaymentAllocation({
                          spendingAmount: parseFloat(existingPayment.spendingAmount || "0"),
                          savingsAmount: parseFloat(existingPayment.savingsAmount || "0"),
                          rothIraAmount: parseFloat(existingPayment.rothIraAmount || "0"),
                          brokerageAmount: parseFloat(existingPayment.brokerageAmount || "0"),
                        });
                      }
                    }}
                    className="text-xs"
                  >
                    Payment Allocation
                  </Button>
                </div>

                {editingPayment && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-gray-900">Edit Payment Allocation</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {accountTypes?.spendingEnabled && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Spending ($)</label>
                          <Input 
                            type="number"
                            step="0.01"
                            value={paymentAllocation.spendingAmount} 
                            onChange={(e) => setPaymentAllocation(prev => ({ 
                              ...prev, 
                              spendingAmount: parseFloat(e.target.value) || 0 
                            }))}
                          />
                        </div>
                      )}
                      {accountTypes?.savingsEnabled && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Savings ($)</label>
                          <Input 
                            type="number"
                            step="0.01"
                            value={paymentAllocation.savingsAmount} 
                            onChange={(e) => setPaymentAllocation(prev => ({ 
                              ...prev, 
                              savingsAmount: parseFloat(e.target.value) || 0 
                            }))}
                          />
                        </div>
                      )}
                      {accountTypes?.rothIraEnabled && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Roth IRA ($)</label>
                          <Input 
                            type="number"
                            step="0.01"
                            value={paymentAllocation.rothIraAmount} 
                            onChange={(e) => setPaymentAllocation(prev => ({ 
                              ...prev, 
                              rothIraAmount: parseFloat(e.target.value) || 0 
                            }))}
                          />
                        </div>
                      )}
                      {accountTypes?.brokerageEnabled && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Brokerage ($)</label>
                          <Input 
                            type="number"
                            step="0.01"
                            value={paymentAllocation.brokerageAmount} 
                            onChange={(e) => setPaymentAllocation(prev => ({ 
                              ...prev, 
                              brokerageAmount: parseFloat(e.target.value) || 0 
                            }))}
                          />
                        </div>
                      )}
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">
                        Total: ${(paymentAllocation.spendingAmount + paymentAllocation.savingsAmount + paymentAllocation.rothIraAmount + paymentAllocation.brokerageAmount).toFixed(2)} 
                        {selectedJob && ` of $${parseFloat(selectedJob.amount).toFixed(2)}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
          </div>
          <div className="flex justify-end space-x-2 pt-4 border-t bg-white dark:bg-gray-800 mt-auto">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (editingPayment) {
                    // Validate allocation totals
                    const total = paymentAllocation.spendingAmount + paymentAllocation.savingsAmount + 
                                 paymentAllocation.rothIraAmount + paymentAllocation.brokerageAmount;
                    const jobAmount = parseFloat(selectedJob.amount);
                    
                    if (Math.abs(total - jobAmount) > 0.01) {
                      toast({
                        title: "Invalid Allocation",
                        description: `Total allocation ($${total.toFixed(2)}) must equal job amount ($${jobAmount.toFixed(2)})`,
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    updatePaymentMutation.mutate({
                      jobId: selectedJob.id,
                      allocation: paymentAllocation
                    });
                  } else {
                    updateJobMutation.mutate({
                      id: selectedJob.id,
                      title: selectedJob.title,
                      description: selectedJob.description,
                      amount: selectedJob.amount
                    });
                  }
                  setShowEditModal(false);
                  setEditingPayment(false);
                }}
                disabled={updateJobMutation.isPending || updatePaymentMutation.isPending}
              >
                {(updateJobMutation.isPending || updatePaymentMutation.isPending) ? "Saving..." : 
                 editingPayment ? "Update Payment" : "Save Changes"}
              </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
