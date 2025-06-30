import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PaymentApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
}

interface CustomAllocation {
  spendingAmount: number;
  savingsAmount: number;
  rothIraAmount: number;
  brokerageAmount: number;
}

export function PaymentApprovalModal({ isOpen, onClose, job }: PaymentApprovalModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [useCustomAllocation, setUseCustomAllocation] = useState(false);
  const [customAllocation, setCustomAllocation] = useState<CustomAllocation>({
    spendingAmount: 0,
    savingsAmount: 0,
    rothIraAmount: 0,
    brokerageAmount: 0,
  });

  const { data: allocation } = useQuery({
    queryKey: [`/api/allocation/${job?.assignedToId}`],
    enabled: isOpen && !!job?.assignedToId,
  });

  const { data: accountTypes } = useQuery({
    queryKey: [`/api/account-types/${user?.familyId}`],
    enabled: isOpen && !!user?.familyId,
  });

  useEffect(() => {
    if (job && allocation) {
      const amount = parseFloat(job.amount);
      setCustomAllocation({
        spendingAmount: parseFloat(((allocation.spendingPercentage / 100) * amount).toFixed(2)),
        savingsAmount: parseFloat(((allocation.savingsPercentage / 100) * amount).toFixed(2)),
        rothIraAmount: parseFloat(((allocation.rothIraPercentage / 100) * amount).toFixed(2)),
        brokerageAmount: parseFloat(((allocation.brokeragePercentage / 100) * amount).toFixed(2)),
      });
    }
  }, [job, allocation]);

  const approveJobMutation = useMutation({
    mutationFn: (allocationData: any) =>
      apiRequest("PATCH", `/api/jobs/${job.id}`, {
        status: "approved",
        customAllocation: useCustomAllocation ? allocationData : null,
      }),
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Job approved and payment processed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve job",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate custom allocation totals match job amount
    if (useCustomAllocation) {
      const total = Object.values(customAllocation).reduce((sum, amount) => sum + amount, 0);
      const jobAmount = parseFloat(job.amount);
      
      if (Math.abs(total - jobAmount) > 0.01) {
        toast({
          title: "Invalid Allocation",
          description: `Total allocation ($${total.toFixed(2)}) must equal job amount ($${jobAmount.toFixed(2)})`,
          variant: "destructive",
        });
        return;
      }
    }

    approveJobMutation.mutate(useCustomAllocation ? customAllocation : null);
  };

  const handleCustomAmountChange = (field: keyof CustomAllocation, value: string) => {
    const numValue = parseFloat(value) || 0;
    setCustomAllocation(prev => ({ ...prev, [field]: numValue }));
  };

  const defaultAllocation = job && allocation ? {
    spendingAmount: ((allocation.spendingPercentage / 100) * parseFloat(job.amount)).toFixed(2),
    savingsAmount: ((allocation.savingsPercentage / 100) * parseFloat(job.amount)).toFixed(2),
    rothIraAmount: ((allocation.rothIraPercentage / 100) * parseFloat(job.amount)).toFixed(2),
    brokerageAmount: ((allocation.brokeragePercentage / 100) * parseFloat(job.amount)).toFixed(2),
  } : null;

  if (!job) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve Job & Process Payment</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Job Details */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-2">{job.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{job.description}</p>
            <p className="text-lg font-bold text-primary">Amount: ${parseFloat(job.amount).toFixed(2)}</p>
          </div>

          {/* Allocation Options */}
          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={!useCustomAllocation}
                  onChange={() => setUseCustomAllocation(false)}
                  className="text-primary"
                />
                <span className="font-medium">Use Default Allocation</span>
              </label>
              
              {!useCustomAllocation && defaultAllocation && (
                <div className="mt-3 ml-6 grid grid-cols-2 gap-3 text-sm">
                  {accountTypes?.spendingEnabled && (
                    <div className="flex justify-between">
                      <span>Spending:</span>
                      <span className="font-medium">${defaultAllocation.spendingAmount}</span>
                    </div>
                  )}
                  {accountTypes?.savingsEnabled && (
                    <div className="flex justify-between">
                      <span>Savings:</span>
                      <span className="font-medium">${defaultAllocation.savingsAmount}</span>
                    </div>
                  )}
                  {accountTypes?.rothIraEnabled && (
                    <div className="flex justify-between">
                      <span>Roth IRA:</span>
                      <span className="font-medium">${defaultAllocation.rothIraAmount}</span>
                    </div>
                  )}
                  {accountTypes?.brokerageEnabled && (
                    <div className="flex justify-between">
                      <span>Brokerage:</span>
                      <span className="font-medium">${defaultAllocation.brokerageAmount}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={useCustomAllocation}
                  onChange={() => setUseCustomAllocation(true)}
                  className="text-primary"
                />
                <span className="font-medium">Customize This Payment</span>
              </label>
              
              {useCustomAllocation && (
                <div className="mt-3 ml-6 space-y-3">
                  {accountTypes?.spendingEnabled && (
                    <div>
                      <Label htmlFor="spendingAmount">Spending Amount</Label>
                      <Input
                        id="spendingAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={customAllocation.spendingAmount}
                        onChange={(e) => handleCustomAmountChange('spendingAmount', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  )}
                  
                  {accountTypes?.savingsEnabled && (
                    <div>
                      <Label htmlFor="savingsAmount">Savings Amount</Label>
                      <Input
                        id="savingsAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={customAllocation.savingsAmount}
                        onChange={(e) => handleCustomAmountChange('savingsAmount', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  )}
                  
                  {accountTypes?.rothIraEnabled && (
                    <div>
                      <Label htmlFor="rothIraAmount">Roth IRA Amount</Label>
                      <Input
                        id="rothIraAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={customAllocation.rothIraAmount}
                        onChange={(e) => handleCustomAmountChange('rothIraAmount', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  )}
                  
                  {accountTypes?.brokerageEnabled && (
                    <div>
                      <Label htmlFor="brokerageAmount">Brokerage Amount</Label>
                      <Input
                        id="brokerageAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={customAllocation.brokerageAmount}
                        onChange={(e) => handleCustomAmountChange('brokerageAmount', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-600">
                    Total: ${Object.values(customAllocation).reduce((sum, amount) => sum + amount, 0).toFixed(2)} 
                    / ${parseFloat(job.amount).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={approveJobMutation.isPending}
              className="mint-primary"
            >
              {approveJobMutation.isPending ? "Processing..." : "Approve & Pay"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}