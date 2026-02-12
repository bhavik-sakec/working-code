'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { parseFileOnBackend, ApiError, checkHealth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Check, Activity, AlertTriangle, ShieldAlert, Copy, Download, X, WifiOff, ArrowUp } from 'lucide-react';
import { format } from 'date-fns';

// Extracted Components
import { StatBox } from './visualizer/stat-box';
import { VisualizerSidebar } from './visualizer/sidebar';
import { LoadingOverlay } from './visualizer/loading-overlay';
import { GridView } from './visualizer/grid-view';

const ErrorBanner = ({ error, onDismiss }: { error: string, onDismiss: () => void }) => {
    const isConnectionError = error.toLowerCase().includes('connect') || error.toLowerCase().includes('engine') || error.toLowerCase().includes('server');

    return (
        <div className="relative mt-8 group animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-500">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-rose-500/20 via-rose-500/40 to-rose-500/20 rounded-2xl blur-xl opacity-50 block group-hover:opacity-75 transition-opacity duration-500" />
            
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
                                {isConnectionError ? 'System Service Offline' : 'Processing Interrupted'}
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

const emptyResult = { lines: [], summary: { total: 0, valid: 0, invalid: 0, accepted: 0, rejected: 0 } };

export function AckVisualizer() {
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processProgress, setProcessProgress] = useState(0);
    const [processedLines, setProcessedLines] = useState(0);
    const [activePhase, setActivePhase] = useState<'IDLE' | 'UPLOADING' | 'PROCESSING'>('IDLE');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [schema, setSchema] = useState<'ACK' | 'RESP'>('ACK');
    const [isDragging, setIsDragging] = useState(false);
    const [editingField, setEditingField] = useState<{ lineIdx: number, fieldIdx: number, value: string } | null>(null);

    const [fileName, setFileName] = useState<string | null>(null);

    const virtuosoRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [result, setResult] = useState<any>(emptyResult);
    const [error, setError] = useState<string | null>(null);
    const [isReconnecting, setIsReconnecting] = useState(false);

    // Self-Healing Logic: Polling backend status when in error state
    useEffect(() => {
        if (!error || !error.toLowerCase().includes('connect')) return;

        let pollCount = 0;
        const interval = setInterval(async () => {
            pollCount++;
            setIsReconnecting(true);
            const isAlive = await checkHealth();
            if (isAlive) {
                setError(null);
                setIsReconnecting(false);
                clearInterval(interval);
            }
            if (pollCount > 20) setIsReconnecting(false); // Stop pulse animation if it takes too long
        }, 3000);

        return () => clearInterval(interval);
    }, [error]);

    const handleFieldUpdate = (lineIdx: number, fieldDef: any, newValue: string) => {
        // Update raw content for download/copy
        setContent((prevContent: string) => {
            const lines = prevContent.split('\n');
            const line = lines[lineIdx];
            if (!line) return prevContent;

            let val = newValue;
            if (fieldDef.type === 'Numeric') {
                val = newValue.padStart(fieldDef.length, '0');
            } else {
                val = newValue.padEnd(fieldDef.length, ' ');
            }
            val = val.slice(0, fieldDef.length);

            const newLine = line.substring(0, fieldDef.start - 1) + val + line.substring(fieldDef.end);
            lines[lineIdx] = newLine;
            return lines.join('\n');
        });

        // Update the stored parsed result directly (no re-parsing needed)
        setResult((prev: any) => {
            const newLines = [...prev.lines];
            if (newLines[lineIdx]) {
                const newFields = [...newLines[lineIdx].fields];
                const fieldIdx = newFields.findIndex((f: any) => f.def.name === fieldDef.name);
                if (fieldIdx !== -1) {
                    let val = newValue;
                    if (fieldDef.type === 'Numeric') {
                        val = newValue.padStart(fieldDef.length, '0');
                    } else {
                        val = newValue.padEnd(fieldDef.length, ' ');
                    }
                    val = val.slice(0, fieldDef.length);
                    newFields[fieldIdx] = { ...newFields[fieldIdx], value: val };
                }
                newLines[lineIdx] = { ...newLines[lineIdx], fields: newFields };
            }
            return { ...prev, lines: newLines };
        });
    };

    const isFieldEditable = (name: string) => ['Status', 'Reject ID', 'Reject Reason', 'MRx Claim Status', 'Units approved', 'Units Denied', 'Procedure Code', 'Denial Code', 'Adjustment reason'].includes(name);
    const isDropdownField = (name: string) => ['Status', 'Reject ID', 'MRx Claim Status', 'Denial Code'].includes(name);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (isLoading) return;
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isLoading) return;
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const processFile = useCallback(async (file: File) => {
        // Guard: prevent concurrent uploads
        if (isLoading) return;

        setIsLoading(true);
        setFileName(file.name);
        setError(null);
        setActivePhase('UPLOADING');
        setUploadProgress(0);
        setProcessProgress(0);

        try {
            // Simulate upload progress
            setUploadProgress(30);

            // Send file to backend for parsing
            const backendResponse = await parseFileOnBackend(file);

            setUploadProgress(100);
            setActivePhase('PROCESSING');

            // Check if the file type is valid
            if (backendResponse.detectedSchema === 'INVALID') {
                setError('Invalid file format. The file could not be recognized as ACK, RESP, or MRX.');
                setIsLoading(false);
                setActivePhase('IDLE');
                return;
            }

            // Set the detected schema (backend auto-detected the file type)
            if (backendResponse.detectedSchema === 'MRX') {
                setSchema('ACK');
            } else {
                setSchema(backendResponse.detectedSchema as 'ACK' | 'RESP');
            }

            // Store the backend result directly (no frontend re-parsing)
            // Normalize backend response: map 'valid' to 'isValid' if necessary due to JSON serialization
            const parsedLines = backendResponse.lines.map((l: any) => ({
                ...l,
                isValid: l.isValid ?? l.valid,
                fields: l.fields?.map((f: any) => ({
                    ...f,
                    isValid: f.isValid ?? f.valid
                }))
            }));

            const parsedResult = {
                lines: parsedLines,
                summary: backendResponse.summary
            };

            // Simulate processing animation
            const total = backendResponse.lines.length;
            let current = 0;
            const interval = setInterval(() => {
                const chunk = Math.min(500, total - current);
                current += chunk;
                setProcessedLines(current);
                setProcessProgress(Math.round((current / total) * 100));

                if (current >= total) {
                    clearInterval(interval);
                    // Set the raw content for editing/download support
                    setContent(backendResponse.rawContent);
                    // Set the backend parsed result directly
                    setResult(parsedResult);
                    setTimeout(() => {
                        setIsLoading(false);
                        setActivePhase('IDLE');
                    }, 500);
                }
            }, 50);
        } catch (err: any) {
            console.warn('[ACK Visualizer] Backend parsing error:', err.message);
            setError(
                (err instanceof ApiError && err.isNetworkError)
                    ? err.message
                    : `Processing failed: ${err.message || 'Unknown error'}`
            );
            setIsLoading(false);
            setActivePhase('IDLE');
        }
    }, [isLoading]);

    const clearContent = () => {
        setContent('');
        setProcessedLines(0);
        setProcessProgress(0);
        setUploadProgress(0);
        setFileName(null);
        setResult(emptyResult);
        setActivePhase('IDLE');
    };
    const handleCopy = () => { navigator.clipboard.writeText(content); };

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

    const handleDownload = () => {
        const downloadName = fileName || `${schema}_EXPORT_${format(new Date(), 'yyyyMMddHHmmss')}.txt`;
        if (content) downloadString(content, downloadName);
    };

    return (
        <div className="h-full flex bg-background text-foreground font-mono text-sm overflow-hidden">
            <VisualizerSidebar
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                content={content}
                schema={schema}
                isDragging={isDragging}
                handleDragOver={handleDragOver}
                handleDragLeave={handleDragLeave}
                handleDrop={handleDrop}
                handleFileInput={handleFileInput}
                fileInputRef={fileInputRef}
                clearContent={clearContent}
                setSchema={setSchema}
                result={result}
                virtuosoRef={virtuosoRef}
            />

            <main className="flex-1 flex flex-col min-w-0 bg-background relative min-h-0">
                <header className="h-24 border-b border-border flex bg-background shrink-0">
                    <StatBox label="Total Rows" value={result.summary.total.toLocaleString()} icon={Activity} />
                    <StatBox label="Accepted" value={result.summary.accepted.toLocaleString()} icon={Check} colorClass="text-emerald-500" borderClass="border-emerald-500/20" />
                    <StatBox label="Rejected" value={result.summary.rejected.toLocaleString()} icon={AlertTriangle} colorClass={result.summary.rejected > 0 ? "text-amber-500" : "text-muted-foreground"} borderClass={result.summary.rejected > 0 ? "border-amber-500/20 bg-amber-500/5" : ""} />
                    <StatBox label="Schema Fails" value={result.summary.invalid.toLocaleString()} icon={ShieldAlert} colorClass={result.summary.invalid > 0 ? "text-rose-500" : "text-muted-foreground"} borderClass={result.summary.invalid > 0 ? "border-rose-500/20 bg-rose-500/5" : ""} />

                    <div className="flex-[2] flex flex-col justify-center px-6 border-r border-border hidden xl:flex min-w-0 overflow-hidden">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Source Information</div>
                        <div className="flex flex-col gap-1 min-w-0">
                            {fileName ? (
                                <>
                                    <div className="text-sm font-black truncate whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]" title={fileName}>{fileName}</div>
                                    <div className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                        {schema} Protocol V1
                                    </div>
                                </>
                            ) : (
                                <span className="text-xs text-muted-foreground italic font-mono opacity-50">Waiting for data stream...</span>
                            )}
                        </div>
                    </div>

                    <div className="flex-[1] flex items-center justify-end px-6 gap-3">
                        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-dashed hover:border-primary transition-all" onClick={handleCopy} disabled={!content}><Copy className="w-3.5 h-3.5" /> COPY</Button>
                        <Button variant="secondary" size="sm" className="h-9 gap-2 text-xs font-bold" onClick={handleDownload} disabled={!content}><Download className="w-3.5 h-3.5" /> DOWNLOAD</Button>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
                    <div className="border-b border-border bg-muted/10 shrink-0">
                        <div className="h-6 flex items-center bg-muted/5 font-mono text-[8px] text-muted-foreground/40 select-none overflow-hidden pl-12">
                            {Array.from({ length: schema === 'ACK' ? 22 : 23 }).map((_, i) => (
                                <div key={i} className="border-l border-border/20 h-full flex items-center pl-1 shrink-0" style={{ width: '80px' }}>{(i * 10) + 1}</div>
                            ))}
                        </div>
                    </div>

                    <LoadingOverlay isLoading={isLoading} activePhase={activePhase} uploadProgress={uploadProgress} processProgress={processProgress} processedLines={processedLines} />

                    <div className="flex-1 w-full bg-muted/10 overflow-hidden relative">
                        {!content ? (
                            <div className="h-full flex flex-col items-center justify-center w-full p-8">
                                <div className="flex flex-col items-center justify-center text-muted-foreground opacity-20 gap-4 mb-4">
                                    <Activity className="w-24 h-24 stroke-[0.5]" />
                                    <span className="text-xl tracking-[1em] font-light uppercase">Awaiting Data Stream</span>
                                </div>
                                
                                {error && (
                                    <ErrorBanner error={error} onDismiss={() => setError(null)} />
                                )}
                            </div>
                        ) : (
                            <GridView
                                result={result}
                                schema={schema}
                                virtuosoRef={virtuosoRef}
                                editingField={editingField}
                                setEditingField={setEditingField}
                                handleFieldUpdate={handleFieldUpdate}
                                isFieldEditable={isFieldEditable}
                                isDropdownField={isDropdownField}
                            />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
