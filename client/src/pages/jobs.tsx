import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { JobCreationModal } from "@/components/job-creation-modal";
import { PaymentApprovalModal } from "@/components/payment-approval-modal";
import { JobIcon } from "@/components/job-icon";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Jobs() {
  const { user } = useAuth();
  const [showJobModal, setShowJobModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["/api/jobs"],
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

  const handleJobAction = (jobId: number, status: string) => {
    updateJobMutation.mutate({ id: jobId, status });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "assigned":
        return <span className="mint-badge-assigned">Assigned</span>;
      case "in_progress":
        return <span className="mint-badge-progress">In Progress</span>;
      case "completed":
        return <span className="mint-badge-completed">⏱️ Awaiting Approval</span>;
      case "approved":
        return <span className="mint-badge-approved">✅ Approved</span>;
      default:
        return <span className="mint-badge-assigned">{status}</span>;
    }
  };



  const groupedJobs = jobs?.reduce((acc: any, job: any) => {
    if (!acc[job.status]) acc[job.status] = [];
    acc[job.status].push(job);
    return acc;
  }, {}) || {};

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Jobs</h1>
          <p className="text-gray-600">Manage and track all your jobs</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Assigned Jobs */}
        <Card className="mint-card">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
              Assigned ({groupedJobs.assigned?.length || 0})
            </h2>
            <div className="space-y-3">
              {groupedJobs.assigned?.length ? (
                groupedJobs.assigned.map((job: any) => (
                  <div key={job.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <JobIcon iconName={job.icon} className="h-5 w-5 text-gray-600" />
                        <div>
                          <h3 className="font-medium text-gray-900 text-sm">{job.title}</h3>
                          <p className="text-xs text-gray-600">{job.description}</p>
                        </div>
                      </div>
                      <span className="font-bold text-primary text-sm">${parseFloat(job.amount).toFixed(2)}</span>
                    </div>
                    {getStatusBadge(job.status)}
                    <div className="mt-2">
                      <Button
                        size="sm"
                        onClick={() => handleJobAction(job.id, "in_progress")}
                        className="w-full mint-secondary text-xs"
                        disabled={updateJobMutation.isPending}
                      >
                        Start Job
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">No assigned jobs</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* In Progress Jobs */}
        <Card className="mint-card">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
              In Progress ({groupedJobs.in_progress?.length || 0})
            </h2>
            <div className="space-y-3">
              {groupedJobs.in_progress?.length ? (
                groupedJobs.in_progress.map((job: any) => (
                  <div key={job.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <JobIcon iconName={job.icon} className="h-5 w-5 text-gray-600" />
                        <div>
                          <h3 className="font-medium text-gray-900 text-sm">{job.title}</h3>
                          <p className="text-xs text-gray-600">{job.description}</p>
                        </div>
                      </div>
                      <span className="font-bold text-primary text-sm">${parseFloat(job.amount).toFixed(2)}</span>
                    </div>
                    {getStatusBadge(job.status)}
                    <div className="mt-2">
                      <Button
                        size="sm"
                        onClick={() => handleJobAction(job.id, "completed")}
                        className="w-full mint-primary text-xs"
                        disabled={updateJobMutation.isPending}
                      >
                        Mark Complete
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">No jobs in progress</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Completed/Awaiting Approval Jobs */}
        <Card className="mint-card">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              Awaiting Approval ({groupedJobs.completed?.length || 0})
            </h2>
            <div className="space-y-3">
              {groupedJobs.completed?.length ? (
                groupedJobs.completed.map((job: any) => (
                  <div key={job.id} className="border border-green-200 bg-green-50 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <JobIcon iconName={job.icon} className="h-5 w-5 text-green-600" />
                        <div>
                          <h3 className="font-medium text-gray-900 text-sm">{job.title}</h3>
                          <p className="text-xs text-gray-600">{job.description}</p>
                        </div>
                      </div>
                      <span className="font-bold text-green-600 text-sm">${parseFloat(job.amount).toFixed(2)}</span>
                    </div>
                    {getStatusBadge(job.status)}
                    {user?.role === "parent" && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          onClick={() => handleJobAction(job.id, "approved")}
                          className="w-full mint-primary text-xs"
                          disabled={updateJobMutation.isPending}
                        >
                          Approve & Pay
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">No jobs awaiting approval</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approved Jobs History */}
      {groupedJobs.approved?.length > 0 && (
        <Card className="mint-card mt-8">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              ✅ Completed Jobs History
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedJobs.approved.map((job: any) => (
                <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <JobIcon iconName={job.icon} className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{job.title}</h3>
                      <p className="text-sm text-gray-600">{job.description}</p>
                    </div>
                    <span className="font-bold text-green-600">${parseFloat(job.amount).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    {getStatusBadge(job.status)}
                    <span className="text-xs text-gray-500">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <JobCreationModal isOpen={showJobModal} onClose={() => setShowJobModal(false)} />
    </main>
  );
}
