'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ACK_DENIAL_CODES, RESP_DENIAL_CODES, SCHEMAS, RESP_STATUS, ACK_STATUS } from '@/lib/constants';

interface SimulationHUDProps {
    open: boolean;
    mode: 'DY' | 'PA' | 'R';
    schema: 'ACK' | 'RESP' | 'MRX' | 'INVALID';
    bulkInputMode: 'PCT' | 'CNT';
    bulkPct: string;
    bulkCount: string;
    randomizeDenyCodes: boolean;
    bulkDenialCode: string;
    setBulkPanel: React.Dispatch<React.SetStateAction<{ open: boolean; mode: 'DY' | 'PA' | 'R' }>>;
    setBulkInputMode: (mode: 'PCT' | 'CNT') => void;
    setBulkPct: (pct: string) => void;
    setBulkCount: (count: string) => void;
    setRandomizeDenyCodes: (val: boolean) => void;
    setBulkDenialCode: (code: string) => void;
    applyBulkAction: () => void;
    isBatchExecuting?: boolean;
}

export function SimulationHUD({
    open,
    mode,
    schema,
    bulkInputMode,
    bulkPct,
    bulkCount,
    randomizeDenyCodes,
    bulkDenialCode,
    setBulkPanel,
    setBulkInputMode,
    setBulkPct,
    setBulkCount,
    setRandomizeDenyCodes,
    setBulkDenialCode,
    applyBulkAction,
    isBatchExecuting = false
}: SimulationHUDProps) {
    if (!open) return null;

    return (
        <div className="bg-background border-b border-border p-4 animate-in slide-in-from-top-4 duration-300 relative overflow-hidden">
            {/* Header Background Pattern */}
            <div className="absolute inset-0 opacity-[0.01] bg-[radial-gradient(#80808044_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
            
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6 relative z-10">
                <div className="flex-1 space-y-3 w-full">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "w-7 h-7 flex items-center justify-center rounded-none border shadow-sm",
                            mode === RESP_STATUS.DENIED ? "bg-rose-500/10 border-rose-500/50 text-rose-500" :
                            mode === ACK_STATUS.REJECTED ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" :
                            "bg-amber-500/10 border-amber-500/50 text-amber-500"
                        )}>
                            <Zap className="w-3.5 h-3.5 animate-pulse" />
                        </div>
                        <div className="flex bg-muted/30 p-0.5 border border-border/50 rounded-none h-7">
                            {schema === SCHEMAS.MRX ? (
                                <div className="px-3 py-0.5 text-[8px] font-black uppercase tracking-widest text-muted-foreground self-center opacity-50">Prepay Sim Disabled</div>
                            ) : schema === SCHEMAS.RESP ? (
                                <>
                                    <button
                                        onClick={() => setBulkPanel(p => ({ ...p, mode: RESP_STATUS.DENIED as 'DY' }))}
                                        className={cn(
                                            "px-3 py-0.5 text-[8px] font-black uppercase tracking-widest transition-all",
                                            mode === RESP_STATUS.DENIED ? 'bg-background text-rose-500 border border-rose-500/30' : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        Deny
                                    </button>
                                    <button
                                        onClick={() => setBulkPanel(p => ({ ...p, mode: RESP_STATUS.PARTIAL as 'PA' }))}
                                        className={cn(
                                            "px-3 py-0.5 text-[8px] font-black uppercase tracking-widest transition-all",
                                            mode === RESP_STATUS.PARTIAL ? 'bg-background text-amber-500 border border-amber-500/30' : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        Partial
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setBulkPanel(p => ({ ...p, mode: ACK_STATUS.REJECTED as 'R' }))}
                                    className={cn(
                                        "px-3 py-0.5 text-[8px] font-black uppercase tracking-widest transition-all",
                                        mode === ACK_STATUS.REJECTED ? 'bg-background text-emerald-500 border border-emerald-500/30' : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    Reject
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Logic</label>
                                <div className="flex bg-muted/50 p-0.5 border border-border/50 rounded-md">
                                    <button
                                        onClick={() => setBulkInputMode('PCT')}
                                        className={cn(
                                            "px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all rounded-[4px]",
                                            bulkInputMode === 'PCT' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        )}
                                    >
                                        % Percent
                                    </button>
                                    <button
                                        onClick={() => setBulkInputMode('CNT')}
                                        className={cn(
                                            "px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all rounded-[4px]",
                                            bulkInputMode === 'CNT' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        )}
                                    >
                                        # Count
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Select 
                                    value={randomizeDenyCodes ? 'RANDOM' : bulkDenialCode} 
                                    onValueChange={setBulkDenialCode}
                                    disabled={randomizeDenyCodes}
                                >
                                    <SelectTrigger className="h-8 bg-muted/20 border-border/50 rounded-none font-bold text-[10px] w-full disabled:opacity-50">
                                        <SelectValue placeholder={randomizeDenyCodes ? "Random" : "Reason"} />
                                    </SelectTrigger>
                                    <SelectContent align="start" className="max-h-[300px] border-border rounded-none shadow-2xl">
                                        {(schema === SCHEMAS.RESP ? RESP_DENIAL_CODES : ACK_DENIAL_CODES).map(c => (
                                            <SelectItem key={c.code} value={c.code} className="text-[10px] rounded-none focus:bg-primary/5 focus:text-primary">
                                                <span className="font-black text-primary mr-2">{c.code}</span>
                                                <span className="opacity-70">{c.short}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <label className="flex items-center gap-2 cursor-pointer group select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={randomizeDenyCodes} 
                                        onChange={e => setRandomizeDenyCodes(e.target.checked)}
                                        className="w-2.5 h-2.5 rounded-none border-border bg-transparent text-primary focus:ring-0"
                                    />
                                    <span className="text-[8px] text-muted-foreground font-black uppercase tracking-widest group-hover:text-primary transition-colors">Randomize</span>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-2 col-span-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Velocity</label>
                                <span className="text-[10px] font-black text-primary bg-primary/10 px-1.5 py-0.5 border border-primary/20 tabular-nums">
                                    {bulkInputMode === 'PCT' ? `${bulkPct}%` : `${bulkCount} OBJECTS`}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                {bulkInputMode === 'PCT' ? (
                                    <div className="flex items-center gap-3 h-8 w-full">
                                        <span className="text-[8px] text-muted-foreground font-black opacity-40">01</span>
                                        <input
                                            type="range"
                                            min="1"
                                            max="100"
                                            step="1"
                                            value={bulkPct}
                                            onChange={(e) => setBulkPct(e.target.value)}
                                            className="flex-1 accent-primary h-0.5 bg-muted rounded-none appearance-none cursor-pointer"
                                        />
                                        <span className="text-[8px] text-muted-foreground font-black opacity-40">100</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center h-8 w-full relative group">
                                        <input
                                            type="number"
                                            value={bulkCount}
                                            onChange={(e) => setBulkCount(e.target.value)}
                                            className="w-full h-full bg-muted/20 border border-border/50 rounded-none px-3 font-black transition-all text-xs focus:bg-background focus:border-primary outline-none tabular-nums"
                                            min="1"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto shrink-0 self-center">
                    <Button
                        variant="outline"
                        onClick={() => setBulkPanel(p => ({ ...p, open: false }))}
                        className="h-8 px-4 text-[9px] font-black uppercase tracking-widest rounded-none border-border/50 hover:bg-muted/50 transition-all"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={applyBulkAction}
                        disabled={isBatchExecuting}
                        className={`h-8 px-6 text-[9px] font-black uppercase tracking-widest rounded-none shadow-lg transition-all group ${
                            isBatchExecuting ? 'opacity-70 cursor-not-allowed' :
                            mode === RESP_STATUS.DENIED
                                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20'
                                : mode === ACK_STATUS.REJECTED
                                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
                                : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20'
                        }`}
                    >
                        {isBatchExecuting ? 'Executing...' : 'Execute Batch'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
