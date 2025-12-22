"use client";

import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/usePWA";

export function InstallPrompt() {
  const { showPrompt, install, dismissPrompt, canInstall } = useInstallPrompt();

  if (!showPrompt || !canInstall) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-fade-in-up">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Download className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Install KnuckleTrainer</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Add to your home screen for the best experience and offline play!
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={install} className="flex-1">
                Install
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={dismissPrompt}
                className="px-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
