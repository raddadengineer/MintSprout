import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput, isValidCurrencyAmount } from "@/components/currency-input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AccountTypesRow, AllocationRow, PaymentRow } from "@/lib/api-types";
import { taskLabels } from "@/lib/task-labels";
import {
  buildAllocationAmounts,
  normalizeAllocation,
  sumEnabledAllocation,
  type PaymentAllocationAmounts,
} from "@/lib/payment-allocation";

interface PaymentApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
}

type ApprovePayload = {
  useCustom: boolean;
  allocation: PaymentAllocationAmounts | null;
  amount: string;
};

export function PaymentApprovalModal({ isOpen, onClose, job }: PaymentApprovalModalProps) {
  const { user } = useAuth();
  const labels = taskLabels("parent");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [useCustomAllocation, setUseCustomAllocation] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [customAllocation, setCustomAllocation] = useState<PaymentAllocationAmounts>({
    spendingAmount: 0,
    savingsAmount: 0,
    rothIraAmount: 0,
    brokerageAmount: 0,
  });
  const initializedJobIdRef = useRef<number | null>(null);

  const { data: allocation } = useQuery<AllocationRow>({
    queryKey: [`/api/allocation/${job?.assignedToId}`],
    enabled: isOpen && !!job?.assignedToId,
  });

  const { data: accountTypes } = useQuery<AccountTypesRow>({
    queryKey: [`/api/account-types/${user?.familyId}`],
    enabled: isOpen && !!user?.familyId,
  });

  const { data: existingPayment, refetch: refetchPayment } = useQuery<PaymentRow>({
    queryKey: [`/api/payments/job/${job?.id}`],
    enabled: isOpen && !!job?.id && job?.status === "approved",
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (isOpen && job?.status === "approved" && job?.id) {
      refetchPayment();
    }
  }, [isOpen, job?.status, job?.id, refetchPayment]);

  useEffect(() => {
    if (!isOpen) {
      initializedJobIdRef.current = null;
      return;
    }
    if (!job?.id || initializedJobIdRef.current === job.id) return;
    setUseCustomAllocation(false);
    setPaymentAmount(parseFloat(job.amount).toFixed(2));
    initializedJobIdRef.current = job.id;
  }, [isOpen, job?.id, job?.amount]);

  useEffect(() => {
    if (!allocation || !accountTypes || !paymentAmount || useCustomAllocation) return;
    const amount = parseFloat(paymentAmount);
    if (!Number.isFinite(amount)) return;
    setCustomAllocation(buildAllocationAmounts(amount, allocation, accountTypes));
  }, [allocation, accountTypes, paymentAmount, useCustomAllocation]);

  const approveJobMutation = useMutation({
    mutationFn: ({ useCustom, allocation: allocationData, amount }: ApprovePayload) =>
      apiRequest("PATCH", `/api/jobs/${job.id}`, {
        status: "approved",
        amount,
        customAllocation: useCustom ? allocationData : null,
      }),
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Task approved and payment processed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve task",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidCurrencyAmount(paymentAmount)) {
      toast({
        title: "Invalid amount",
        description: "Enter a valid payment amount for this task",
        variant: "destructive",
      });
      return;
    }

    const jobAmount = parseFloat(paymentAmount);
    const normalized = normalizeAllocation(customAllocation, accountTypes);

    if (useCustomAllocation) {
      const total = sumEnabledAllocation(normalized, accountTypes);

      if (Math.abs(total - jobAmount) > 0.01) {
        toast({
          title: "Invalid Allocation",
          description: `Total allocation ($${total.toFixed(2)}) must equal task amount ($${jobAmount.toFixed(2)})`,
          variant: "destructive",
        });
        return;
      }
    }

    approveJobMutation.mutate({
      useCustom: useCustomAllocation,
      allocation: useCustomAllocation ? normalized : null,
      amount: jobAmount.toFixed(2),
    });
  };

  const handleCustomAmountChange = (field: keyof PaymentAllocationAmounts, value: string) => {
    const numValue = parseFloat(value) || 0;
    setCustomAllocation((prev) => ({ ...prev, [field]: numValue }));
  };

  const parsedPaymentAmount = parseFloat(paymentAmount);
  const defaultAllocation =
    job && allocation && accountTypes && Number.isFinite(parsedPaymentAmount)
      ? buildAllocationAmounts(parsedPaymentAmount, allocation, accountTypes)
      : null;

  const enabledAllocationTotal = sumEnabledAllocation(customAllocation, accountTypes);

  if (!job) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {job.status === "approved" ? "Payment Details" : labels.approvePay}
          </DialogTitle>
        </DialogHeader>

        {job.status === "approved" && existingPayment ? (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-2">{job.title}</h3>
              <p className="text-sm text-gray-600 mb-2">{job.description}</p>
              <p className="text-lg font-bold text-primary">Amount: ${parseFloat(job.amount).toFixed(2)}</p>
              <p className="text-sm text-gray-500 mt-2">
                Approved on {new Date(existingPayment.createdAt ?? Date.now()).toLocaleDateString()}
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h4 className="font-semibold text-green-800 mb-3">Payment Allocation</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {accountTypes?.spendingEnabled && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Spending:</span>
                    <span className="font-medium text-green-700">
                      ${parseFloat(existingPayment.spendingAmount).toFixed(2)}
                    </span>
                  </div>
                )}
                {accountTypes?.savingsEnabled && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Savings:</span>
                    <span className="font-medium text-green-700">
                      ${parseFloat(existingPayment.savingsAmount).toFixed(2)}
                    </span>
                  </div>
                )}
                {accountTypes?.rothIraEnabled && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Roth IRA:</span>
                    <span className="font-medium text-green-700">
                      ${parseFloat(existingPayment.rothIraAmount).toFixed(2)}
                    </span>
                  </div>
                )}
                {accountTypes?.brokerageEnabled && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Brokerage:</span>
                    <span className="font-medium text-green-700">
                      ${parseFloat(existingPayment.brokerageAmount).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">{job.title}</h3>
              <p className="text-sm text-gray-600">{job.description}</p>
              <div>
                <Label htmlFor="paymentAmount" className="text-sm font-medium">
                  Payment amount
                </Label>
                <CurrencyInput
                  id="paymentAmount"
                  value={paymentAmount}
                  onChange={setPaymentAmount}
                  className="mt-1"
                />
              </div>
            </div>

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
                        <span className="font-medium">${defaultAllocation.spendingAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {accountTypes?.savingsEnabled && (
                      <div className="flex justify-between">
                        <span>Savings:</span>
                        <span className="font-medium">${defaultAllocation.savingsAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {accountTypes?.rothIraEnabled && (
                      <div className="flex justify-between">
                        <span>Roth IRA:</span>
                        <span className="font-medium">${defaultAllocation.rothIraAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {accountTypes?.brokerageEnabled && (
                      <div className="flex justify-between">
                        <span>Brokerage:</span>
                        <span className="font-medium">${defaultAllocation.brokerageAmount.toFixed(2)}</span>
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
                          onChange={(e) => handleCustomAmountChange("spendingAmount", e.target.value)}
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
                          onChange={(e) => handleCustomAmountChange("savingsAmount", e.target.value)}
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
                          onChange={(e) => handleCustomAmountChange("rothIraAmount", e.target.value)}
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
                          onChange={(e) => handleCustomAmountChange("brokerageAmount", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}

                    <div className="text-sm text-gray-600">
                      Total: ${enabledAllocationTotal.toFixed(2)}
                      / ${Number.isFinite(parsedPaymentAmount) ? parsedPaymentAmount.toFixed(2) : "0.00"}
                    </div>
                  </div>
                )}
              </div>
            </div>

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
        )}
      </DialogContent>
    </Dialog>
  );
}
