'use client';

import React, { useState, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { parseMrxFile } from '../lib/mrx-parser';
import { convertMrxToAck, convertMrxToResp, convertMrxToCsv } from '../lib/converters';
import { Button } from './ui/button';
import {
    Upload,
    FileText,
    ArrowRight,
    Activity,
    ShieldCheck,
    FileSpreadsheet,
    Zap,
    Download,
    X,
    FileJson,
    Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { GridView } from './visualizer/grid-view';

export function MrxConverter() {
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [mrxTimestamp, setMrxTimestamp] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const result = useMemo(() => {
        if (!content) return { lines: [], summary: { total: 0, valid: 0, invalid: 0, accepted: 0, rejected: 0 } };
        return parseMrxFile(content);
    }, [content]);

    const processFile = (file: File) => {
        setIsLoading(true);
        setFileName(file.name);

        const tsMatch = file.name.match(/\d{14}/);
        setMrxTimestamp(tsMatch ? tsMatch[0] : format(new Date(), 'yyyyMMddHHmmss'));

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const firstLine = text.split('\n')[0] || '';

            if (firstLine.length < 900) {
                setIsLoading(false);
                return;
            }

            // Artificial delay for "processing" feel
            setTimeout(() => {
                setContent(text);
                setIsLoading(false);
            }, 800);
        };
        reader.readAsText(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };

    const downloadString = (str: string, name: string) => {
        const blob = new Blob([str], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleAction = (type: 'ACK' | 'RESP' | 'CSV') => {
        if (!content) return;
        if (type === 'ACK') {
            downloadString(convertMrxToAck(result, mrxTimestamp), `TEST.MCMSMN_CLAIMS_ACK_${mrxTimestamp}.txt`);
        } else if (type === 'RESP') {
            downloadString(convertMrxToResp(result, mrxTimestamp), `TEST.PRIME_BCBSMN_GEN_CLAIMS_RESP_${mrxTimestamp}.txt`);
        } else {
            downloadString(convertMrxToCsv(result), fileName?.replace('.txt', '.csv') || `MRX_EXPORT_${format(new Date(), 'yyyyMMddHHmmss')}.csv`);
        }
    };

    return (
        <div className="h-full bg-background text-foreground font-mono text-sm overflow-hidden flex flex-col">
            {!content ? (
                <div
                    className={cn(
                        "flex-1 flex flex-col items-center justify-center p-20 transition-all duration-500",
                        isDragging ? "bg-primary/5 scale-[0.98]" : "bg-transparent"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    <div className="max-w-xl w-full flex flex-col items-center gap-10 text-center">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 group-hover:bg-primary/30 transition-all" />
                            <div className="relative w-32 h-32 bg-muted/50 border-2 border-dashed border-border rounded-3xl flex items-center justify-center group-hover:border-primary group-hover:translate-y-[-4px] transition-all">
                                {isLoading ? (
                                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                ) : (
                                    <Upload className="w-12 h-12 text-zinc-500 group-hover:text-primary transition-colors" />
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-3xl font-black tracking-tighter uppercase italic">MRX Forge Module</h2>
                            <p className="text-muted-foreground font-medium leading-relaxed max-w-sm mx-auto">
                                Feed raw MRX data streams into the forge to synthesize calibrated ACK and RESP protocols.
                            </p>
                        </div>


                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".txt"
                        onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                    />
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0">
                    <header className="h-20 border-b border-border flex items-center justify-between px-8 bg-background shrink-0">
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => setContent('')}
                                className="w-10 h-10 rounded-xl bg-muted/10 border border-border flex items-center justify-center hover:bg-rose-500/10 hover:border-rose-500/20 transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-1">Loaded Sequence</span>
                                <span className="text-sm font-black">{fileName}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <ForgeButton icon={FileJson} label="Generate ACK" onClick={() => handleAction('ACK')} />
                            <ForgeButton icon={Zap} label="Generate RESP" color="indigo" onClick={() => handleAction('RESP')} />
                            <div className="w-px h-10 bg-border/40 mx-2" />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 px-4 text-xs font-bold border border-border/40 hover:bg-muted/30"
                                onClick={() => handleAction('CSV')}
                            >
                                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" /> EXPORT CSV
                            </Button>
                        </div>
                    </header>

                    <div className="flex-1 min-h-0 bg-muted/20">
                        <div className="h-full w-full opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
                            <GridView
                                result={result}
                                schema="MRX"
                                virtuosoRef={{ current: null } as any}
                                editingField={null}
                                setEditingField={() => { }}
                                handleFieldUpdate={() => { }}
                                isFieldEditable={() => false}
                                isDropdownField={() => false}
                            />
                        </div>
                    </div>

                    <footer className="h-10 border-t border-border px-8 flex items-center justify-between bg-background/50">
                        <div className="flex items-center gap-4 text-[9px] uppercase tracking-widest text-muted-foreground">
                            <span>Total Rows: {result.summary.total}</span>
                            <span className="w-1 h-1 bg-border rounded-full" />
                            <span>Signature: {mrxTimestamp}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[9px] uppercase font-bold text-emerald-500/50 italic tracking-tighter">Forge Ready</span>
                        </div>
                    </footer>
                </div >
            )
            }
        </div >
    );
}

function ForgeButton({ icon: Icon, label, color = "primary", onClick }: { icon: any, label: string, color?: "primary" | "indigo", onClick: () => void }) {
    const colors = {
        primary: "bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary shadow-primary/10",
        indigo: "bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 shadow-indigo-500/10"
    };

    return (
        <button
            onClick={onClick}
            className={cn(
                "h-10 px-6 rounded-xl border flex items-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95",
                colors[color]
            )}
        >
            <Icon className="w-4 h-4" />
            {label}
            <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-50" />
        </button>
    );
}
