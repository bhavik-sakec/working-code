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
    <div className={cn("flex-1 flex flex-col justify-center px-4 border-r border-border min-w-[120px] transition-colors hover:bg-muted/30 group", borderClass)}>
        <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] tracking-widest uppercase text-muted-foreground font-mono font-bold group-hover:text-foreground transition-colors">{label}</span>
            <Icon className={cn("w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity", colorClass)} />
        </div>
        <div className={cn("text-2xl font-mono font-bold tracking-tighter", colorClass)}>
            {value}
        </div>
    </div>
);
