'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { FileText, Upload, Check, ChevronLeft, ChevronRight, X, Activity, ShieldAlert } from 'lucide-react';
import { useStore } from '@/lib/store';
import { ParseResult, ParsedLine, ParsedField } from '@/lib/types';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

interface VisualizerSidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (o: boolean) => void;
    content: string;
    schema: 'ACK' | 'RESP' | 'MRX' | 'INVALID';
    isDragging: boolean;
    handleDragOver: (e: React.DragEvent) => void;
    handleDragLeave: (e: React.DragEvent) => void;
    handleDrop: (e: React.DragEvent) => void;
    handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    clearContent: () => void;
    setSchema: (s: 'ACK' | 'RESP') => void;

    result: ParseResult;
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    fileName: string | null;
}

export function VisualizerSidebar({
    isSidebarOpen,
    setIsSidebarOpen,
    content,
    schema,
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInput,
    fileInputRef,
    result,
    virtuosoRef,
    fileName
}: VisualizerSidebarProps) {
    const { activeFiles, activeFileId, switchFile, closeFile } = useStore();
    
    // EXCLUSIVE: Data Matrix tab only manages ACK & RESP protocols. 
    // Prepay Forge maintains its own separate slot for raw streams.
    const matrixFiles = useMemo(() => 
        activeFiles.filter(f => f.schema !== 'MRX'),
    [activeFiles]);

    return (
        <aside
            className={cn(
                "relative border-r border-border flex flex-col bg-background/50 z-20 shrink-0 transition-all duration-300 ease-in-out backdrop-blur-sm",
                isSidebarOpen ? "w-80" : "w-4 border-r-0"
            )}
        >
            {/* HUD Pattern Overlay */}
            <div className="absolute inset-0 opacity-[0.01] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none" />

            {/* Prominent Vertical Toggle Handle */}
            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="absolute top-1/2 -translate-y-1/2 -right-4 z-50 group flex items-center justify-center w-8 h-32 outline-none transition-all"
                title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
                <div className="h-full w-[1px] bg-border group-hover:bg-primary transition-colors flex items-center justify-center relative">
                    <div className={cn(
                        "h-14 w-6 bg-background border border-border flex items-center justify-center shadow-xl transition-all text-muted-foreground group-hover:text-primary group-hover:border-primary group-hover:scale-110 rounded-none",
                        !isSidebarOpen && "border-l-0"
                    )}>
                        {isSidebarOpen ? <ChevronLeft className="size-4 stroke-[2px]" /> : <ChevronRight className="size-4 stroke-[2px]" />}
                    </div>
                </div>
            </button>

            {isSidebarOpen ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300 relative z-10">
                    <div className="p-5 border-b border-border space-y-5 pt-8 bg-muted/5">
                        {/* SESSION TABS */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Active Project Workspace</span>
                                <span className="text-[8px] font-bold text-muted-foreground/40">{matrixFiles.length}/2 MATRIX SLOTS</span>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-2">
                                {activeFiles.filter(f => f.schema !== 'MRX').map((file) => (
                                    <div 
                                        key={file.id}
                                        onClick={() => switchFile(file.id)}
                                        className={cn(
                                            "relative group p-3 border transition-all duration-200 cursor-pointer flex items-center gap-3",
                                            activeFileId === file.id 
                                                ? "bg-primary/10 border-primary/50 ring-1 ring-primary/20" 
                                                : "bg-background/20 border-border/30 hover:border-primary/30"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-7 h-7 flex items-center justify-center rounded-none border shrink-0",
                                            activeFileId === file.id ? "bg-primary/20 border-primary/40" : "bg-muted/10 border-border/50"
                                        )}>
                                            <FileText className={cn("w-4 h-4", activeFileId === file.id ? "text-primary" : "text-muted-foreground")} />
                                        </div>
                                        <div className="flex-1 min-w-0 pr-6">
                                            <div className="text-[10px] font-black truncate uppercase tracking-tight text-foreground">{file.name}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <div className={cn(
                                                    "w-1 h-1 rounded-full",
                                                    file.isSessionMode ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                                                )} />
                                                <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">
                                                    {file.isSessionMode ? 'Disk Index Active' : 'Matrix Buffer Locked'}
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); closeFile(file.id); }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground/40 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}

                                {matrixFiles.length === 1 && (
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(e) => { e.preventDefault(); handleDragOver(e); }}
                                        onDragLeave={(e) => { e.preventDefault(); handleDragLeave(e); }}
                                        onDrop={(e) => { e.preventDefault(); handleDrop(e); }}
                                        className={cn(
                                            "group p-3 border border-dashed border-border/30 hover:border-primary/50 transition-all duration-200 flex items-center gap-3 bg-muted/5 opacity-60 hover:opacity-100",
                                            isDragging && "bg-primary/10 border-primary border-solid opacity-100 animate-pulse"
                                        )}
                                    >
                                        <div className="w-7 h-7 flex items-center justify-center border border-dashed border-border/50 bg-background group-hover:border-primary/40">
                                            <Upload className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary/70" />
                                        </div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 group-hover:text-primary/70">Ingest New File</div>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* DROPZONE (Minimized) */}
                        {matrixFiles.length === 0 && (
                        <div
                            className={cn(
                                "relative h-32 border border-border/50 transition-all duration-300 flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden group hover:border-primary",
                                isDragging && "bg-primary/5 border-primary animate-pulse",
                                content ? "bg-primary/[0.02]" : "bg-transparent"
                            )}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {/* Scanning Effect for Dropzone */}
                            {isDragging && (
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/10 to-transparent h-1/2 w-full animate-scan pointer-events-none" />
                            )}
                            <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                            <div className="text-center px-4">
                                <span className="block font-black text-[9px] tracking-widest uppercase group-hover:text-primary transition-colors mb-1">Upload ACK/RESP FILES</span>
                                <span className="text-[8px] text-muted-foreground uppercase tracking-tighter opacity-60">Initialize Workspace</span>
                            </div>
                        </div>
                        )}
                    </div>

                    {/* SOURCE DETAIL BLOCK */}
                    <div className="px-5 py-4 border-b border-border bg-muted/5 group">
                        <div className="text-[9px] uppercase tracking-[0.2em] font-black text-primary/40 mb-3">System Metadata</div>
                        <div className="space-y-3">
                            {fileName && schema !== 'MRX' && schema !== 'INVALID' ? (
                                <>
                                    <div className="space-y-1">
                                        <div className="text-[9px] uppercase tracking-tighter text-muted-foreground opacity-60">Identifier</div>
                                        <div className="text-[11px] font-black truncate text-foreground leading-tight font-mono tracking-tight" title={fileName}>{fileName}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[9px] uppercase tracking-tighter text-muted-foreground opacity-60">Engine Schema</div>
                                        <div className="text-[9px] text-primary/90 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-primary animate-pulse" />
                                            {schema} Matrix v1.0
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="py-4 text-center border border-dashed border-border/30">
                                    <span className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest italic">Awaiting Data Ingestion</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ERROR LOG SIDEBAR */}
                    <div className="flex-1 flex flex-col min-h-0 bg-muted/5">
                        <div className="px-5 py-3 border-b border-border bg-background flex items-center justify-between shrink-0">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                <Activity className="w-3 h-3 text-primary" /> System Logs
                            </span>
                        </div>
                        <div className="flex-1 min-h-0 relative">
                            <SidebarErrorLog result={result} virtuosoRef={virtuosoRef} />
                        </div>
                    </div>
                </div>
            ) : null}

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="*"
                onChange={handleFileInput}
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
            />
        </aside>
    );
}

/** Memoized error log — avoids re-filtering invalidLines on unrelated sidebar re-renders */
const SidebarErrorLog = React.memo(function SidebarErrorLog({ result, virtuosoRef }: { result: ParseResult; virtuosoRef: React.RefObject<VirtuosoHandle | null> }) {
    const invalidLines = useMemo(() => result.lines.filter((l: ParsedLine) => l && !l.isValid), [result.lines]);
    const hasIntegrityBreach = result.validationErrors && result.validationErrors.length > 0;

    if (invalidLines.length === 0 && !hasIntegrityBreach) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center text-muted-foreground/30 gap-4">
                <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center">
                    <Check className="w-5 h-5 opacity-20" />
                </div>
                <span className="text-[9px] font-black tracking-[0.2em]">ALL PARAMS NOMINAL</span>
            </div>
        );
    }

    return (
        <Virtuoso
            style={{ height: '100%' }}
            totalCount={invalidLines.length + (hasIntegrityBreach ? 1 : 0)}
            overscan={10}
            itemContent={(index) => {
                if (hasIntegrityBreach && index === 0) {
                    return (
                        <div className="p-5 bg-rose-500/5 border-b border-rose-500/20">
                            <div className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                <ShieldAlert className="w-3.5 h-3.5" /> Integrity Breach
                            </div>
                            <div className="space-y-2">
                                {result.validationErrors?.map((err, i) => (
                                    <div key={i} className="text-[10px] font-bold text-rose-400/80 leading-tight flex gap-2">
                                        <span className="opacity-40">[{i+1}]</span>
                                        <span>{err}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                }

                const line = invalidLines[hasIntegrityBreach ? index - 1 : index];
                return (
                    <div
                        className="p-4 border-b border-border/30 hover:bg-rose-500/[0.03] transition-colors cursor-pointer group active:bg-rose-500/10"
                        onClick={() => {
                            virtuosoRef.current?.scrollToIndex({
                                index: line.lineNumber - 1,
                                align: 'start',
                            });
                        }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 tracking-widest">L-{line.lineNumber}</span>
                            <span className="text-[8px] font-black text-rose-400/50 uppercase tracking-widest group-hover:text-rose-400 transition-colors">Anomaly</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground/80 font-mono leading-relaxed">
                            {line.globalError || (
                                <span className="flex flex-col gap-1.5">
                                    {line.fields.filter((f: ParsedField) => !f.isValid).map((f: ParsedField, idx: number) => (
                                        <span key={idx} className="block text-rose-400/90 pl-3 border-l border-rose-500/30">
                                            <span className="text-[8px] opacity-40 uppercase mr-1">{f.def.name}:</span>
                                            {f.error}
                                        </span>
                                    ))}
                                </span>
                            )}
                        </div>
                    </div>
                );
            }}
        />
    );
});


