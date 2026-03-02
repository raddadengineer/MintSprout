import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SavingsGoalsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SavingsGoalsModal({ isOpen, onClose }: SavingsGoalsModalProps) {
    const [name, setName] = useState("");
    const [targetAmount, setTargetAmount] = useState("");
    const [deadline, setDeadline] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const createGoalMutation = useMutation({
        mutationFn: (data: { name: string; targetAmount: string; deadline?: string }) =>
            apiRequest("POST", "/api/savings-goals", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/savings-goals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
            setName("");
            setTargetAmount("");
            setDeadline("");
            onClose();
            toast({
                title: "🎯 Savings Goal Created!",
                description: `Great! Your goal "${name}" has been set. Let's start saving!`,
            });
        },
        onError: () => {
            toast({
                title: "❌ Oops!",
                description: "Could not create the savings goal. Please try again.",
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !targetAmount) return;
        createGoalMutation.mutate({
            name,
            targetAmount,
            ...(deadline ? { deadline } : {}),
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-br from-accent to-yellow-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black">🎯 Set a Savings Goal</h2>
                            <p className="text-yellow-100 text-sm font-medium mt-1">
                                What are you saving up for?
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors font-bold text-white"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="goal-name" className="font-bold text-gray-700">
                            🌟 What am I saving for?
                        </Label>
                        <Input
                            id="goal-name"
                            type="text"
                            placeholder="e.g. New bike, Nintendo Switch..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mint-input text-base"
                            required
                            maxLength={60}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="goal-amount" className="font-bold text-gray-700">
                            💰 How much do I need?
                        </Label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">$</span>
                            <Input
                                id="goal-amount"
                                type="number"
                                placeholder="0.00"
                                min="0.01"
                                step="0.01"
                                value={targetAmount}
                                onChange={(e) => setTargetAmount(e.target.value)}
                                className="mint-input pl-8 text-base"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="goal-deadline" className="font-bold text-gray-700">
                            📅 When do I want to reach this goal?{" "}
                            <span className="text-gray-400 font-normal text-sm">(optional)</span>
                        </Label>
                        <Input
                            id="goal-deadline"
                            type="date"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            className="mint-input text-base"
                        />
                    </div>

                    {/* Preview */}
                    {name && targetAmount && (
                        <div className="bg-yellow-50 rounded-2xl p-4 border-2 border-yellow-200">
                            <p className="font-black text-gray-800 text-sm">Preview:</p>
                            <p className="text-gray-700 font-medium mt-1">
                                🎯 I'm saving <span className="font-black text-primary">${parseFloat(targetAmount || "0").toFixed(2)}</span> for{" "}
                                <span className="font-black text-accent">{name}</span>
                                {deadline && (
                                    <> by <span className="font-black">{new Date(deadline + "T12:00:00").toLocaleDateString()}</span></>
                                )}
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 font-bold"
                            disabled={createGoalMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 mint-accent mint-button"
                            disabled={createGoalMutation.isPending || !name || !targetAmount}
                        >
                            {createGoalMutation.isPending ? "Creating..." : "🎯 Create Goal!"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
