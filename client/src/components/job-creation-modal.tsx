import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconSelector } from "@/components/icon-selector";

interface JobCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Child {
  id: number;
  name: string;
  age: number;
}

export function JobCreationModal({ isOpen, onClose }: JobCreationModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    amount: "",
    recurrence: "once",
    assignedToId: "",
    icon: "briefcase",
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: children } = useQuery({
    queryKey: ["/api/children"],
  });

  const createJobMutation = useMutation({
    mutationFn: (jobData: any) => apiRequest("POST", "/api/jobs", jobData),
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Job created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      onClose();
      setFormData({
        title: "",
        description: "",
        amount: "",
        recurrence: "once",
        assignedToId: "",
        icon: "briefcase",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create job",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.amount || !formData.assignedToId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createJobMutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount).toFixed(2),
      assignedToId: parseInt(formData.assignedToId),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">Create New Job</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Job Title</Label>
            <Input
              type="text"
              className="mint-input"
              placeholder="e.g., Clean my room"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Description</Label>
            <Textarea
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent h-24 resize-none"
              placeholder="What needs to be done?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Job Icon</Label>
            <IconSelector
              selectedIcon={formData.icon}
              onIconSelect={(icon) => setFormData({ ...formData, icon })}
            />
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="mint-input pl-8"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Recurrence</Label>
            <Select value={formData.recurrence} onValueChange={(value) => setFormData({ ...formData, recurrence: value })}>
              <SelectTrigger className="mint-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">One time</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Assign to</Label>
            <Select value={formData.assignedToId} onValueChange={(value) => setFormData({ ...formData, assignedToId: value })}>
              <SelectTrigger className="mint-input">
                <SelectValue placeholder="Select a child" />
              </SelectTrigger>
              <SelectContent>
                {children?.map((child: Child) => (
                  <SelectItem key={child.id} value={child.id.toString()}>
                    {child.name} (Age {child.age})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              disabled={createJobMutation.isPending}
            >
              {createJobMutation.isPending ? "Creating..." : "Create Job"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
