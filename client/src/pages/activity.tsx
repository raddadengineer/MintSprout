import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedChild } from "@/components/navigation";
import { useKidMode } from "@/hooks/use-kid-mode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Transaction = {
  id: number;
  childId: number;
  type: string;
  amount: string;
  fromAccount: string | null;
  toAccount: string | null;
  note: string | null;
  createdAt: string;
};

function iconForType(type: string): string {
  if (type === "payment") return "💰";
  if (type === "spend") return "🛒";
  if (type === "refund_spend") return "↩️";
  if (type === "donate") return "❤️";
  if (type === "refund_donate") return "↩️";
  if (type === "goal_fund") return "🎯";
  return "🧾";
}

function formatAccount(a: string | null): string {
  if (!a) return "";
  if (a === "rothIra") return "Roth IRA";
  if (a === "brokerage") return "Brokerage";
  return a.charAt(0).toUpperCase() + a.slice(1);
}

function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function Activity() {
  const { user } = useAuth();
  const { selectedChildId } = useSelectedChild();
  const { mode: kidMode } = useKidMode();

  const isParent = user?.role === "parent";
  const isYoungestChild = user?.role === "child" && kidMode === "youngest";
  const effectiveChildId = isParent ? selectedChildId : null;
  const [, setLocation] = useLocation();

  const url = useMemo(() => {
    if (isParent && effectiveChildId) return `/api/transactions?childId=${encodeURIComponent(effectiveChildId)}`;
    return "/api/transactions";
  }, [effectiveChildId, isParent]);

  const { data: txs = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions", effectiveChildId],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(url, { headers, credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return await res.json();
    },
    enabled: !isParent || !!effectiveChildId,
  });

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>(toIsoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [endDate, setEndDate] = useState<string>(toIsoDate(new Date()));

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    for (const t of txs) set.add(t.type);
    return Array.from(set).sort();
  }, [txs]);

  const availableAccounts = useMemo(() => {
    const set = new Set<string>();
    for (const t of txs) {
      if (t.fromAccount) set.add(t.fromAccount);
      if (t.toAccount) set.add(t.toAccount);
    }
    return Array.from(set).sort();
  }, [txs]);

  const filtered = useMemo(() => {
    const start = startDate ? new Date(startDate + "T00:00:00") : null;
    const end = endDate ? new Date(endDate + "T23:59:59") : null;

    return txs.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (
        accountFilter !== "all" &&
        t.fromAccount !== accountFilter &&
        t.toAccount !== accountFilter
      ) {
        return false;
      }
      const when = new Date(t.createdAt);
      if (start && when < start) return false;
      if (end && when > end) return false;
      return true;
    });
  }, [accountFilter, endDate, startDate, txs, typeFilter]);

  const runningBalance = useMemo(() => {
    if (accountFilter === "all") return null;
    const asc = filtered
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    let bal = 0;
    const points: Array<{ id: number; balance: number }> = [];
    for (const t of asc) {
      const amt = parseFloat(t.amount || "0");
      if (t.toAccount === accountFilter) bal += amt;
      if (t.fromAccount === accountFilter) bal -= amt;
      points.push({ id: t.id, balance: bal });
    }
    const latest = points.length > 0 ? points[points.length - 1].balance : 0;
    const map = new Map<number, number>();
    for (const p of points) map.set(p.id, p.balance);
    return { latest, map };
  }, [accountFilter, filtered]);

  const exportCsv = () => {
    const rows = filtered.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      fromAccount: t.fromAccount ?? "",
      toAccount: t.toAccount ?? "",
      note: t.note ?? "",
      createdAt: t.createdAt,
    }));
    const headers = Object.keys(rows[0] || {});
    const csvContent = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => `"${String((r as any)[h] ?? "").replaceAll('"', '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `mintsprout-activity-${startDate}-to-${endDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (isYoungestChild) setLocation("/dashboard");
  }, [isYoungestChild, setLocation]);

  if (isYoungestChild) return null;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🧾 Activity</h1>
        <p className="text-gray-600">A timeline of money moving in and out of accounts.</p>
      </div>

      <Card className="mint-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Transaction history</CardTitle>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0 || isLoading}>
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <Label>Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="mint-input mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {availableTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Account</Label>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="mint-input mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {availableAccounts.map((a) => (
                    <SelectItem key={a} value={a}>
                      {formatAccount(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="act-start">Start</Label>
              <Input
                id="act-start"
                className="mint-input mt-1"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="act-end">End</Label>
              <Input
                id="act-end"
                className="mint-input mt-1"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {runningBalance && (
            <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="text-sm text-gray-600">Net change (filtered) — {formatAccount(accountFilter)}</div>
              <div className="text-3xl font-black text-gray-900">${runningBalance.latest.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">
                This starts at $0 and shows change within the current filters (not the account’s true balance).
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <div className="text-4xl mb-2">🌱</div>
              <p>No transactions match these filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((t) => {
                const amt = parseFloat(t.amount || "0");
                const isOut = t.type === "spend" || t.type === "donate";
                const sign = isOut ? "-" : "+";
                const color = isOut ? "text-red-600" : "text-green-700";
                const when = new Date(t.createdAt).toLocaleString();
                const from = formatAccount(t.fromAccount);
                const to = formatAccount(t.toAccount);
                const bal = runningBalance?.map.get(t.id);

                return (
                  <div key={t.id} className="border border-gray-200 rounded-xl p-4 bg-white flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{iconForType(t.type)}</span>
                        <div className="font-semibold text-gray-900 truncate">{t.note || t.type}</div>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {from && to ? (
                          <span>{from} → {to}</span>
                        ) : null}
                        <span className="ml-2">• {when}</span>
                        {typeof bal === "number" && (
                          <span className="ml-2">• net: ${bal.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                    <div className={`font-black ${color}`}>
                      {sign}${Math.abs(amt).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

