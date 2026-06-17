import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useKidMode } from "@/hooks/use-kid-mode";
import { useSelectedChild } from "@/components/navigation";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconText } from "@/components/icon-text";
import type { AccountTypesRow, DashboardStats, JobRow, PaymentRow } from "@/lib/api-types";
import { taskLabels } from "@/lib/task-labels";

export default function Payments() {
  const { user } = useAuth();
  const { mode: kidMode } = useKidMode();
  const { selectedChildId } = useSelectedChild();
  const labels = taskLabels(user?.role === "parent" ? "parent" : "child", kidMode);

  const { data: payments, isLoading: paymentsLoading } = useQuery<PaymentRow[]>({
    queryKey: ["/api/payments"],
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard-stats", selectedChildId],
    queryFn: async () => {
      const url =
        user?.role === "parent" && selectedChildId
          ? `/api/dashboard-stats?childId=${encodeURIComponent(selectedChildId)}`
          : "/api/dashboard-stats";
      const res = await apiRequest("GET", url);
      return await res.json();
    },
  });

  const { data: accountTypes } = useQuery<AccountTypesRow>({
    queryKey: [`/api/account-types/${user?.familyId}`],
    enabled: !!user?.familyId,
  });

  const { data: jobs } = useQuery<JobRow[]>({
    queryKey: ["/api/jobs"],
  });

  const child = dashboardData?.child;
  const isLoading = paymentsLoading || dashboardLoading;
  const isYoungestChild = user?.role === "child" && kidMode === "youngest";

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {user?.role === "parent" ? "Payment History" : isYoungestChild ? (
            <IconText icon="💰" label="My Money" size="lg" />
          ) : (
            "My Money"
          )}
        </h1>
        <p className="text-gray-600">
          {user?.role === "parent" 
            ? "Track all payments and balance allocations" 
            : isYoungestChild
              ? (
                <IconText icon="🌟" label="This is your money!" size="sm" className="text-gray-600" />
              )
              : "See how your earnings are growing across different accounts"
          }
        </p>
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {accountTypes?.spendingEnabled && (
          <Card className="mint-card">
            <CardContent className={isYoungestChild ? "p-5" : "p-6"}>
              {isYoungestChild ? (
                <div className="text-center space-y-2">
                  <IconText icon="🛒" label="Spend" layout="vertical" size="md" />
                  <p className="text-2xl font-black text-blue-600">${parseFloat(child?.spendingBalance || "0").toFixed(2)}</p>
                  <p className="text-sm font-bold text-blue-600">To buy things</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Spending</p>
                      <p className="text-2xl font-bold text-blue-600">
                        ${parseFloat(child?.spendingBalance || "0").toFixed(2)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                      <span className="text-blue-600 text-xl">🛒</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm">
                    <span className="text-blue-600 font-medium">Available to spend</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {accountTypes?.savingsEnabled && (
          <Card className="mint-card">
            <CardContent className={isYoungestChild ? "p-5" : "p-6"}>
              {isYoungestChild ? (
                <div className="text-center space-y-2">
                  <IconText icon="🐷" label="Save" layout="vertical" size="md" />
                  <p className="text-2xl font-black text-green-600">${parseFloat(child?.savingsBalance || "0").toFixed(2)}</p>
                  <p className="text-sm font-bold text-green-600">For later!</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Savings</p>
                      <p className="text-2xl font-bold text-green-600">
                        ${parseFloat(child?.savingsBalance || "0").toFixed(2)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                      <span className="text-green-600 text-xl">🐷</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm">
                    <span className="text-green-600 font-medium">Growing savings</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!isYoungestChild && accountTypes?.rothIraEnabled && (
          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Roth IRA</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ${parseFloat(child?.rothIraBalance || "0").toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <span className="text-purple-600 text-xl">📈</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-purple-600 font-medium">Retirement fund</span>
              </div>
            </CardContent>
          </Card>
        )}

        {!isYoungestChild && accountTypes?.brokerageEnabled && (
          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Brokerage</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    ${parseFloat(child?.brokerageBalance || "0").toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                  <span className="text-yellow-600 text-xl">📊</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-yellow-600 font-medium">Investment account</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {isYoungestChild && (
        <Card className="mint-card">
          <CardContent className="p-6">
            <div className="text-center text-gray-600 space-y-2">
              <IconText icon="🌟" label="Want more?" layout="vertical" size="md" />
              <p className="text-sm font-medium">
                <IconText icon="✅" label={`Go to ${labels.nav} and finish one!`} size="sm" className="justify-center" />
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      {!isYoungestChild && (
        <Card className="mint-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">
            💰 Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments && payments.length > 0 ? (
            <div className="space-y-4">
              {payments.map((payment: any) => {
                const linkedJob = jobs?.find((job: any) => job.id === payment.jobId);
                return (
                <div
                  key={payment.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {linkedJob
                          ? linkedJob.title
                          : payment.source === "allowance" || payment.jobId === 0
                            ? payment.label ?? "Allowance payout"
                            : "Task payment"}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {linkedJob && linkedJob.description && (
                          <span className="block">{linkedJob.description}</span>
                        )}
                        <span className="text-xs text-gray-500">
                          Payment received: {new Date(payment.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      +${parseFloat(payment.amount).toFixed(2)}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {accountTypes?.spendingEnabled && parseFloat(payment.spendingAmount) > 0 && (
                      <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                        <span className="text-blue-700 font-medium">Spending:</span>
                        <span className="text-blue-900">${parseFloat(payment.spendingAmount).toFixed(2)}</span>
                      </div>
                    )}
                    
                    {accountTypes?.savingsEnabled && parseFloat(payment.savingsAmount) > 0 && (
                      <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                        <span className="text-green-700 font-medium">Savings:</span>
                        <span className="text-green-900">${parseFloat(payment.savingsAmount).toFixed(2)}</span>
                      </div>
                    )}
                    
                    {accountTypes?.rothIraEnabled && parseFloat(payment.rothIraAmount) > 0 && (
                      <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                        <span className="text-purple-700 font-medium">Roth IRA:</span>
                        <span className="text-purple-900">${parseFloat(payment.rothIraAmount).toFixed(2)}</span>
                      </div>
                    )}
                    
                    {accountTypes?.brokerageEnabled && parseFloat(payment.brokerageAmount) > 0 && (
                      <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                        <span className="text-yellow-700 font-medium">Brokerage:</span>
                        <span className="text-yellow-900">${parseFloat(payment.brokerageAmount).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">💳</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No payments yet</h3>
              <p className="text-gray-600">
                {user?.role === "parent"
                  ? `Payments will appear here when you approve completed ${labels.plural}`
                  : `Complete ${labels.plural} to start earning money across your accounts`}
              </p>
            </div>
          )}
        </CardContent>
        </Card>
      )}
    </main>
  );
}