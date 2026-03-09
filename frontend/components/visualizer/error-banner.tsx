'use client';

import { AlertTriangle, WifiOff, X } from 'lucide-react';


interface ErrorBannerProps {
    error: string;
    onDismiss: () => void;
}

export const ErrorBanner = ({ error, onDismiss }: ErrorBannerProps) => {
    const isConnectionError = error.toLowerCase().includes('connect') || 
                              error.toLowerCase().includes('engine') || 
                              error.toLowerCase().includes('server');

    const is404Or405 = error.includes('404') || error.includes('405') || error.toLowerCase().includes('not found');

    return (
        <div className="relative mt-8 group animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-500">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-linear-to-r from-rose-500/20 via-rose-500/40 to-rose-500/20 rounded-2xl blur-xl opacity-50 block group-hover:opacity-75 transition-opacity duration-500" />

            <div className="relative flex max-w-lg bg-background/80 backdrop-blur-xl border border-rose-500/30 rounded-2xl overflow-hidden shadow-2xl">
                <div className="w-1.5 bg-rose-500 shrink-0" />
                <div className="p-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                        {isConnectionError ? (
                            <WifiOff className="w-5 h-5 text-rose-500 animate-pulse" />
                        ) : (
                            <AlertTriangle className="w-5 h-5 text-rose-500" />
                        )}
                    </div>
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">
                                {is404Or405 ? 'Endpoint Anomaly' : (isConnectionError ? 'System Service Offline' : 'Processing Interrupted')}
                            </h4>
                            <button
                                onClick={onDismiss}
                                className="p-1 hover:bg-rose-500/10 rounded-md transition-colors text-zinc-500 hover:text-rose-500"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <p className="text-xs text-zinc-300 font-medium leading-relaxed pr-2">
                            {error}
                        </p>
                        {isConnectionError && !is404Or405 && (
                            <div className="pt-2 flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                                <span className="text-[9px] text-rose-500/80 font-bold uppercase tracking-widest leading-none">Establishing safe reconnection...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
