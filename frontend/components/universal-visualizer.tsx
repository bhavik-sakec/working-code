'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import { parseTextOnBackend, streamParseFile, initSession, fetchSessionRows, fetchSessionStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Check, Activity, AlertTriangle, ShieldAlert, Download, Shuffle, Undo2, FileText } from 'lucide-react';
import { ParsedLine, FieldDefinition, ParsedField, ParseResult } from '@/lib/types';
import { SCHEMAS, RESP_STATUS, LINE_TYPES, FIELD_NAMES } from '@/lib/constants';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn, normalizeSummary } from '@/lib/utils';

// Extracted Components
import { StatBox } from './visualizer/stat-box';
import { VisualizerSidebar } from './visualizer/sidebar';
import { LoadingOverlay } from './visualizer/loading-overlay';
import { GridView } from './visualizer/grid-view';
import { SimulationHUD } from './visualizer/simulation-hud';


import { useStore } from '@/lib/store';

const emptySummary = { total: 0, totalClaims: 0, valid: 0, invalid: 0, accepted: 0, rejected: 0, partial: 0 };

export function UniversalVisualizer({ pendingContent, onPendingContentConsumed }: {
    pendingContent?: { text: string; fileName: string } | null,
    onPendingContentConsumed?: () => void
}) {
    const store = useStore();
    const { 
        lines, content, summary, schema, fileName, history, 
        isLoading, activePhase, processProgress, processedLines,
        validationErrors,
        setResult, addRows, setSchema, setFileName, setLoading, 
        setError, setActivePhase, setProcessProgress, setProcessedLines,
        recordHistory, updateField, undo, applyBulkAction, clearStore,
        closeFile, pageSize
    } = store;

    const result = useMemo<ParseResult>(() => ({
        lines,
        summary,
        detectedSchema: schema,
        rawContent: content,
        validationErrors
    }), [lines, summary, schema, content, validationErrors]);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isDragging, setIsDragging] = useState(false);

    // Bulk action panel state (UI only)
    const [bulkPanel, setBulkPanel] = useState<{ open: boolean; mode: 'DY' | 'PA' | 'R' }>({
        open: false, mode: RESP_STATUS.DENIED as 'DY'
    });
    const [bulkPct, setBulkPct] = useState('5');
    const [bulkInputMode, setBulkInputMode] = useState<'PCT' | 'CNT'>('CNT');
    const [bulkCount, setBulkCount] = useState('1');
    const [randomizeDenyCodes, setRandomizeDenyCodes] = useState(true);
    const [bulkDenialCode, setBulkDenialCode] = useState('GI');
    const [isBatchExecuting, setIsBatchExecuting] = useState(false);
    const [editingField, setEditingField] = useState<{ lineIdx: number, fieldIdx: number, value: string } | null>(null);
    const [fetchingProgress, setFetchingProgress] = useState(0);

    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const headerLines = useMemo(() => result.lines.filter(l => l?.type === LINE_TYPES.HEADER), [result.lines]);
    const trailerLines = useMemo(() => result.lines.filter(l => l?.type === LINE_TYPES.TRAILER), [result.lines]);

    const handleUndo = useCallback(() => {
        undo();
    }, [undo]);

    // Keyboard shortcut for Undo (Ctrl+Z)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo]);

    // Auto-process content sent from MRX Forge
    useEffect(() => {
        if (!pendingContent || isLoading) return;

        const loadConvertedContent = async () => {
            setLoading(true);
            setError(null);
            setActivePhase('PROCESSING');
            setFileName(pendingContent.fileName);

            try {
                const backendResponse = await parseTextOnBackend(pendingContent.text);

                if (backendResponse.detectedSchema === SCHEMAS.INVALID || backendResponse.detectedSchema === SCHEMAS.MRX) {
                    toast.error('Parse Error', { description: 'Converted content could not be parsed as ACK or RESP.', duration: 5000 });
                    setLoading(false);
                    setActivePhase('IDLE');
                    onPendingContentConsumed?.();
                    return;
                }

                setSchema(backendResponse.detectedSchema as 'ACK' | 'RESP');

                const parsedLines: ParsedLine[] = backendResponse.lines.map((l: ParsedLine) => ({
                    ...l,
                    isValid: l.isValid ?? l.valid,
                    fields: (l.fields ?? []).map((f: ParsedField) => ({
                        ...f,
                        isValid: f.isValid ?? f.valid
                    }))
                }));

                setResult({
                    ...backendResponse,
                    summary: normalizeSummary(backendResponse.summary),
                    lines: parsedLines,
                    rawContent: backendResponse.rawContent
                });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                toast.error('Load Error', { description: `Failed to load converted content: ${message}`, duration: 5000 });
            } finally {
                setLoading(false);
                setActivePhase('IDLE');
                onPendingContentConsumed?.();
            }
        };

        loadConvertedContent();
    }, [pendingContent, isLoading, setLoading, setError, setActivePhase, setFileName, setSchema, setResult, onPendingContentConsumed]);

    const handleFieldUpdate = useCallback((lineIdx: number, fieldDef: FieldDefinition, newValue: string) => {
        const currentLine = lines[lineIdx];
        if (currentLine?.fields.find((f: ParsedField) => f.def.name === fieldDef.name)?.value === newValue) return;

        if (schema === SCHEMAS.RESP && fieldDef.name === FIELD_NAMES.MRX_CLAIM_STATUS && newValue === RESP_STATUS.PARTIAL) {
            const apprVal = currentLine.fields.find((f: ParsedField) => f.def.name === FIELD_NAMES.UNITS_APPROVED)?.value.trim() || '0';
            const denyVal = currentLine.fields.find((f: ParsedField) => f.def.name === FIELD_NAMES.UNITS_DENIED)?.value.trim() || '0';
            const total = (parseInt(apprVal) || 0) + (parseInt(denyVal) || 0);
            if (total < 2) {
                toast.error('Action Failed', {
                    description: 'Cannot change to Partial. At least 2 total units are required.',
                    duration: 5000
                });
                return;
            }
        }

        recordHistory(lineIdx);
        updateField(lineIdx, fieldDef, newValue);
    }, [lines, schema, recordHistory, updateField]);

    const processFiles = useCallback(async (files: File[]) => {
        if (isLoading || files.length === 0) return;

        const { activeFiles, setFileName: storeSetFileName } = useStore.getState();
        const pendingFiles = files.slice(0, 3 - activeFiles.length); // Limit to remaining slots
        
        const validMatrixFiles: File[] = [];

        // Pre-validation & Capacity Check
        for (const file of pendingFiles) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const exists = activeFiles.find((f: any) => f.name === file.name);
            if (exists) {
                storeSetFileName(file.name);
                continue;
            }

            const isNameCheckMrx = file.name.toLowerCase().includes('mrx');
            if (isNameCheckMrx) {
                toast.error("Invalid File Type", {
                    description: "Prepay content detected by name. Please use the Prepay Forge tab for these files.",
                    duration: 5000
                });
                continue;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const matrixCount = activeFiles.filter((f: any) => f.schema !== 'MRX' && f.schema !== 'INVALID').length + validMatrixFiles.length;
            if (matrixCount >= 2) {
                toast.warning("Matrix Slots Full", { description: "You can only have 2 active ACK/RESP files.", duration: 2000 });
                continue;
            }
            validMatrixFiles.push(file);
        }

        if (validMatrixFiles.length === 0) return;

        setLoading(true);
        setError(null);

        for (const file of validMatrixFiles) {
            storeSetFileName(file.name); 
            try {
                // Threshold moved to 20MB (approx 100K lines) to only enable paging for massive files.
                // For files under this limit, we load all rows at once for seamless scrolling.
                if (file.size < 20 * 1024 * 1024) {
                    await streamParseFile(file, ({ lines: chunkLines, result, progress, processedLines: count }) => {
                        // Deep content check via backend detection
                        if (result?.detectedSchema === 'MRX') {
                            toast.error("Prepay Content Rejected", {
                                description: `"${file.name}" was identified as Prepay data and cannot be processed in the Matrix tab.`,
                                duration: 5000
                            });
                            const currentId = useStore.getState().activeFileId;
                            if (currentId) closeFile(currentId);
                            throw new Error('PREPAY_DETECTED'); 
                        }

                        if (chunkLines) addRows(chunkLines);
                        if (result) setResult(result);
                        if (progress !== undefined) setProcessProgress(progress);
                        if (count !== undefined) setProcessedLines(count);
                    });
                } else {
                    setProcessProgress(0); // Start indexing
                    setActivePhase('INDEXING');
                    const session = await initSession(file);

                    if (session.detectedSchema === 'MRX') {
                        toast.error("Prepay Content Rejected", {
                            description: `"${file.name}" was identified as Prepay data and cannot be processed in the Matrix tab.`,
                            duration: 5000
                        });
                        const currentId = useStore.getState().activeFileId;
                        if (currentId) closeFile(currentId);
                        throw new Error('PREPAY_DETECTED'); 
                    }

                    const store = useStore.getState();
                    store.setSession(true, session.sessionId, session.errorLines || []);
                    (window as unknown as { _activeSessionId: string })._activeSessionId = session.sessionId;

                    // Initial partial result to setup the view
                    setResult({
                        lines: [],
                        summary: normalizeSummary(session.summary || emptySummary),
                        detectedSchema: session.detectedSchema as 'ACK' | 'RESP' | 'INVALID'
                    });

                    // Background polling for indexing progress
                    let isIndexing = session.status === 'INDEXING';
                    while (isIndexing) {
                        await new Promise(resolve => setTimeout(resolve, 800)); // Poll every 800ms
                        const status = await fetchSessionStatus(session.sessionId);
                        
                        setProcessProgress(status.progress);
                        setProcessedLines(status.indexedLines);
                        
                        // Update summary as discovery progresses
                        if (status.summary) {
                            setResult({ summary: normalizeSummary(status.summary) });
                        }

                        if (status.status === 'COMPLETED' || status.status === 'FAILED' || status.status === 'CANCELLED') {
                            isIndexing = false;
                            if (status.status === 'FAILED') throw new Error('Indexing failed on server');
                        }

                        // Load first batch once we have some lines, if not already loaded
                        const currentLines = useStore.getState().lines;
                        if (currentLines.length === 0 && (status.indexedLines > 0 || status.status === 'COMPLETED')) {
                            setActivePhase('PROCESSING');
                            // Load first batch once we have some lines, if not already loaded
                            const initialBatchSize = Math.min(pageSize, status.indexedLines);
                            const firstBatch = await fetchSessionRows(session.sessionId, 0, initialBatchSize);
                            if (firstBatch && firstBatch.length > 0) {
                                addRows(firstBatch);
                                // ⚡ FAST HUD RELEASE: Hide overlay once 50 lines are available
                                setLoading(false); 
                                setActivePhase('IDLE');
                                setFetchingProgress(0);
                            }

                            // Secondary Hydration: Fetch more lines total in the background (silent)
                            const targetTotal = Math.min(pageSize * 5, status.indexedLines);
                            if (targetTotal > initialBatchSize) {
                                (async () => {
                                    for (let start = initialBatchSize; start < targetTotal; start += 50) {
                                        const limit = Math.min(50, targetTotal - start);
                                        const batch = await fetchSessionRows(session.sessionId, start, limit);
                                        if (batch && batch.length > 0) addRows(batch);
                                    }
                                })();
                            }
                        }
                    }

                    // Final fetch of first batch if still empty
                    if (useStore.getState().lines.length === 0) {
                        const firstBatch = await fetchSessionRows(session.sessionId, 0, pageSize);
                        addRows(firstBatch);
                    }

                    toast.success('File Indexed', { description: `Successfully indexed ${file.name}` });
                }
            } catch (err: unknown) {
                const error = err as Error;
                if (error.message !== 'PREPAY_DETECTED') {
                    toast.error('Parsing Error', { description: error.message || 'An unknown parsing error occurred.', duration: 5000 });
                }
            } finally {
                setLoading(false);
                setActivePhase('IDLE');
            }
        }

        setLoading(false);
        setActivePhase('IDLE');
    }, [isLoading, setLoading, setError, setActivePhase, setProcessProgress, addRows, setResult, setProcessedLines, closeFile, pageSize]);

    const handleDownload = () => {
        const tsMatch = fileName?.match(/\d{10,}/);
        const ts = tsMatch ? tsMatch[0] : format(new Date(), 'yyyyMMddHHmmss');
        const downloadName = fileName || `${schema}_EXPORT_${ts}.txt`;

        const { isSessionMode, sessionId } = useStore.getState();

        if (isSessionMode && sessionId) {
            // Direct download link from backend for massive files
            const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/session/${sessionId}/export`;
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = downloadName; // The backend response will suggest string but 'download' attribute overrides it if same-origin (handled by browser)
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else if (content) {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            toast.error('Export Failed', {
                description: 'Raw source content missing.',
                duration: 5000
            });
        }
    };

    const onApplyBulkAction = useCallback(async () => {
        if (isBatchExecuting) return; // Guard against double-clicks
        setIsBatchExecuting(true);
        try {
            const result = await applyBulkAction(bulkPanel.mode, {
                pct: parseInt(bulkPct) || 5,
                cnt: parseInt(bulkCount) || 1,
                inputMode: bulkInputMode,
                randomize: randomizeDenyCodes,
                denialCode: bulkDenialCode
            });
            if (result.eligible === 0) {
                toast.error('Action Failed', {
                    description: 'No claims are eligible for this action.',
                    duration: 5000
                });
                return;
            }
            if (bulkInputMode === 'CNT' && result.requested > result.eligible) {
                toast.error('Action Failed', {
                    description: `Requested ${result.requested} but only ${result.eligible} are eligible.`,
                    duration: 5000
                });
                return;
            }
            setBulkPanel(p => ({ ...p, open: false }));
            toast.info(`Bulk action applied to ${result.applied} claims.`, { duration: 2000 });
        } catch (err) {
            let message = 'Unknown error';
            if (err instanceof Error) message = err.message;
            toast.error('Bulk Action Error', { description: message, duration: 5000 });
        } finally {
            setIsBatchExecuting(false);
        }
    }, [isBatchExecuting, applyBulkAction, bulkPanel.mode, bulkPct, bulkCount, bulkInputMode, randomizeDenyCodes, bulkDenialCode, setBulkPanel]);

    return (
        <div className="h-full flex bg-background text-foreground font-mono text-sm overflow-hidden">
            <VisualizerSidebar
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                content={content}
                schema={schema}
                isDragging={isDragging}
                handleDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                handleDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                handleDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = Array.from(e.dataTransfer.files);
                    if (files.length > 0) processFiles(files);
                }}
                handleFileInput={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) processFiles(files);
                }}
                fileInputRef={fileInputRef}
                clearContent={clearStore}
                setSchema={setSchema}
                result={result}
                virtuosoRef={virtuosoRef}
                fileName={fileName}
            />

            <main className="flex-1 flex flex-col min-w-0 bg-background relative min-h-0">
                <SimulationHUD
                    open={bulkPanel.open}
                    mode={bulkPanel.mode}
                    schema={schema}
                    bulkInputMode={bulkInputMode}
                    bulkPct={bulkPct}
                    bulkCount={bulkCount}
                    randomizeDenyCodes={randomizeDenyCodes}
                    bulkDenialCode={bulkDenialCode}
                    setBulkPanel={setBulkPanel}
                    setBulkInputMode={setBulkInputMode}
                    setBulkPct={setBulkPct}
                    setBulkCount={setBulkCount}
                    setRandomizeDenyCodes={setRandomizeDenyCodes}
                    setBulkDenialCode={setBulkDenialCode}
                    applyBulkAction={onApplyBulkAction}
                    isBatchExecuting={isBatchExecuting}
                />
                <header className="h-[54px] border-b border-border flex bg-background shrink-0 divide-x divide-border overflow-hidden relative">
                    <div className="flex-1 flex relative z-10">
                        {/* Records = Total Physical Lines | Claims = Valid Data Lines */}
                        <StatBox label="Records" value={(summary.total || 0).toLocaleString()} icon={Activity} />
                        <StatBox label="Claims" value={(summary.totalClaims || 0).toLocaleString()} icon={FileText} colorClass="text-primary" />
                        <StatBox label="Accepted" value={(summary.accepted || 0).toLocaleString()} icon={Check} colorClass="text-emerald-500" borderClass="border-emerald-500/20" />
                        {schema === SCHEMAS.RESP && (
                            <StatBox label="Partial" value={(summary.partial || 0).toLocaleString()} icon={Shuffle} colorClass="text-amber-500" borderClass="border-amber-500/20" />
                        )}
                        <StatBox label="Rejected" value={(summary.rejected || 0).toLocaleString()} icon={AlertTriangle} colorClass={(summary.rejected || 0) > 0 ? "text-rose-500" : "text-muted-foreground"} borderClass={(summary.rejected || 0) > 0 ? "border-rose-500/20 bg-rose-500/5" : ""} />
                        <StatBox label="Issues" value={(summary.invalid || 0).toLocaleString()} icon={ShieldAlert} colorClass={(summary.invalid || 0) > 0 ? "text-rose-500" : "text-muted-foreground"} borderClass={(summary.invalid || 0) > 0 ? "border-rose-500/20 bg-rose-500/5" : ""} />
                    </div>


                    <div className="flex flex-none items-center justify-end px-4 gap-4 bg-muted/5 relative z-10 min-w-0">
                        <div className="flex items-center gap-2 pr-4 border-r border-border/50 shrink-0">
                            {content && (
                                <button
                                    onClick={() => setBulkPanel(p => ({ ...p, open: !p.open }))}
                                    className={cn(
                                        "h-7 px-3 flex items-center gap-2 rounded-none text-[9px] font-black uppercase tracking-widest border transition-all shadow-sm",
                                        bulkPanel.open ? "bg-primary/20 border-primary text-primary" : "border-primary/30 text-primary hover:bg-primary/10 hover:border-primary"
                                    )}
                                >
                                    <Shuffle className="w-2.5 h-2.5" />
                                    Batch Engine
                                </button>
                            )}

                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "h-7 px-2 rounded-none text-[9px] font-black uppercase tracking-widest gap-1.5 transition-all border border-transparent",
                                    history.length > 0 ? "text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/20" : "text-muted-foreground opacity-30 px-1"
                                )}
                                onClick={handleUndo}
                                disabled={history.length === 0}
                            >
                                <Undo2 className="w-3 h-3" />
                                {history.length > 0 && "Undo"}
                            </Button>
                        </div>

                        <Button 
                            variant="default" 
                            className="h-8 gap-2 px-4 rounded-none text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground group shrink-0" 
                            onClick={handleDownload} 
                            disabled={lines.length === 0}
                        >
                            <Download className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" /> 
                            Export
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
                    <LoadingOverlay 
                        isLoading={isLoading} 
                        activePhase={activePhase}
                        uploadProgress={activePhase === 'UPLOADING' ? processProgress : 100}
                        processProgress={processProgress}
                        processedLines={processedLines} 
                        fetchingProgress={fetchingProgress}
                    />

                    <div className="flex-1 w-full bg-background overflow-hidden relative flex flex-col">


                        {lines.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center w-full p-8">
                                <div className="text-center space-y-4 max-w-md">
                                    <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto border border-dashed border-border">
                                        <FileText className="w-8 h-8 text-muted-foreground/40" />
                                    </div>
                                    <h3 className="text-lg font-black uppercase tracking-widest text-muted-foreground/60">No Data Loaded</h3>
                                    <p className="text-xs text-muted-foreground/40 leading-relaxed font-bold uppercase italic">
                                        Upload an ACK or RESP file to begin real-time visualization and synthesis.
                                    </p>
                                </div>
                            </div>
                        ) : (
                        <div className="flex-1 w-full min-h-0 bg-muted/10 overflow-hidden relative border-t border-border/50">
                            <GridView
                                result={result}
                                schema={schema}
                                virtuosoRef={virtuosoRef}
                                editingField={editingField}
                                setEditingField={setEditingField}
                                handleFieldUpdate={handleFieldUpdate}
                                isFieldEditable={(name) => ([FIELD_NAMES.UNITS_APPROVED, FIELD_NAMES.UNITS_DENIED] as string[]).includes(name)}
                                headerLines={headerLines}
                            />
                        </div>
                        )}
                    </div>

                    <footer className="h-10 border-t border-border px-8 flex items-center justify-between bg-background shrink-0 overflow-hidden">
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
                                        {i < (trailerLines[0]?.fields?.length || 0) - 1 && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-border/20 ml-2" />
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="flex items-center gap-4 text-[9px] uppercase tracking-widest text-muted-foreground">
                                    <span>Records: {summary.total.toLocaleString()}</span>
                                    <span className="w-1 h-1 bg-border rounded-full" />
                                    <span>Claims: {summary.totalClaims.toLocaleString()}</span>
                                    <span className="w-1 h-1 bg-border rounded-full" />
                                    <span className="text-primary/60 font-black italic">DISCOVERED_VIA_TRAILER</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 border-l border-border/40 pl-4">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-[9px] uppercase font-black text-primary/70 italic tracking-tighter">Matrix Active</span>
                        </div>
                    </footer>
                </div>
            </main>
        </div>
    );
}
