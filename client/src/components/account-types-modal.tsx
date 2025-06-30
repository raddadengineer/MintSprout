import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface AccountTypesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AccountTypesSettings {
  spendingEnabled: boolean;
  savingsEnabled: boolean;
  rothIraEnabled: boolean;
  brokerageEnabled: boolean;
}

export function AccountTypesModal({ isOpen, onClose }: AccountTypesModalProps) {
  const [formData, setFormData] = useState({
    spendingEnabled: true,
    savingsEnabled: true,
    rothIraEnabled: false,
    brokerageEnabled: false,
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: accountTypes } = useQuery({
    queryKey: [`/api/account-types/${user?.familyId}`],
    enabled: isOpen && !!user?.familyId,
  });

  useEffect(() => {
    if (accountTypes) {
      setFormData({
        spendingEnabled: accountTypes.spendingEnabled || false,
        savingsEnabled: accountTypes.savingsEnabled || false,
        rothIraEnabled: accountTypes.rothIraEnabled || false,
        brokerageEnabled: accountTypes.brokerageEnabled || false,
      });
    }
  }, [accountTypes]);

  const updateAccountTypesMutation = useMutation({
    mutationFn: (data: AccountTypesSettings) =>
      apiRequest("PUT", `/api/account-types/${user?.familyId}`, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Account types updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/account-types/${user?.familyId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/allocation"] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update account types",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure at least one account type is enabled
    const enabledCount = Object.values(formData).filter(Boolean).length;
    if (enabledCount === 0) {
      toast({
        title: "Error",
        description: "At least one account type must be enabled",
        variant: "destructive",
      });
      return;
    }

    updateAccountTypesMutation.mutate(formData);
  };

  const handleToggle = (field: keyof AccountTypesSettings) => {
    setFormData({ ...formData, [field]: !formData[field] });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">Configure Account Types</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Choose which account types are available for your family. Only enabled accounts will appear during payment allocation.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Spending Account</Label>
                  <p className="text-xs text-gray-500">For immediate purchases and expenses</p>
                </div>
                <Switch
                  checked={formData.spendingEnabled}
                  onCheckedChange={() => handleToggle("spendingEnabled")}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Savings Account</Label>
                  <p className="text-xs text-gray-500">For short-term savings goals</p>
                </div>
                <Switch
                  checked={formData.savingsEnabled}
                  onCheckedChange={() => handleToggle("savingsEnabled")}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Roth IRA</Label>
                  <p className="text-xs text-gray-500">Tax-free retirement savings</p>
                </div>
                <Switch
                  checked={formData.rothIraEnabled}
                  onCheckedChange={() => handleToggle("rothIraEnabled")}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Brokerage Account</Label>
                  <p className="text-xs text-gray-500">For long-term investing</p>
                </div>
                <Switch
                  checked={formData.brokerageEnabled}
                  onCheckedChange={() => handleToggle("brokerageEnabled")}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateAccountTypesMutation.isPending}
              className="flex-1 mint-button"
            >
              {updateAccountTypesMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}