"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Check, Code2, Copy, Download, Link as LinkIcon, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildEmbedSnippet,
  buildPublicQuizLink,
  toFileSlug,
  type ShareableQuiz,
} from "@/lib/shareLinks";

type CopiedField = "link" | "embed" | null;

interface ShareQuizDialogProps {
  quiz: ShareableQuiz | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown above the tabs, e.g. right after publishing. */
  headline?: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ShareQuizDialog({
  quiz,
  open,
  onOpenChange,
  headline,
}: ShareQuizDialogProps) {
  const [origin, setOrigin] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopiedField>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const link = useMemo(
    () => (quiz && origin ? buildPublicQuizLink(quiz, origin) : ""),
    [quiz, origin],
  );
  const embed = useMemo(
    () => (quiz && origin ? buildEmbedSnippet(quiz, origin) : ""),
    [quiz, origin],
  );

  useEffect(() => {
    if (!open || !link) return;
    let cancelled = false;
    setQrDataUrl(null);
    QRCode.toDataURL(link, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((error: unknown) => {
        console.error("Failed to generate QR code", error);
      });
    return () => {
      cancelled = true;
    };
  }, [open, link]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async (field: Exclude<CopiedField, null>) => {
    const ok = await copyText(field === "link" ? link : embed);
    if (ok) {
      setCopied(field);
      toast.success(field === "link" ? "Link copied" : "Embed code copied");
    } else {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl || !quiz) return;
    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = `${toFileSlug(quiz.title)}-qr.png`;
    anchor.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-600" />
            {headline ?? "Share your quiz"}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {quiz?.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <LinkIcon className="h-4 w-4" /> Link
            </h3>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                aria-label="Quiz link"
                onFocus={(event) => event.currentTarget.select()}
                className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleCopy("link")}
                disabled={!link}
              >
                {copied === "link" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="ml-1.5">Copy</span>
              </Button>
            </div>
          </section>

          <section className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
            <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg bg-white">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={`QR code linking to ${quiz?.title ?? "the quiz"}`}
                  className="h-40 w-40"
                />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              )}
            </div>
            <div className="space-y-2 text-center sm:text-left">
              <h3 className="text-sm font-semibold text-slate-900">QR code</h3>
              <p className="text-sm text-slate-500">
                Put it on posters, slides or flyers. Scanning it opens the quiz
                straight away.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleDownloadQr}
                disabled={!qrDataUrl}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                <Download className="mr-1.5 h-4 w-4" />
                Download PNG
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Code2 className="h-4 w-4" /> Embed on a website
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleCopy("embed")}
                disabled={!embed}
              >
                {copied === "embed" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="ml-1.5">Copy code</span>
              </Button>
            </div>
            <textarea
              readOnly
              value={embed}
              rows={7}
              aria-label="Embed code"
              onFocus={(event) => event.currentTarget.select()}
              className="w-full resize-none whitespace-pre-wrap break-all rounded-md border border-slate-200 bg-slate-950 p-3 font-mono text-xs leading-5 text-emerald-200"
            />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShareQuizDialog;
