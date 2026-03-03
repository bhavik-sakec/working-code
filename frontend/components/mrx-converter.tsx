'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import { format } from 'date-fns';
import { parseFileOnBackend, convertMrxToAckOnBackend, convertMrxToRespOnBackend, convertMrxToCsvOnBackend, ApiError, checkHealth } from '../lib/api';
import { Button } from './ui/button';
import {
    Upload,
    ArrowRight,
    FileSpreadsheet,
    Zap,
    X,
    FileJson,
    Loader2,
    AlertTriangle,
    WifiOff,
    ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { ParseResult, ParsedLine, ParsedField } from '@/lib/types';
import { cn } from '../lib/utils';
import { GridView } from './visualizer/grid-view';

const ErrorBanner = ({ error, onDismiss }: { error: string, onDismiss: () => void }) => {
    const isConnectionError = error.toLowerCase().includes('connect') || error.toLowerCase().includes('engine') || error.toLowerCase().includes('server');

    return (
        <div className="relative mt-8 group animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-500 flex justify-center w-full">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-rose-500/20 via-rose-500/40 to-rose-500/20 rounded-2xl blur-xl opacity-50 block group-hover:opacity-75 transition-opacity duration-500" />
            
            <div className="relative flex w-full max-w-md bg-background/80 backdrop-blur-xl border border-rose-500/30 rounded-2xl overflow-hidden shadow-2xl">
                <div className="w-1.5 bg-rose-500 shrink-0" />
                <div className="p-5 flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                        {isConnectionError ? (
                            <WifiOff className="w-5 h-5 text-rose-500 animate-pulse" />
                        ) : (
                            <AlertTriangle className="w-5 h-5 text-rose-500" />
                        )}
                    </div>
                    <div className="flex-1 space-y-1 text-left">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">
                                {isConnectionError ? 'Service Outage Detected' : 'Forge Processing Error'}
                            </h4>
                            <button 
                                onClick={onDismiss}
                                aria-label="Dismiss error"
                                className="p-1 hover:bg-rose-500/10 rounded-md transition-colors text-zinc-500 hover:text-rose-500"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <p className="text-xs text-zinc-300 font-medium leading-relaxed pr-2">
                            {error}
                        </p>
                        {isConnectionError && (
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


export function MrxConverter({ pendingFile, onPendingFileConsumed, onOpenInDataMatrix }: {
    pendingFile?: File | null,
    onPendingFileConsumed?: () => void,
    onOpenInDataMatrix?: (text: string, fileName: string) => void
}) {
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [mrxTimestamp, setMrxTimestamp] = useState<string>('');
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [generatingType, setGeneratingType] = useState<'ACK' | 'RESP' | 'CSV' | null>(null);

    // Self-Healing Logic: Polling backend status when in error state
    useEffect(() => {
        if (!error || !error.toLowerCase().includes('connection')) return;

        const interval = setInterval(async () => {
            const isAlive = await checkHealth();
            if (isAlive) {
                setError(null);
                clearInterval(interval);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [error]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    const [result, setResult] = useState<ParseResult>({ lines: [], summary: { total: 0, valid: 0, invalid: 0, accepted: 0, rejected: 0 } });

    const processFile = useCallback(async (file: File) => {
        // Guard: prevent concurrent uploads
        if (isLoading) return;

        setIsLoading(true);
        setError(null);
        setFileName(file.name);
        setOriginalFile(file);

        const tsMatch = file.name.match(/\d{14}/);
        setMrxTimestamp(tsMatch ? tsMatch[0] : format(new Date(), 'yyyyMMddHHmmss'));

        try {
            // Send file to backend for parsing
            const backendResponse = await parseFileOnBackend(file);

            if (backendResponse.detectedSchema !== 'MRX') {
                // Not an MRX file (or invalid)
                setError('Invalid file format. Please upload an MRX (.txt) file.');
                setIsLoading(false);
                return;
            }

            // Store backend result directly, normalizing 'valid' to 'isValid'
            const parsedLines: ParsedLine[] = backendResponse.lines.map((l: ParsedLine) => ({
                ...l,
                isValid: l.isValid ?? l.valid,
                fields: l.fields?.map((f: ParsedField) => ({
                    ...f,
                    isValid: f.isValid ?? f.valid
                }))
            }));

            const parsedResult = {
                lines: parsedLines,
                summary: backendResponse.summary
            };

            // Artificial delay for "processing" feel
            setTimeout(() => {
                setContent(backendResponse.rawContent);
                setResult(parsedResult);
                setIsLoading(false);
            }, 800);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.warn('[MRX Forge] API Error:', message);
            setError(
                (err instanceof ApiError && err.isNetworkError)
                    ? err.message
                    : `Processing failed: ${message}`
            );
            setIsLoading(false);
        }
    }, [isLoading]);

    // Auto-process file passed from Data Matrix tab
    useEffect(() => {
        if (pendingFile && !isLoading) {
            processFile(pendingFile);
            onPendingFileConsumed?.();
        }
    }, [pendingFile]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (isLoading) return;
        
        const files = e.dataTransfer.files;
        if (files.length > 1) {
            toast.warning('Multi-Stream Detected', {
                description: 'The Forge supports only one MRX data stream at a time.',
                duration: 4000,
            });
            return;
        }

        const file = files[0];
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

    const handleAction = async (type: 'ACK' | 'RESP' | 'CSV') => {
        if (!content || !originalFile || generatingType) return;
        setError(null);
        setGeneratingType(type);

        try {
            if (type === 'ACK') {
                const result = await convertMrxToAckOnBackend(originalFile, mrxTimestamp);
                downloadString(result.content, result.fileName);
            } else if (type === 'RESP') {
                const result = await convertMrxToRespOnBackend(originalFile, mrxTimestamp);
                downloadString(result.content, result.fileName);
            } else {
                const result = await convertMrxToCsvOnBackend(originalFile);
                downloadString(result.content, result.fileName);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.warn('[MRX Forge] Conversion error:', message);
            setError(
                (err instanceof ApiError && err.isNetworkError)
                    ? err.message
                    : `${type} generation failed: ${message}`
            );
        } finally {
            setGeneratingType(null);
        }
    };

    const handleOpenInMatrix = async (type: 'ACK' | 'RESP') => {
        if (!content || !originalFile || generatingType) return;
        setError(null);
        setGeneratingType(type);

        try {
            const converter = type === 'ACK' ? convertMrxToAckOnBackend : convertMrxToRespOnBackend;
            const result = await converter(originalFile, mrxTimestamp);
            onOpenInDataMatrix?.(result.content, result.fileName);
            toast.success(`${type} opened in Data Matrix`, {
                description: `Converted ${fileName} → ${result.fileName}`,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(
                (err instanceof ApiError && err.isNetworkError)
                    ? err.message
                    : `${type} generation failed: ${message}`
            );
        } finally {
            setGeneratingType(null);
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
                        <div className={cn("relative group", isLoading ? "cursor-wait pointer-events-none" : "cursor-pointer")} onClick={() => !isLoading && fileInputRef.current?.click()}>
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

                        {/* Error Banner */}
                        {error && (
                            <ErrorBanner error={error} onDismiss={() => setError(null)} />
                        )}
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".txt"
                        onChange={(e) => { if (!isLoading && e.target.files?.[0]) processFile(e.target.files[0]); }}
                    />
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0">
                    <header className="h-20 border-b border-border flex items-center justify-between px-8 bg-background shrink-0">
                        <div className="flex items-center gap-6 min-w-0">
                            <button
                                onClick={() => {
                                    setContent('');
                                    setOriginalFile(null);
                                    setFileName(null);
                                    setResult({ lines: [], summary: { total: 0, valid: 0, invalid: 0, accepted: 0, rejected: 0 } });
                                }}
                                aria-label="Clear loaded file"
                                className="w-10 h-10 rounded-xl bg-muted/10 border border-border flex items-center justify-center hover:bg-rose-500/10 hover:border-rose-500/20 transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-1">Loaded Sequence</span>
                                <span className="text-sm font-black truncate whitespace-nowrap overflow-hidden text-ellipsis max-w-[400px]" title={fileName ? `${mrxTimestamp.slice(0, 8)}${fileName}` : undefined}>{mrxTimestamp.slice(0, 8)}{fileName}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <ForgeButton icon={FileJson} label="Generate ACK" onClick={() => handleAction('ACK')} isLoading={generatingType === 'ACK'} />
                            <ForgeButton icon={Zap} label="Generate RESP" color="indigo" onClick={() => handleAction('RESP')} isLoading={generatingType === 'RESP'} />
                            <div className="w-px h-10 bg-border/40 mx-1" />
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 px-3 text-[9px] font-bold uppercase tracking-wider border-primary/30 hover:bg-primary/10 hover:border-primary/50 gap-1.5"
                                onClick={() => handleOpenInMatrix('ACK')}
                                disabled={!content || !!generatingType}
                            >
                                <ExternalLink className="w-3.5 h-3.5 text-primary" />
                                ACK → Matrix
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 px-3 text-[9px] font-bold uppercase tracking-wider border-indigo-500/30 hover:bg-indigo-500/10 hover:border-indigo-500/50 gap-1.5"
                                onClick={() => handleOpenInMatrix('RESP')}
                                disabled={!content || !!generatingType}
                            >
                                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                                RESP → Matrix
                            </Button>
                            <div className="w-px h-10 bg-border/40 mx-1" />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 px-4 text-xs font-bold border border-border/40 hover:bg-muted/30"
                                onClick={() => handleAction('CSV')}
                                disabled={!!generatingType}
                            >
                                {generatingType === 'CSV' ? (
                                    <Loader2 className="w-4 h-4 mr-2 text-emerald-500 animate-spin" />
                                ) : (
                                    <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" />
                                )}
                                EXPORT CSV
                            </Button>
                        </div>
                    </header>

                    {error && (
                        <div className="mx-8 mt-4 flex justify-center">
                            <ErrorBanner error={error} onDismiss={() => setError(null)} />
                        </div>
                    )}

                    <div className="flex-1 min-h-0">
                        <div className="h-full w-full">
                            <GridView
                                result={result}
                                schema="MRX"
                                virtuosoRef={virtuosoRef}
                                editingField={null}
                                setEditingField={() => { }}
                                handleFieldUpdate={() => { }}
                            />
                        </div>
                    </div>

                    <footer className="h-10 border-t border-border px-8 flex items-center justify-between bg-background/50">
                        <div className="flex items-center gap-4 text-[9px] uppercase tracking-widest text-muted-foreground">
                            <span>Total Records: {result.lines.filter(l => l.type === 'Data').length}</span>
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

function ForgeButton({ icon: Icon, label, color = "primary", onClick, isLoading }: { icon: React.ElementType, label: string, color?: "primary" | "indigo", onClick: () => void, isLoading?: boolean }) {
    const colors = {
        primary: "bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary shadow-primary/10",
        indigo: "bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 shadow-indigo-500/10"
    };

    return (
        <button
            onClick={onClick}
            disabled={isLoading}
            aria-label={label}
            className={cn(
                "h-10 px-6 rounded-xl border flex items-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95",
                colors[color],
                isLoading && "opacity-70 pointer-events-none cursor-wait"
            )}
        >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
            {label}
            {!isLoading && <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-50" />}
        </button>
    );
}
