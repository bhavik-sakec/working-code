'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import { format } from 'date-fns';
import { useStore } from '../lib/store';

import {
    Upload,
    ArrowRight,
    FileSpreadsheet,
    Zap,
    X,
    FileJson,
    Loader2,
    AlertTriangle,
    ExternalLink,

} from 'lucide-react';



import { toast } from 'sonner';
import { cn, normalizeSummary } from '@/lib/utils';

const emptySummary = { total: 0, totalClaims: 0, valid: 0, invalid: 0, accepted: 0, rejected: 0, partial: 0 };


import { GridView } from './visualizer/grid-view';
import { streamParseFile, initSession, fetchSessionRows, fetchSessionStatus, convertMrxToAckOnBackend, convertMrxToRespOnBackend, convertMrxToCsvOnBackend, ApiError } from '@/lib/api';
import { SCHEMAS, LINE_TYPES } from '@/lib/constants';
import { ParseResult } from '@/lib/types';



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
    const [generatingType, setGeneratingType] = useState<'ACK' | 'RESP' | 'CSV' | null>(null);
    const [processProgress, setProcessProgress] = useState(0);
    const [processedLinesCount, setProcessedLinesCount] = useState(0);
    const [showAllErrors, setShowAllErrors] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const [result, setResult] = useState<ParseResult>({ lines: [], summary: { total: 0, totalClaims: 0, valid: 0, invalid: 0, accepted: 0, rejected: 0, partial: 0 } });

    const activeFileId = useStore(s => s.activeFileId);
    const storeLines = useStore(s => s.lines);
    const storeSummary = useStore(s => s.summary);
    const storeSchema = useStore(s => s.schema);

    useEffect(() => {
        // Only sync from global store when the active file is an MRX file.
        // Otherwise, RESP/ACK files opened in Data Matrix would leak into the Forge view.
        if (activeFileId && storeSchema === 'MRX') {
            setResult({
                lines: storeLines,
                summary: storeSummary,
                detectedSchema: storeSchema as 'ACK' | 'RESP' | 'MRX' | 'INVALID'
            });
            // Also update content mode if needed
            if (storeLines.length > 0 || useStore.getState().isSessionMode) {
               setContent(useStore.getState().isSessionMode ? 'SESSION' : 'STREAMED');
            }
            // Reset scroll position
            virtuosoRef.current?.scrollToIndex(0);
        }
    }, [activeFileId, storeLines, storeSummary, storeSchema, setResult, setContent, virtuosoRef]);

    const headerLines = useMemo(() => result.lines.filter(l => l.type === LINE_TYPES.HEADER), [result.lines]);
    const trailerLines = useMemo(() => result.lines.filter(l => l.type === LINE_TYPES.TRAILER), [result.lines]);
    const dataLineCount = useMemo(() => result.lines.filter(l => l.type === LINE_TYPES.DATA).length, [result.lines]);

    // Hard block: detect any line whose raw length != 921 (MRX structural integrity)
    // ONLY apply this if we are actually looking at an MRX file
    const structuralErrors = useMemo(() => {
        if (result.detectedSchema !== SCHEMAS.MRX) return [];
        if (!result.lines.length) return [];
        return result.lines.filter(l => l.rawLength !== undefined && l.rawLength !== 921);
    }, [result.lines, result.detectedSchema]);
    const hasStructuralErrors = structuralErrors.length > 0;

    const processFile = useCallback(async (file: File) => {
        if (isLoading) return;

        setIsLoading(true);
        
        // Check slot limits: 2 for Data Matrix, 1 for MRX Forge
        const store = useStore.getState();
        const { activeFiles } = store;
        const exists = activeFiles.find(f => f.name === file.name);
        
        if (!exists) {
            const forgeCount = activeFiles.filter(f => f.schema === 'MRX').length;

            if (forgeCount >= 1) {
                toast.error('MAX PREPAY SLOTS REACHED', { description: 'The Forge supports 1 active Prepay stream at a time. Please close the existing file first.', duration: 5000 });
                setIsLoading(false);
                return;
            }
            if (activeFiles.length >= 3) {
                 toast.error('MAX WORKSPACE LIMIT REACHED', { description: 'Global capacity is 3 files (2 Matrix + 1 Forge).', duration: 5000 });
                 setIsLoading(false);
                 return;
            }
        }

        setFileName(file.name);
        store.setFileName(file.name, 'MRX'); // Register as Forge file with explicit MRX schema
        
        setOriginalFile(file);
        setProcessProgress(0);
        setProcessedLinesCount(0);
        setShowAllErrors(false);
        setResult({ lines: [], summary: { ...emptySummary } });

        const tsMatch = file.name.match(/\d{10,}/);
        setMrxTimestamp(tsMatch ? tsMatch[0] : format(new Date(), 'yyyyMMddHHmmss'));

        // Abort any existing process
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            // DECISION: Only use Session Paging for files larger than ~100K lines (20MB)
            if (file.size < 20 * 1024 * 1024) {
                await streamParseFile(file, ({ lines: chunkLines, result: chunkResult, progress, processedLines: count }) => {
                    if (chunkResult?.detectedSchema && chunkResult.detectedSchema !== SCHEMAS.MRX) {
                        throw new Error('Invalid file format. Please upload a Prepay (.txt) file.');
                    }
                    if (chunkLines) {
                        setResult(prev => ({
                            ...prev,
                            lines: [...prev.lines, ...chunkLines]
                        }));
                        setContent('STREAMED');
                    }
                    if (chunkResult?.summary) {
                        setResult(prev => ({
                            ...prev,
                            summary: { ...prev.summary, ...chunkResult.summary }
                        }));
                    }
                    if (progress !== undefined) setProcessProgress(progress);
                    if (count !== undefined) setProcessedLinesCount(count);
                }, abortControllerRef.current.signal);
            } else {
                setProcessProgress(10); // Start progress for indexing
                const session = await initSession(file);
                
                if (session.detectedSchema !== SCHEMAS.MRX) {
                    throw new Error('Invalid file format. Please upload a Prepay (.txt) file.');
                }

                // Initialize store with first batch
                const firstBatch = await fetchSessionRows(session.sessionId, 0, 200);
                
                // Final initial sync
                const initialSummary = normalizeSummary(session.summary || emptySummary);
                const finalResult = {
                    lines: firstBatch,
                    summary: initialSummary,
                    detectedSchema: session.detectedSchema as 'ACK' | 'RESP' | 'MRX' | 'INVALID'
                };
                
                setResult(finalResult);
                
                // Update global store
                store.setSession(true, session.sessionId, session.errorLines);
                store.setResult(finalResult);
                store.recordHistory();

                (window as unknown as { _activeSessionId: string })._activeSessionId = session.sessionId;

                // ⚡ NEW: Start background polling to get full counts (e.g. 1M rows) as indexing completes
                if (session.status === 'INDEXING') {
                    let isIndexing = true;
                    while (isIndexing && (window as unknown as { _activeSessionId: string })._activeSessionId === session.sessionId) {
                        try {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            const status = await fetchSessionStatus(session.sessionId);
                            
                            setProcessProgress(status.progress);
                            setProcessedLinesCount(status.indexedLines);
                            
                            if (status.summary) {
                                const updatedSummary = normalizeSummary(status.summary);
                                setResult(prev => ({ ...prev, summary: updatedSummary }));
                                store.setResult({ summary: updatedSummary });
                            }
                            
                            if (status.status !== 'INDEXING') {
                                isIndexing = false;
                                if (status.status === 'FAILED') {
                                    toast.error('Indexing Failed', { description: 'Background parsing encountered an error.', duration: 5000 });
                                }
                            }
                        } catch (pollErr) {
                            console.error('Polling error:', pollErr);
                            isIndexing = false; // Stop polling on error
                        }
                    }
                }
                
                setContent('SESSION');
                setProcessProgress(100);
            }

            setIsLoading(false);
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
                console.log('Stream parsing aborted');
                setIsLoading(false);
                return;
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            toast.error('Processing Error', { description: message, duration: 5000 });
            setIsLoading(false);
            setContent(''); // Reset view if it failed early
        }
    }, [isLoading]);

    // Auto-process file passed from Data Matrix tab
    useEffect(() => {
        if (pendingFile && !isLoading) {
            processFile(pendingFile);
            onPendingFileConsumed?.();
        }
    }, [pendingFile, isLoading, processFile, onPendingFileConsumed]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (isLoading) return;
        
        const files = e.dataTransfer.files;
        if (files.length > 1) {
            toast.warning('Multi-File Detected', {
                description: 'The Forge supports only one Prepay data file at a time.',
                duration: 2000,
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
        setGeneratingType(type);

        try {
            if (type === SCHEMAS.ACK) {
                const result = await convertMrxToAckOnBackend(originalFile, mrxTimestamp);
                downloadString(result.content, result.fileName);
                toast.success('ACK Generated', { description: `Converted to ${result.fileName}`, duration: 2000 });
            } else if (type === SCHEMAS.RESP) {
                const result = await convertMrxToRespOnBackend(originalFile, mrxTimestamp);
                downloadString(result.content, result.fileName);
                toast.success('RESP Generated', { description: `Converted to ${result.fileName}`, duration: 2000 });
            } else {
                const result = await convertMrxToCsvOnBackend(originalFile, mrxTimestamp);
                downloadString(result.content, result.fileName);
                toast.success('CSV Exported', { description: `Converted to ${result.fileName}`, duration: 2000 });
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.warn('[MRX Forge] Conversion error:', message);
            toast.error(`${type} Generation Failed`, {
                description: (err instanceof ApiError && err.isNetworkError) ? err.message : message,
                duration: 5000
            });
        } finally {
            setGeneratingType(null);
        }
    };

    const handleOpenInMatrix = async (type: 'ACK' | 'RESP') => {
        if (!content || !originalFile || generatingType) return;
        setGeneratingType(type);

        try {
            const result = await (
                type === SCHEMAS.ACK ? convertMrxToAckOnBackend(originalFile, mrxTimestamp) :
                type === SCHEMAS.RESP ? convertMrxToRespOnBackend(originalFile, mrxTimestamp) :
                convertMrxToCsvOnBackend(originalFile, mrxTimestamp)
            );
            onOpenInDataMatrix?.(result.content, result.fileName);
            toast.success(`${type} opened in Data Matrix`, {
                description: `Converted to ${result.fileName}`,
                duration: 2000
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            toast.error(`${type} Generation Failed`, {
                description: (err instanceof ApiError && err.isNetworkError) ? err.message : message,
                duration: 5000
            });
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
                            <h2 className="text-3xl font-black tracking-tighter uppercase italic">Prepay Forge Module</h2>
                            <p className="text-muted-foreground font-medium leading-relaxed max-w-sm mx-auto">
                                Feed raw Prepay data streams into the forge to synthesize calibrated ACK and RESP protocols.
                            </p>
                        </div>


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
                    {/* ═══════════════════════════════════════════════════════
                        FORGE HEADER BAR — Redesigned 3-Zone Layout
                        Zone A (left):   File identity + close
                        Zone B (center): Modifier controls (Reject / Deny / Partial)
                        Zone C (right):  Action buttons + Export CSV
                        ═══════════════════════════════════════════════════════ */}
                    <header className="h-14 border-b border-border/60 flex items-center px-4 bg-background/95 backdrop-blur-sm shrink-0 gap-0 relative">

                        {/* ── Zone A: File Identity ── */}
                        <div className="flex items-center gap-3 min-w-0 pr-4 border-r border-border/30">
                            <button
                                onClick={() => {
                                    if (abortControllerRef.current) {
                                        abortControllerRef.current.abort();
                                        abortControllerRef.current = null;
                                    }
                                    setContent('');
                                    setOriginalFile(null);
                                    setFileName(null);
                                    setShowAllErrors(false);
                                    setResult({ lines: [], summary: { total: 0, totalClaims: 0, valid: 0, invalid: 0, accepted: 0, rejected: 0, partial: 0 } });
                                }}
                                aria-label="Clear loaded file"
                                className="w-7 h-7 rounded-lg bg-muted/10 border border-border/40 flex items-center justify-center hover:bg-rose-500/15 hover:border-rose-500/30 hover:text-rose-400 transition-all shrink-0 text-muted-foreground"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-muted-foreground/50 font-black uppercase tracking-[0.25em]">PREPAY</span>
                                    {isLoading ? (
                                        <span className="text-[8px] text-primary font-black flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20">
                                            <Loader2 className="w-2 h-2 animate-spin" />
                                            {processProgress}%
                                        </span>
                                    ) : (
                                        <span className="text-[8px] text-emerald-500 font-black flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                            LOADED
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] font-black truncate max-w-[260px] leading-tight mt-0.5 tracking-tight" title={fileName ?? undefined}>
                                    {fileName}
                                </p>
                            </div>
                        </div>



                        {/* ── Zone B + C wrapper — grayed out when structural errors exist ── */}
                        <div className={cn(
                            "flex items-center flex-1 min-w-0 transition-all duration-200",
                            hasStructuralErrors && "opacity-30 pointer-events-none select-none"
                        )}>

                        {/* ── Zone B: Modifiers (Removed to be in the Data Matrix) ── */}
                        <div className="flex items-center gap-1.5 px-4 border-r border-border/30">
                            {/* Modifiers have been moved to the Data Matrix bulk action engine */}
                        </div>

                        {/* ── Zone C: Actions (auto-pushes right) ── */}
                        <div className="flex items-center gap-2 ml-auto pl-4">

                            {/* Generate ACK */}
                            <ForgeButton icon={FileJson} label="Generate ACK" onClick={() => handleAction('ACK')} isLoading={generatingType === 'ACK'} disabled={hasStructuralErrors} />

                            {/* Generate RESP */}
                            <ForgeButton icon={Zap} label="Generate RESP" color="indigo" onClick={() => handleAction('RESP')} isLoading={generatingType === 'RESP'} disabled={hasStructuralErrors} />

                            {/* Visual separator */}
                            <div className="w-px h-7 bg-border/30 mx-0.5" />

                            {/* ACK → Matrix */}
                            <button
                                className={cn(
                                    "h-7 px-2.5 rounded-md border text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all",
                                    "border-primary/25 text-primary/60 hover:text-primary hover:bg-primary/10 hover:border-primary/40",
                                    (!content || !!generatingType) && "opacity-30 pointer-events-none"
                                )}
                                onClick={() => handleOpenInMatrix('ACK')}
                                disabled={!content || !!generatingType}
                            >
                                <ExternalLink className="w-2.5 h-2.5" />
                                ACK → Matrix
                            </button>

                            {/* RESP → Matrix */}
                            <button
                                className={cn(
                                    "h-7 px-2.5 rounded-md border text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all",
                                    "border-indigo-500/25 text-indigo-400/60 hover:text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/40",
                                    (!content || !!generatingType) && "opacity-30 pointer-events-none"
                                )}
                                onClick={() => handleOpenInMatrix('RESP')}
                                disabled={!content || !!generatingType}
                            >
                                <ExternalLink className="w-2.5 h-2.5" />
                                RESP → Matrix
                            </button>

                            {/* Visual separator */}
                            <div className="w-px h-7 bg-border/30 mx-0.5" />

                            {/* Export CSV — prominent CTA */}
                                <button
                                    className={cn(
                                        "h-7 px-3 rounded-md border flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider transition-all",
                                        "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-[0_0_12px_rgba(16,185,129,0.2)]",
                                        generatingType === 'CSV' && "opacity-70 pointer-events-none",
                                        (!!generatingType && generatingType !== 'CSV') && "opacity-30 pointer-events-none"
                                    )}
                                    onClick={() => handleAction('CSV')}
                                    disabled={!!generatingType}
                                >
                                    {generatingType === 'CSV' ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <FileSpreadsheet className="w-3 h-3" />
                                    )}
                                    Export CSV (TXT)
                                </button>


                        </div>

                        </div> {/* end Zone B+C lock wrapper */}
                    </header>

                    {/* ── Floated Structural lock badge ── */}
                    {hasStructuralErrors && (
                        <div className="absolute top-[72px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none z-[100]">
                            {/* Main error pill */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-rose-600 shadow-[0_4px_24px_rgba(225,29,72,0.4)] pointer-events-auto">
                                <AlertTriangle className="w-4 h-4 text-white shrink-0 animate-pulse" />
                                <span className="text-xs font-black text-white uppercase tracking-wider whitespace-nowrap">
                                    Length Mismatch — must be 921 chars
                                </span>
                                <span className="text-[10px] font-black text-rose-200 bg-rose-800/60 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    {structuralErrors.length} line{structuralErrors.length > 1 ? 's' : ''} locked
                                </span>
                            </div>
                            
                            {/* Line number chips */}
                            <div className={cn(
                                "flex items-center gap-1.5 flex-wrap justify-center pointer-events-auto",
                                showAllErrors 
                                    ? "bg-background/95 backdrop-blur-md border border-rose-500/30 p-3 rounded-xl shadow-[0_8px_32px_rgba(225,29,72,0.15)] w-[90vw] max-w-[600px] max-h-[50vh] overflow-y-auto"
                                    : ""
                            )}>
                                {structuralErrors.slice(0, showAllErrors ? undefined : 5).map((l) => (
                                    <span key={l.lineNumber} className="text-[10px] font-mono font-black bg-rose-900/80 text-rose-200 border border-rose-600/60 px-2 py-0.5 rounded-md shadow-sm shrink-0">
                                        L{l.lineNumber} · {l.rawLength} ch
                                    </span>
                                ))}
                                {!showAllErrors && structuralErrors.length > 5 && (
                                    <button 
                                        onClick={() => setShowAllErrors(true)}
                                        className="text-[10px] font-mono font-bold text-rose-300 bg-rose-900/60 hover:bg-rose-800/80 transition-colors px-2 py-0.5 rounded-md border border-rose-700/40 cursor-pointer shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-rose-500 shadow-sm"
                                    >
                                        +{structuralErrors.length - 5} more
                                    </button>
                                )}
                                {showAllErrors && structuralErrors.length > 5 && (
                                    <div className="w-full flex justify-center mt-2 pt-3 border-t border-rose-500/20">
                                        <button 
                                            onClick={() => setShowAllErrors(false)}
                                            className="w-full max-w-[200px] active:scale-[0.98] text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-all py-2 rounded-md border border-rose-500/20 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-rose-500"
                                        >
                                            Show Less
                                        </button>
                                    </div>
                                )}
                            </div>
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
                                headerLines={headerLines}
                            />
                        </div>
                    </div>

                    <footer className="h-10 border-t border-border px-8 flex items-center justify-between bg-background/50 overflow-hidden shrink-0">
                        <div className="flex-1 flex items-center gap-6 overflow-x-auto no-scrollbar scroll-smooth mr-4">
                            {trailerLines.length > 0 ? (
                                trailerLines[0].fields.map((field, i) => (
                                    <div key={i} className="flex items-center gap-2 shrink-0">
                                        <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-tighter">
                                            {field.def.name}
                                        </span>
                                        <span className={cn(
                                            "text-[10px] font-mono font-bold",
                                            field.isValid ? "text-foreground/70" : "text-rose-500"
                                        )}>
                                            {field.def.type === 'Numeric' ? field.value.replace(/^0+/, '') || '0' : field.value}
                                        </span>
                                        {i < trailerLines[0].fields.length - 1 && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-border/20 ml-2" />
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="flex items-center gap-4 text-[9px] uppercase tracking-widest text-muted-foreground">
                                    <span>Total Records: {processedLinesCount || dataLineCount}</span>
                                    <span className="w-1 h-1 bg-border rounded-full" />
                                    <span>Signature: {mrxTimestamp}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 border-l border-border/40 pl-4">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] uppercase font-black text-emerald-500/70 italic tracking-tighter">Forge Ready</span>
                        </div>
                    </footer>
                </div >
            )
            }
        </div >
    );
}

function ForgeButton({ icon: Icon, label, color = "primary", onClick, isLoading, disabled }: { icon: React.ElementType, label: string, color?: "primary" | "indigo", onClick: () => void, isLoading?: boolean, disabled?: boolean }) {
    const colors = {
        primary: "bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary shadow-primary/10",
        indigo: "bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 shadow-indigo-500/10"
    };

    const isBlocked = isLoading || disabled;

    return (
        <button
            onClick={onClick}
            disabled={isBlocked}
            aria-label={label}
            className={cn(
                "h-10 px-6 rounded-xl border flex items-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95",
                colors[color],
                isLoading && "opacity-70 pointer-events-none cursor-wait",
                disabled && !isLoading && "opacity-30 pointer-events-none cursor-not-allowed grayscale"
            )}
        >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
            {label}
            {!isLoading && <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-50" />}
        </button>
    );
}
