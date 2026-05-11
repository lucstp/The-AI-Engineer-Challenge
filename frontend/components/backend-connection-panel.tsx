import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BackendConnectionPanelProps {
  backendBaseUrl: string;
  verificationMessage: string;
}

export function BackendConnectionPanel({
  backendBaseUrl,
  verificationMessage
}: BackendConnectionPanelProps) {
  return (
    <Card aria-label="Backend connection status">
      <CardHeader>
        <CardTitle>Backend connection</CardTitle>
        <p className="text-sm font-semibold text-emerald-200">{verificationMessage}</p>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <CardDescription>
          Server-configured backend mode is active for chat processing. This frontend only uses your
          key for verification and does not persist it. Responses are scoped to Coldplay-focused
          chat.
        </CardDescription>
        <p className="font-mono text-xs text-slate-300/90 break-all">
          Endpoint: {backendBaseUrl}/api/chat
        </p>
      </CardContent>
    </Card>
  );
}
