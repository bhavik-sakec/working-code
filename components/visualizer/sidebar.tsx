'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { FileText, Upload, AlertTriangle, Check, ChevronLeft, ChevronRight, X, Activity } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface VisualizerSidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (o: boolean) => void;
    content: string;
    schema: 'ACK' | 'RESP' | 'MRX';
    isDragging: boolean;
    handleDragOver: (e: React.DragEvent) => void;
    handleDragLeave: (e: React.DragEvent) => void;
    handleDrop: (e: React.DragEvent) => void;
    handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    clearContent: () => void;
    setSchema: (s: 'ACK' | 'RESP') => void;
    result: any;
    virtuosoRef: React.RefObject<any>;
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
    clearContent,
    setSchema,
    result,
    virtuosoRef
}: VisualizerSidebarProps) {
    return (
        <aside
            className={cn(
                "relative border-r border-border flex flex-col bg-muted/5 z-20 shrink-0 transition-all duration-300 ease-in-out",
                isSidebarOpen ? "w-80" : "w-0 border-r-0"
            )}
        >
            {/* Prominent Vertical Toggle Handle */}
            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={cn(
                    "absolute top-1/2 -translate-y-1/2 z-50 group flex items-center justify-center w-8 h-32 outline-none transition-all",
                    isSidebarOpen ? "-right-4" : "left-0"
                )}
                title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
                <div className="h-full w-[2px] bg-border group-hover:bg-primary transition-colors flex items-center justify-center relative">
                    <div className={cn(
                        "h-14 w-6 bg-background border-2 border-primary/20 rounded-md flex items-center justify-center shadow-lg transition-all text-primary group-hover:border-primary group-hover:scale-110",
                        !isSidebarOpen && "rounded-l-none border-l-0"
                    )}>
                        {isSidebarOpen ? <ChevronLeft className="size-4 stroke-[3px]" /> : <ChevronRight className="size-4 stroke-[3px]" />}
                    </div>
                </div>
            </button>

            {isSidebarOpen ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-border space-y-4 pt-6">
                        {/* PROTOCOL SWITCH TOGGLE */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground block">Protocol Engine</label>
                            <div className="grid grid-cols-2 p-1 bg-muted/30 border border-border rounded-lg relative overflow-hidden h-10">
                                <div
                                    className={cn(
                                        "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-primary/20 border border-primary/30 rounded-md transition-all duration-300 ease-out",
                                        schema === 'ACK' ? "left-1" : "left-[calc(50%+1px)]"
                                    )}
                                />
                                <button
                                    onClick={() => setSchema('ACK')}
                                    className={cn(
                                        "relative z-10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors",
                                        schema === 'ACK' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <FileText className="w-3 h-3" /> ACK
                                </button>
                                <button
                                    onClick={() => setSchema('RESP')}
                                    className={cn(
                                        "relative z-10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors",
                                        schema === 'RESP' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Activity className="w-3 h-3" /> RESP
                                </button>
                            </div>
                        </div>
                        {/* DROPZONE */}
                        <div
                            className={cn(
                                "relative h-48 border border-dashed border-border transition-all duration-300 flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden group hover:border-primary/50",
                                isDragging && "bg-primary/10 border-primary animate-pulse",
                                content ? "bg-muted/20" : "bg-transparent"
                            )}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {/* Background Grid Effect */}
                            <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:10px_10px]" />

                            {content ? (
                                <>
                                    <FileText className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                                    <div className="text-xs text-center">
                                        <span className="text-primary font-bold block mb-1">FILE LOCKED</span>
                                        <span className="text-muted-foreground text-[10px]">READY FOR ANALYSIS</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                    <div className="text-center">
                                        <span className="block font-bold text-xs group-hover:text-primary transition-colors">INITIATE UPLOAD</span>
                                        <span className="text-[10px] text-muted-foreground">DRAG OBJECT OR CLICK</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {content && (
                            <div className="mt-4 flex gap-2">
                                <button
                                    onClick={clearContent}
                                    className="flex-1 flex items-center justify-center gap-2 h-8 border border-destructive/50 text-destructive text-xs hover:bg-destructive/10 transition-colors uppercase tracking-wider"
                                >
                                    <X className="w-3 h-3" /> EJECT
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ERROR LOG SIDEBAR */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="p-3 border-b border-border bg-muted/20">
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <AlertTriangle className="w-3 h-3" /> System Logs
                            </span>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-0">
                                {result.lines.filter((l: any) => !l.isValid).length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground opacity-50 flex flex-col items-center gap-2">
                                        <Check className="w-6 h-6" />
                                        <span className="text-[10px]">NO ANOMALIES DETECTED</span>
                                    </div>
                                ) : (
                                    result.lines.filter((l: any) => !l.isValid).map((line: any, i: number) => (
                                        <div
                                            key={i}
                                            className="p-3 border-b border-border/50 hover:bg-red-500/10 transition-colors cursor-pointer group active:bg-red-500/20"
                                            onClick={() => {
                                                virtuosoRef.current?.scrollToIndex({
                                                    index: line.lineNumber - 1,
                                                    align: 'start',
                                                });
                                            }}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1 py-0.5">LINE {line.lineNumber}</span>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground font-mono leading-tight">
                                                {line.globalError || (
                                                    <span className="flex flex-col gap-1">
                                                        {line.fields.filter((f: any) => !f.isValid).map((f: any, idx: number) => (
                                                            <span key={idx} className="block text-red-400">
                                                                [{f.def.name}] {f.error}
                                                            </span>
                                                        ))}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            ) : null}

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".txt,.ack,.resp"
                onChange={handleFileInput}
            />
        </aside>
    );
}
