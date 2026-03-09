'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
    isLoading: boolean;
    activePhase: 'IDLE' | 'UPLOADING' | 'PROCESSING' | 'PARSING' | 'INDEXING';
    uploadProgress: number;
    processProgress: number;
    processedLines: number;
    fetchingProgress?: number;
}

export function LoadingOverlay({
    isLoading,
    activePhase,
    uploadProgress,
    processProgress,
    processedLines,
    fetchingProgress = 0
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
                    <div className="flex justify-between text-[11px] uppercase tracking-widest font-bold">
                        <span className={activePhase === 'UPLOADING' ? "text-primary" : "text-muted-foreground"}>
                            {activePhase === 'UPLOADING' ? (">>" + " INGESTING_STREAM") : 'INGEST_COMPLETE'}
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
                    <div className="flex justify-between text-[11px] uppercase tracking-widest font-bold">
                        <span className={['PROCESSING', 'INDEXING'].includes(activePhase) ? "text-primary" : "text-muted-foreground"}>
                            {activePhase === 'INDEXING' ? (">>" + " DISCOVERING_ROWS") : 
                             activePhase === 'PROCESSING' ? (">>" + " PARSING_SCHEMA") : 'AWAITING_PROCESS'}
                        </span>
                        {['PROCESSING', 'INDEXING'].includes(activePhase) && <span>{processedLines.toLocaleString()} L</span>}
                    </div>
                    <div className="h-1 w-full bg-muted overflow-hidden rounded-full">
                        <div
                            className="h-full bg-primary transition-all duration-300 ease-out"
                            style={{ width: `${processProgress}%` }}
                        />
                    </div>
                </div>

                {fetchingProgress > 0 && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-500">
                        <div className="flex justify-between text-[11px] uppercase tracking-widest font-black text-primary">
                            <span>{">>" + " "}HYDRATING_UI</span>
                            <span>{fetchingProgress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-primary/10 overflow-hidden rounded-full border border-primary/20">
                            <div
                                className="h-full bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)] transition-all duration-300 ease-out"
                                style={{ width: `${fetchingProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="text-center pt-2">
                    <div className="text-[11px] text-muted-foreground font-mono opacity-80 italic animate-pulse">
                        {activePhase === 'UPLOADING' ? 'Parsing raw data to memory...' : 
                         activePhase === 'INDEXING' ? 'Building fast random-access map...' :
                         'Validating fixed-width alignment...'}
                    </div>
                </div>
            </div>
        </div>
    );
}
