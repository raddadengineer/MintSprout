import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type DeploymentSettings = {
  aiCoachEnabled?: boolean;
  openWebUiBaseUrl?: string;
  openWebUiApiKey?: string;
  openWebUiModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  kidsVoiceBaseUrl?: string;
  kidsVoiceModel?: string;
  aiVoiceYoungest?: string;
  aiVoiceYounger?: string;
  aiVoiceOlder?: string;
  kioskMode?: boolean;
  parentPin?: string;
  kioskFamilyId?: number;
  jwtSecret?: string;
};

type SettingsResponse = {
  settings: DeploymentSettings;
  llmAvailable: boolean;
  voiceAvailable: boolean;
  jwtRotated?: boolean;
};

export function AppSettingsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DeploymentSettings>({});
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [jwtSecretInput, setJwtSecretInput] = useState("");

  const { data, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["/api/admin/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/settings");
      return await res.json();
    },
  });

  useEffect(() => {
    if (data?.settings) {
      setForm(data.settings);
      setApiKeyInput("");
      setPinInput("");
      setJwtSecretInput("");
    }
  }, [data?.settings]);

  const saveMutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", "/api/admin/settings", patch);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as SettingsResponse;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/config"] });
      setApiKeyInput("");
      setPinInput("");
      setJwtSecretInput("");
      if (result.jwtRotated) {
        toast({
          title: "JWT secret updated",
          description: "All sessions were invalidated. Sign in again with the new secret in effect.",
        });
        localStorage.removeItem("auth_token");
        window.location.href = "/";
        return;
      }
      toast({ title: "Settings saved", description: "Changes apply immediately — no restart needed." });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const testLlmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/settings/test-llm");
      return await res.json();
    },
    onSuccess: (result: { ok: boolean; message: string }) => {
      toast({
        title: result.ok ? "LLM connected" : "LLM unavailable",
        description: result.message,
        variant: result.ok ? "default" : "destructive",
      });
    },
  });

  const testVoiceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/settings/test-voice");
      return await res.json();
    },
    onSuccess: (result: { ok: boolean; message: string; audioBase64?: string; mimeType?: string }) => {
      if (result.ok && result.audioBase64 && result.mimeType) {
        const blob = Uint8Array.from(atob(result.audioBase64), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([blob], { type: result.mimeType }));
        const audio = new Audio(url);
        void audio.play();
      }
      toast({
        title: result.ok ? "Voice OK" : "Voice unavailable",
        description: result.message,
        variant: result.ok ? "default" : "destructive",
      });
    },
  });

  const set = <K extends keyof DeploymentSettings>(key: K, value: DeploymentSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const patch: Record<string, unknown> = { ...form };
    if (apiKeyInput.trim()) patch.openWebUiApiKey = apiKeyInput.trim();
    if (pinInput.trim()) patch.parentPin = pinInput.trim();
    if (jwtSecretInput.trim()) {
      if (jwtSecretInput.trim().length < 16) {
        toast({
          title: "JWT secret too short",
          description: "Use at least 16 characters.",
          variant: "destructive",
        });
        return;
      }
      patch.jwtSecret = jwtSecretInput.trim();
    }
    saveMutation.mutate(patch);
  };

  const generateJwtSecret = () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const secret = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join("")).replace(/[+/=]/g, "").slice(0, 48);
    setJwtSecretInput(secret);
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading settings…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={`px-2 py-1 rounded ${data?.llmAvailable ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          LLM: {data?.llmAvailable ? "Connected" : "Not reachable"}
        </span>
        <span className={`px-2 py-1 rounded ${data?.voiceAvailable ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          Voice: {data?.voiceAvailable ? "Connected" : "Not reachable"}
        </span>
        <Button type="button" variant="outline" size="sm" disabled={testLlmMutation.isPending} onClick={() => testLlmMutation.mutate()}>
          Test LLM
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={testVoiceMutation.isPending} onClick={() => testVoiceMutation.mutate()}>
          Test Voice
        </Button>
      </div>

      <Card className="mint-card">
        <CardHeader>
          <CardTitle>Sprout AI coach</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="font-bold">Enable Sprout for kids</Label>
            <Switch checked={form.aiCoachEnabled !== false} onCheckedChange={(v) => set("aiCoachEnabled", v)} />
          </div>
        </CardContent>
      </Card>

      <Card className="mint-card">
        <CardHeader>
          <CardTitle>LLM — Open WebUI (primary)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Base URL</Label>
            <Input className="mint-input mt-1" value={form.openWebUiBaseUrl ?? ""} onChange={(e) => set("openWebUiBaseUrl", e.target.value)} placeholder="https://ai.example.com" />
          </div>
          <div>
            <Label>API key {form.openWebUiApiKey && <span className="text-xs text-gray-500 font-normal">(saved: {form.openWebUiApiKey})</span>}</Label>
            <Input className="mint-input mt-1" type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="Leave blank to keep current key" autoComplete="off" />
          </div>
          <div>
            <Label>Model</Label>
            <Input className="mint-input mt-1" value={form.openWebUiModel ?? ""} onChange={(e) => set("openWebUiModel", e.target.value)} placeholder="gemma3:kids" />
          </div>
        </CardContent>
      </Card>

      <Card className="mint-card">
        <CardHeader>
          <CardTitle>LLM — Ollama (fallback)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Base URL</Label>
            <Input className="mint-input mt-1" value={form.ollamaBaseUrl ?? ""} onChange={(e) => set("ollamaBaseUrl", e.target.value)} placeholder="http://host:11434" />
          </div>
          <div>
            <Label>Model</Label>
            <Input className="mint-input mt-1" value={form.ollamaModel ?? ""} onChange={(e) => set("ollamaModel", e.target.value)} placeholder="llama3.1:latest" />
          </div>
          <p className="text-xs text-gray-500">Used when Open WebUI URL or API key is not set.</p>
        </CardContent>
      </Card>

      <Card className="mint-card">
        <CardHeader>
          <CardTitle>Voice (Kokoro TTS)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Voice API base URL</Label>
            <Input className="mint-input mt-1" value={form.kidsVoiceBaseUrl ?? ""} onChange={(e) => set("kidsVoiceBaseUrl", e.target.value)} placeholder="http://host:8880/v1" />
          </div>
          <div>
            <Label>Voice model</Label>
            <Input className="mint-input mt-1" value={form.kidsVoiceModel ?? ""} onChange={(e) => set("kidsVoiceModel", e.target.value)} placeholder="kokoro" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Youngest voice ID</Label>
              <Input className="mint-input mt-1" value={form.aiVoiceYoungest ?? ""} onChange={(e) => set("aiVoiceYoungest", e.target.value)} />
            </div>
            <div>
              <Label>Younger voice ID</Label>
              <Input className="mint-input mt-1" value={form.aiVoiceYounger ?? ""} onChange={(e) => set("aiVoiceYounger", e.target.value)} />
            </div>
            <div>
              <Label>Older voice ID</Label>
              <Input className="mint-input mt-1" value={form.aiVoiceOlder ?? ""} onChange={(e) => set("aiVoiceOlder", e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mint-card">
        <CardHeader>
          <CardTitle>Login and profiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-bold">Profile picker (kiosk mode)</Label>
              <p className="text-xs text-gray-500">Children tap their name instead of using passwords.</p>
            </div>
            <Switch checked={form.kioskMode !== false} onCheckedChange={(v) => set("kioskMode", v)} />
          </div>
          <div>
            <Label>Parent PIN {form.parentPin && <span className="text-xs text-gray-500 font-normal">(PIN is set)</span>}</Label>
            <Input className="mint-input mt-1" type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="Leave blank to keep current PIN" autoComplete="off" />
          </div>
          <div>
            <Label>Kiosk family ID</Label>
            <Input
              className="mint-input mt-1"
              type="number"
              min={1}
              value={form.kioskFamilyId ?? 1}
              onChange={(e) => set("kioskFamilyId", parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <div>
              <Label className="font-bold">JWT secret</Label>
              <p className="text-xs text-gray-500">Signs login tokens. Changing this logs everyone out.</p>
            </div>
            <div>
              <Label>
                New secret{" "}
                {form.jwtSecret && <span className="text-xs text-gray-500 font-normal">(configured: {form.jwtSecret})</span>}
              </Label>
              <Input
                className="mint-input mt-1"
                type="password"
                value={jwtSecretInput}
                onChange={(e) => setJwtSecretInput(e.target.value)}
                placeholder="Leave blank to keep current secret"
                autoComplete="new-password"
              />
              <p className="text-xs text-amber-700 mt-1">Minimum 16 characters.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={generateJwtSecret}>
              Generate random secret
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-500">
        Settings here override <code className="text-xs">.env</code> / Docker defaults at runtime. Database URL stays in environment config only.
      </p>

      <Button className="mint-primary" disabled={saveMutation.isPending} onClick={handleSave}>
        Save settings
      </Button>
    </div>
  );
}
