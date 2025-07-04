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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  childId: number;
}

interface AllocationSettings {
  spendingPercentage: number;
  savingsPercentage: number;
  rothIraPercentage: number;
  brokeragePercentage: number;
}

export function AllocationModal({ isOpen, onClose, childId }: AllocationModalProps) {
  const [formData, setFormData] = useState({
    spendingPercentage: 20,
    savingsPercentage: 30,
    rothIraPercentage: 25,
    brokeragePercentage: 25,
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: currentSettings } = useQuery({
    queryKey: [`/api/allocation/${childId}`],
    enabled: isOpen && !!childId,
  });

  const { data: accountTypes } = useQuery({
    queryKey: [`/api/account-types/${user?.familyId}`],
    enabled: isOpen && !!user?.familyId,
  });

  useEffect(() => {
    if (currentSettings && accountTypes) {
      // Calculate initial values based on enabled accounts
      const enabledAccounts = [];
      if (accountTypes.spendingEnabled) enabledAccounts.push('spending');
      if (accountTypes.savingsEnabled) enabledAccounts.push('savings');
      if (accountTypes.rothIraEnabled) enabledAccounts.push('rothIra');
      if (accountTypes.brokerageEnabled) enabledAccounts.push('brokerage');
      
      // Set form data with current settings or distribute equally among enabled accounts
      const equalPercentage = Math.floor(100 / enabledAccounts.length);
      const remainder = 100 - (equalPercentage * enabledAccounts.length);
      
      setFormData({
        spendingPercentage: accountTypes.spendingEnabled 
          ? (currentSettings.spendingPercentage || equalPercentage + (enabledAccounts[0] === 'spending' ? remainder : 0))
          : 0,
        savingsPercentage: accountTypes.savingsEnabled 
          ? (currentSettings.savingsPercentage || equalPercentage + (enabledAccounts[0] === 'savings' ? remainder : 0))
          : 0,
        rothIraPercentage: accountTypes.rothIraEnabled 
          ? (currentSettings.rothIraPercentage || equalPercentage + (enabledAccounts[0] === 'rothIra' ? remainder : 0))
          : 0,
        brokeragePercentage: accountTypes.brokerageEnabled 
          ? (currentSettings.brokeragePercentage || equalPercentage + (enabledAccounts[0] === 'brokerage' ? remainder : 0))
          : 0,
      });
    }
  }, [currentSettings, accountTypes]);

  const updateAllocationMutation = useMutation({
    mutationFn: (data: AllocationSettings) =>
      apiRequest("PATCH", `/api/allocation/${childId}`, data),
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Allocation settings updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/allocation/${childId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update allocation settings",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate total based only on enabled accounts
    let total = 0;
    if (accountTypes?.spendingEnabled) total += formData.spendingPercentage;
    if (accountTypes?.savingsEnabled) total += formData.savingsPercentage;
    if (accountTypes?.rothIraEnabled) total += formData.rothIraPercentage;
    if (accountTypes?.brokerageEnabled) total += formData.brokeragePercentage;
    
    if (total !== 100) {
      toast({
        title: "Error",
        description: `Percentages must sum to 100%. Current total: ${total}%`,
        variant: "destructive",
      });
      return;
    }

    updateAllocationMutation.mutate(formData);
  };

  const handlePercentageChange = (field: keyof AllocationSettings, value: string) => {
    const numValue = parseInt(value) || 0;
    setFormData({ ...formData, [field]: numValue });
  };

  const total = formData.spendingPercentage + formData.savingsPercentage + 
                formData.rothIraPercentage + formData.brokeragePercentage;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">Customize Allocation</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {accountTypes?.spendingEnabled && (
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Spending %
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="mint-input pr-8"
                    value={formData.spendingPercentage}
                    onChange={(e) => handlePercentageChange("spendingPercentage", e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                </div>
              </div>
            )}
            
            {accountTypes?.savingsEnabled && (
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Savings %
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="mint-input pr-8"
                    value={formData.savingsPercentage}
                    onChange={(e) => handlePercentageChange("savingsPercentage", e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                </div>
              </div>
            )}
            
            {accountTypes?.rothIraEnabled && (
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Roth IRA %
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="mint-input pr-8"
                    value={formData.rothIraPercentage}
                    onChange={(e) => handlePercentageChange("rothIraPercentage", e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                </div>
              </div>
            )}
            
            {accountTypes?.brokerageEnabled && (
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Brokerage %
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="mint-input pr-8"
                    value={formData.brokeragePercentage}
                    onChange={(e) => handlePercentageChange("brokeragePercentage", e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="text-center py-2">
            <span className={`text-sm font-medium ${total === 100 ? 'text-green-600' : 'text-red-600'}`}>
              Total: {total}%
            </span>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 mint-primary mint-button"
              disabled={updateAllocationMutation.isPending || total !== 100}
            >
              {updateAllocationMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
