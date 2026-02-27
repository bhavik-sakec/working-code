'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
    isLoading: boolean;
    activePhase: 'IDLE' | 'UPLOADING' | 'PROCESSING';
    uploadProgress: number;
    processProgress: number;
    processedLines: number;
}

export function LoadingOverlay({
    isLoading,
    activePhase,
    uploadProgress,
    processProgress,
    processedLines
}: LoadingOverlayProps) {
    if (!isLoading) return null;

    return (
        <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-6 animate-in fade-in duration-300">
            <div className="relative">
                <Loader2 className="w-16 h-16 text-primary animate-spin-slow opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold font-mono text-primary">
                        {activePhase === 'UPLOADING' ? uploadProgress : processProgress}%
                    </span>
                </div>
                <div className="absolute inset-0 blur-2xl bg-primary/10 rounded-full animate-pulse" />
            </div>

            <div className="w-64 space-y-4">
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold">
                        <span className={activePhase === 'UPLOADING' ? "text-primary" : "text-muted-foreground"}>
                            {activePhase === 'UPLOADING' ? '>> INGESTING_STREAM' : 'INGEST_COMPLETE'}
                        </span>
                        {activePhase === 'UPLOADING' && <span>{uploadProgress}%</span>}
                    </div>
                    <div className="h-1 w-full bg-muted overflow-hidden rounded-full">
                        <div
                            className="h-full bg-primary transition-all duration-300 ease-out"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold">
                        <span className={activePhase === 'PROCESSING' ? "text-primary" : "text-muted-foreground"}>
                            {activePhase === 'PROCESSING' ? '>> PARSING_SCHEMA' : 'AWAITING_PROCESS'}
                        </span>
                        {activePhase === 'PROCESSING' && <span>{processedLines.toLocaleString()} L</span>}
                    </div>
                    <div className="h-1 w-full bg-muted overflow-hidden rounded-full">
                        <div
                            className="h-full bg-primary transition-all duration-300 ease-out"
                            style={{ width: `${processProgress}%` }}
                        />
                    </div>
                </div>

                <div className="text-center pt-2">
                    <div className="text-[10px] text-muted-foreground font-mono opacity-70 italic animate-pulse">
                        {activePhase === 'UPLOADING' ? 'Streaming raw pulses to memory...' : 'Validating fixed-width alignment...'}
                    </div>
                </div>
            </div>
        </div>
    );
}
