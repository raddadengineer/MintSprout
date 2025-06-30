import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { JobCreationModal } from "@/components/job-creation-modal";
import { AllocationModal } from "@/components/allocation-modal";
import { AccountTypesModal } from "@/components/account-types-modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { user } = useAuth();
  const [showJobModal, setShowJobModal] = useState(false);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [showAccountTypesModal, setShowAccountTypesModal] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["/api/dashboard-stats"],
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
        return <span className="mint-badge-approved">Approved</span>;
      default:
        return <span className="mint-badge-assigned">{status}</span>;
    }
  };

  const getJobIcon = (title: string) => {
    if (title.toLowerCase().includes("clean")) return "🧹";
    if (title.toLowerCase().includes("water")) return "🌿";
    if (title.toLowerCase().includes("table")) return "🍽️";
    if (title.toLowerCase().includes("dishes")) return "🧽";
    if (title.toLowerCase().includes("laundry")) return "👕";
    return "✅";
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const child = dashboardData?.child;
  const allocation = dashboardData?.allocation;
  const activeJobs = dashboardData?.activeJobs || [];
  const achievements = dashboardData?.achievements || [];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Dashboard Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, <span className="text-primary">{user?.name}</span>! 🌱
            </h2>
            <p className="text-gray-600 text-lg">
              {user?.role === "parent" 
                ? "Here's how your family's financial learning is progressing!" 
                : "Let's see how your money garden is growing!"
              }
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-wrap gap-3">
            {user?.role === "parent" ? (
              <>
                <Button
                  onClick={() => setShowJobModal(true)}
                  className="mint-primary mint-button shadow-lg hover:shadow-xl"
                >
                  ➕ Create New Job
                </Button>
                <Button 
                  onClick={() => {
                    setSelectedChildId(child?.id || null);
                    setShowAllocationModal(true);
                  }}
                  variant="outline"
                  className="shadow-lg hover:shadow-xl"
                >
                  🎛️ Set Allocations
                </Button>
                <Button 
                  onClick={() => setShowAccountTypesModal(true)}
                  variant="outline"
                  className="shadow-lg hover:shadow-xl"
                >
                  🏦 Configure Accounts
                </Button>
                <Button 
                  variant="outline"
                  className="shadow-lg hover:shadow-xl"
                >
                  📊 View Reports
                </Button>
                <Button 
                  variant="outline"
                  className="shadow-lg hover:shadow-xl"
                >
                  📚 Create Lesson
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline"
                  className="shadow-lg hover:shadow-xl bg-purple-50 hover:bg-purple-100 border-purple-200"
                >
                  ❓ Take Quiz
                </Button>
                <Button 
                  variant="outline"
                  className="shadow-lg hover:shadow-xl bg-red-50 hover:bg-red-100 border-red-200"
                >
                  ▶️ Watch Video
                </Button>
                <Button 
                  variant="outline"
                  className="shadow-lg hover:shadow-xl bg-green-50 hover:bg-green-100 border-green-200"
                >
                  🎯 Set Savings Goal
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Role-based Stats Overview */}
      {user?.role === "parent" ? (
        // Parent Dashboard Stats
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Active Jobs</p>
                  <p className="text-3xl font-bold text-gray-900">{activeJobs.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <span className="text-blue-500 text-xl">📋</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-blue-600 font-medium">Jobs assigned</span>
              </div>
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Child Progress</p>
                  <p className="text-3xl font-bold text-gray-900">{child?.completedJobs || 0}</p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <span className="text-green-500 text-xl">🏆</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-green-600 font-medium">Jobs completed</span>
              </div>
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Family Savings</p>
                  <p className="text-3xl font-bold text-gray-900">
                    ${parseFloat(child?.totalEarned || "0").toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <span className="text-primary text-xl">💰</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-primary font-medium">Total earned</span>
              </div>
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Learning Days</p>
                  <p className="text-3xl font-bold text-gray-900">{child?.learningStreak || 0}</p>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center">
                  <span className="text-orange-500 text-xl">📚</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-orange-500 font-medium">Learning streak</span>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Child Dashboard Stats
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Earned</p>
                  <p className="text-3xl font-bold text-gray-900">
                    ${parseFloat(child?.totalEarned || "0").toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <span className="text-primary text-xl">💰</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-green-600 font-medium">Growing!</span>
              </div>
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Jobs Completed</p>
                  <p className="text-3xl font-bold text-gray-900">{child?.completedJobs || 0}</p>
                </div>
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center">
                  <span className="text-secondary text-xl">✅</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-green-600 font-medium">Keep it up!</span>
              </div>
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Savings Goal</p>
                  <p className="text-3xl font-bold text-gray-900">68%</p>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                  <span className="text-accent text-xl">🐷</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-accent h-2 rounded-full" style={{ width: "68%" }}></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Learning Streak</p>
                  <p className="text-3xl font-bold text-gray-900">{child?.learningStreak || 0} days</p>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center">
                  <span className="text-orange-500 text-xl">🔥</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-orange-500 font-medium">🔥 On fire!</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Jobs and Money Allocation */}
        <div className="lg:col-span-2 space-y-8">
          {/* Active Jobs */}
          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  ✅ Active Jobs
                </h3>
                <Button variant="ghost" className="text-primary hover:text-green-600 font-medium text-sm">
                  View All
                </Button>
              </div>
              
              <div className="space-y-4">
                {activeJobs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No active jobs found</p>
                    {user?.role === "parent" && (
                      <Button
                        onClick={() => setShowJobModal(true)}
                        className="mt-4 mint-primary"
                      >
                        Create Your First Job
                      </Button>
                    )}
                  </div>
                ) : (
                  activeJobs.map((job: any) => (
                    <div key={job.id} className="border border-gray-200 rounded-xl p-4 hover:border-primary transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-blue-600 text-lg">{getJobIcon(job.title)}</span>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{job.title}</h4>
                            <p className="text-sm text-gray-600">{job.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary text-lg">${parseFloat(job.amount).toFixed(2)}</p>
                          {getStatusBadge(job.status)}
                        </div>
                      </div>
                      
                      <div className="mt-4 flex space-x-2">
                        {job.status === "assigned" && (
                          <Button
                            onClick={() => handleJobAction(job.id, "in_progress")}
                            className="flex-1 mint-secondary"
                            disabled={updateJobMutation.isPending}
                          >
                            Start Job
                          </Button>
                        )}
                        {job.status === "in_progress" && (
                          <Button
                            onClick={() => handleJobAction(job.id, "completed")}
                            className="flex-1 mint-primary"
                            disabled={updateJobMutation.isPending}
                          >
                            Mark Complete
                          </Button>
                        )}
                        {job.status === "completed" && user?.role === "parent" && (
                          <Button
                            onClick={() => handleJobAction(job.id, "approved")}
                            className="flex-1 mint-primary"
                            disabled={updateJobMutation.isPending}
                          >
                            Approve & Pay
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Money Allocation */}
          {allocation && (
            <Card className="mint-card">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">
                  🥧 Money Allocation
                </h3>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-xl">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-blue-600 text-lg">🛒</span>
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Spending</p>
                    <p className="text-2xl font-bold text-blue-600">{allocation.spendingPercentage}%</p>
                    <p className="text-xs text-gray-500">
                      ${((parseFloat(child?.totalEarned || "0") * allocation.spendingPercentage) / 100).toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 rounded-xl">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-green-600 text-lg">🐷</span>
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Savings</p>
                    <p className="text-2xl font-bold text-green-600">{allocation.savingsPercentage}%</p>
                    <p className="text-xs text-gray-500">
                      ${((parseFloat(child?.totalEarned || "0") * allocation.savingsPercentage) / 100).toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-purple-50 rounded-xl">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-purple-600 text-lg">📈</span>
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Roth IRA</p>
                    <p className="text-2xl font-bold text-purple-600">{allocation.rothIraPercentage}%</p>
                    <p className="text-xs text-gray-500">
                      ${((parseFloat(child?.totalEarned || "0") * allocation.rothIraPercentage) / 100).toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-yellow-50 rounded-xl">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-yellow-600 text-lg">📊</span>
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Brokerage</p>
                    <p className="text-2xl font-bold text-yellow-600">{allocation.brokeragePercentage}%</p>
                    <p className="text-xs text-gray-500">
                      ${((parseFloat(child?.totalEarned || "0") * allocation.brokeragePercentage) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
                
                {user?.role === "parent" && (
                  <Button
                    onClick={() => {
                      setSelectedChildId(child?.id || null);
                      setShowAllocationModal(true);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    🎛️ Customize Allocation
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Role-based Content */}
        <div className="space-y-8">
          {user?.role === "parent" ? (
            // Parent Sidebar Content
            <>
              {/* Family Overview */}
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4">
                    👨‍👩‍👧‍👦 Family Overview
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="bg-white/20 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Children Enrolled</span>
                        <span className="text-lg font-bold">1</span>
                      </div>
                      <p className="text-sm text-white/80">Emma is learning financial literacy</p>
                    </div>
                    
                    <div className="bg-white/20 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Active Teaching</span>
                        <span className="text-lg font-bold">{activeJobs.length}</span>
                      </div>
                      <p className="text-sm text-white/80">Jobs currently assigned</p>
                    </div>
                  </div>
                  
                  <Button className="w-full bg-white text-blue-600 hover:bg-gray-50 mt-4">
                    Manage Family →
                  </Button>
                </CardContent>
              </Card>


            </>
          ) : (
            // Child Sidebar Content
            <>
              {/* Learning Progress */}
              <Card className="bg-gradient-to-br from-primary to-green-600 text-white">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4">
                    🎓 Learning Progress
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="bg-white/20 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Earning Money</span>
                        <span className="text-sm bg-white/30 px-2 py-1 rounded-lg">Complete!</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2">
                        <div className="bg-white h-2 rounded-full" style={{ width: "100%" }}></div>
                      </div>
                    </div>
                    
                    <div className="bg-white/20 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Saving Money</span>
                        <span className="text-sm">75%</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2">
                        <div className="bg-white h-2 rounded-full" style={{ width: "75%" }}></div>
                      </div>
                    </div>
                    
                    <div className="bg-white/20 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Smart Spending</span>
                        <span className="text-sm">45%</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2">
                        <div className="bg-white h-2 rounded-full" style={{ width: "45%" }}></div>
                      </div>
                    </div>
                  </div>
                  
                  <Button className="w-full bg-white text-primary hover:bg-gray-50 mt-4">
                    Continue Learning →
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Achievements */}
              <Card className="mint-card">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    🏆 Recent Achievements
                  </h3>
                  
                  <div className="space-y-3">
                    {achievements.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No achievements yet!</p>
                    ) : (
                      achievements.map((achievement: any) => (
                        <div key={achievement.id} className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-xl">
                          <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                            <span className="text-white text-sm">{achievement.icon}</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{achievement.title}</p>
                            <p className="text-sm text-gray-600">{achievement.description}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}


        </div>
      </div>

      {/* Modals */}
      <JobCreationModal isOpen={showJobModal} onClose={() => setShowJobModal(false)} />
      {selectedChildId && (
        <AllocationModal
          isOpen={showAllocationModal}
          onClose={() => setShowAllocationModal(false)}
          childId={selectedChildId}
        />
      )}
      <AccountTypesModal 
        isOpen={showAccountTypesModal} 
        onClose={() => setShowAccountTypesModal(false)} 
      />
    </main>
  );
}
