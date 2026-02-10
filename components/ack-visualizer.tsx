'use client';

import React, { useState, useMemo, useRef } from 'react';
import { parseAckFile } from '@/lib/ack-parser';
import { parseRespFile } from '@/lib/resp-parser';
import { Button } from '@/components/ui/button';
import { Check, Activity, AlertTriangle, ShieldAlert, Copy, Download } from 'lucide-react';
import { format } from 'date-fns';

// Extracted Components
import { StatBox } from './visualizer/stat-box';
import { VisualizerSidebar } from './visualizer/sidebar';
import { LoadingOverlay } from './visualizer/loading-overlay';
import { GridView } from './visualizer/grid-view';

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

    const result = useMemo(() => {
        if (schema === 'ACK') return parseAckFile(content);
        return parseRespFile(content);
    }, [content, schema]);

    const handleFieldUpdate = (lineIdx: number, fieldDef: any, newValue: string) => {
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
    };

    const isFieldEditable = (name: string) => ['Status', 'Reject ID', 'Reject Reason', 'MRx Claim Status', 'Units approved', 'Units Denied', 'Procedure Code', 'Denial Code', 'Adjustment reason'].includes(name);
    const isDropdownField = (name: string) => ['Status', 'Reject ID', 'MRx Claim Status', 'Denial Code'].includes(name);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const processFile = (file: File) => {
        setIsLoading(true);
        setFileName(file.name);
        setActivePhase('UPLOADING');
        setUploadProgress(0);
        setProcessProgress(0);

        const reader = new FileReader();
        reader.onprogress = (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };

        reader.onload = (e) => {
            const text = e.target?.result as string;
            setActivePhase('PROCESSING');
            const lines = text.split('\n');
            const total = lines.length;
            let current = 0;

            const firstLine = lines[0] || '';
            let detectedSchema: 'ACK' | 'RESP' | 'INVALID' | 'MRX' = 'ACK';

            if (firstLine.length >= 900) {
                detectedSchema = 'MRX';
            } else if (firstLine.length >= 230) {
                detectedSchema = 'RESP';
            } else if (firstLine.length >= 220) {
                detectedSchema = 'ACK';
            } else if (firstLine.trim().length > 0) {
                const primeIndex = firstLine.indexOf('PRIME');
                if (primeIndex >= 1 && primeIndex <= 5) {
                    detectedSchema = 'RESP';
                } else if (firstLine.length < 100) {
                    detectedSchema = 'INVALID';
                } else {
                    detectedSchema = 'ACK';
                }
            } else {
                detectedSchema = 'INVALID';
            }

            if (detectedSchema === 'INVALID') {
                setIsLoading(false);
                setActivePhase('IDLE');
                return;
            }

            if (detectedSchema === 'MRX') {
                setSchema('ACK');
            } else {
                setSchema(detectedSchema);
            }

            const interval = setInterval(() => {
                const chunk = Math.min(500, total - current);
                current += chunk;
                setProcessedLines(current);
                setProcessProgress(Math.round((current / total) * 100));

                if (current >= total) {
                    clearInterval(interval);
                    setContent(text);
                    setTimeout(() => {
                        setIsLoading(false);
                        setActivePhase('IDLE');
                    }, 500);
                }
            }, 50);
        };
        reader.readAsText(file);
    };

    const clearContent = () => { setContent(''); setProcessedLines(0); setProcessProgress(0); setUploadProgress(0); setFileName(null); };
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

                    <div className="flex-[2] flex flex-col justify-center px-6 border-r border-border hidden xl:flex">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Source Information</div>
                        <div className="flex flex-col gap-1">
                            {fileName ? (
                                <>
                                    <div className="text-sm font-black truncate max-w-[300px]">{fileName}</div>
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

                    <div className="flex-1 w-full bg-muted/10 overflow-hidden">
                        {!content ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-20 gap-4 w-full">
                                <Activity className="w-24 h-24 stroke-[0.5]" />
                                <span className="text-xl tracking-[1em] font-light uppercase">Awaiting Data Stream</span>
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
