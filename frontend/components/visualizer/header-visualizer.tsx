'use client';

import React from 'react';
import { ParsedLine } from '@/lib/types';
import { cn } from '@/lib/utils';


interface HeaderVisualizerProps {
    headerLines: ParsedLine[];
}

export function HeaderVisualizer({ headerLines }: HeaderVisualizerProps) {
    if (!headerLines || headerLines.length === 0) return null;

    return (
        <div className="flex flex-col bg-background/50 border-b border-border divide-y divide-border/30 relative z-20 shrink-0">
            {headerLines.map((line, lineIdx) => (
                <div key={lineIdx} className="h-10 flex items-center px-8 overflow-hidden group">
                    <div className="flex-1 flex items-center gap-6 overflow-x-auto no-scrollbar scroll-smooth">
                        {/* Record Type Identifier */}
                        <div className="flex items-center gap-2 shrink-0 pr-4 border-r border-border/20 mr-2">
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                line.isValid ? "bg-primary" : "bg-rose-500 animate-pulse"
                            )} />
                            <span className={cn(
                                "text-[8px] font-black uppercase tracking-widest italic",
                                line.isValid ? "text-primary/70" : "text-rose-500"
                            )}>
                                Header.{lineIdx + 1}
                            </span>
                        </div>

                        {/* Fields Map */}
                        {line.fields.map((field, i) => {
                            // Skip empty filler in this compact view
                            if (field.def.name === 'Filler' && field.value.trim() === '') return null;
                            
                            const hasError = !field.isValid || field.lengthError;

                            return (
                                <React.Fragment key={i}>
                                    <div className="flex items-center gap-2 shrink-0 group/field relative">
                                        <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-tighter">
                                            {field.def.name}
                                        </span>
                                        <span className={cn(
                                            "text-[10px] font-mono font-bold transition-colors",
                                            hasError ? "text-rose-500 underline decoration-rose-500/30 underline-offset-4" : "text-foreground/70 group-hover/field:text-primary"
                                        )}>
                                            {field.def.type === 'Numeric' ? field.value.replace(/^0+/, '') || '0' : (field.value || <span className="opacity-20">NULL</span>)}
                                        </span>
                                        
                                        {/* Error Tooltip on Hover */}
                                        {hasError && (
                                            <div className="absolute -bottom-8 left-0 opacity-0 group-hover/field:opacity-100 bg-rose-500 text-white text-[8px] font-black px-2 py-1 rounded shadow-xl pointer-events-none z-50 whitespace-nowrap uppercase tracking-tighter transition-opacity">
                                                {field.error || `Length: ${field.value.length}/${field.def.length}`}
                                            </div>
                                        )}
                                    </div>

                                    {/* Dot Separator */}
                                    {i < line.fields.length - 1 && (
                                        <div className="w-1 h-1 rounded-full bg-border/30 shrink-0" />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
