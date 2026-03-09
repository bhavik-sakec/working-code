'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface StatBoxProps {
    label: string;
    value: string;
    icon: React.ElementType;
    colorClass?: string;
    borderClass?: string;
}

export const StatBox = ({ label, value, icon: Icon, colorClass, borderClass }: StatBoxProps) => (
    <div className={cn(
        "relative flex-1 flex flex-col justify-center px-3 border-r border-border min-w-[100px] transition-all group overflow-hidden bg-background h-full",
        borderClass
    )}>
        {/* Subtle Background Grid/Pattern */}
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
        

        <div className="relative z-10 flex items-center gap-3">
            <div className={cn("shrink-0 p-1.5 rounded-lg bg-muted/20 group-hover:bg-muted/40 transition-colors", colorClass)}>
                <Icon className="w-3.5 h-3.5" />
            </div>
            <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[8px] tracking-[0.2em] uppercase text-muted-foreground font-black group-hover:text-foreground transition-colors leading-none truncate pr-2">
                        {label}
                    </span>
                </div>
                <div className={cn("text-lg font-black tracking-tighter font-mono tabular-nums leading-none", colorClass)}>
                    {value}
                </div>
            </div>
        </div>

        {/* Status Indicator Bar at bottom */}
        <div className={cn(
            "absolute bottom-0 left-0 h-[1.5px] w-0 group-hover:w-full transition-all duration-500 ease-out",
            colorClass ? colorClass.replace('text-', 'bg-') : "bg-primary"
        )} />
    </div>
);

