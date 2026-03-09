'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';

interface PaginationProps {
    totalItems: number;
}

export function Pagination({ totalItems }: PaginationProps) {
    const { currentPage, pageSize, setPage } = useStore();
    
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    const goToPage = (page: number) => {
        if (page < 1 || page > totalPages) return;
        setPage(page);
    };

    if (totalItems <= 0) return null;

    return (
        <div className="flex items-center justify-between px-4 py-2 bg-background/50 border-t border-border/40 backdrop-blur-md">
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3 text-primary/50" />
                    <span>Displaying</span>
                    <span className="text-foreground/80 font-mono italic">
                        {startItem.toLocaleString()} - {endItem.toLocaleString()}
                    </span>
                    <span>of</span>
                    <span className="text-foreground font-mono">{totalItems.toLocaleString()}</span>
                    <span className="ml-2 px-1.5 py-0.5 bg-primary/10 rounded text-[8px] border border-primary/20 text-primary">
                        {pageSize} Per Page
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-1.5">
                <div className="flex items-center mr-4 pr-4 border-r border-border/20">
                    <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/40 mr-2">Jump to:</span>
                    <input 
                        type="number"
                        min={1}
                        max={totalPages}
                        value={currentPage}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) goToPage(val);
                        }}
                        className="w-12 h-6 bg-muted/20 border border-border/40 rounded text-[10px] font-black text-center focus:outline-none focus:border-primary/50 transition-colors"
                    />
                    <span className="ml-2 text-[10px] font-black uppercase tracking-tighter text-muted-foreground/40">/ {totalPages}</span>
                </div>

                <div className="flex items-center gap-1">
                    <PaginationButton 
                        onClick={() => goToPage(1)} 
                        disabled={currentPage === 1}
                        icon={ChevronsLeft}
                        title="First Page"
                    />
                    <PaginationButton 
                        onClick={() => goToPage(currentPage - 1)} 
                        disabled={currentPage === 1}
                        icon={ChevronLeft}
                        title="Previous"
                    />
                    
                    <div className="flex items-center px-4 h-7 bg-primary/5 border border-primary/20 rounded-md mx-1">
                        <span className="text-[11px] font-black text-primary italic uppercase tracking-widest">
                            PAGE {currentPage}
                        </span>
                    </div>

                    <PaginationButton 
                        onClick={() => goToPage(currentPage + 1)} 
                        disabled={currentPage === totalPages}
                        icon={ChevronRight}
                        title="Next"
                    />
                    <PaginationButton 
                        onClick={() => goToPage(totalPages)} 
                        disabled={currentPage === totalPages}
                        icon={ChevronsRight}
                        title="Last Page"
                    />
                </div>
            </div>
        </div>
    );
}

function PaginationButton({ 
    onClick, 
    disabled, 
    icon: Icon, 
    title 
}: { 
    onClick: () => void, 
    disabled: boolean, 
    icon: React.ElementType,
    title: string
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={cn(
                "w-7 h-7 rounded-md border transition-all duration-200",
                disabled 
                    ? "opacity-20 bg-muted/10 border-transparent text-muted-foreground cursor-not-allowed" 
                    : "bg-muted/10 border-border/40 text-muted-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
            )}
        >
            <Icon className="w-3.5 h-3.5" />
        </Button>
    );
}
