'use client';

import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { Virtuoso } from 'react-virtuoso';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RESP_DENIAL_CODES } from '../../lib/resp-schema';
import { ACK_DENIAL_CODES } from '../../lib/ack-schema';
import { Activity } from 'lucide-react';

interface GridViewProps {
    result: any;
    schema: 'ACK' | 'RESP' | 'MRX';
    virtuosoRef: React.RefObject<any>;
    editingField: { lineIdx: number, fieldIdx: number, value: string } | null;
    setEditingField: (f: any) => void;
    handleFieldUpdate: (lineIdx: number, fieldDef: any, newValue: string) => void;
    isFieldEditable: (name: string) => boolean;
    isDropdownField: (name: string) => boolean;
}

const GridHeader = memo(() => <div className="h-4" />);
GridHeader.displayName = 'GridHeader';

const GridScroller = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Scroller({ style, ...props }, ref) {
    return <div {...props} ref={ref} style={{ ...style, overflow: 'auto' }} />;
});

const GridList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function List({ style, children, ...props }, ref) {
    return (
        <div
            {...props}
            ref={ref}
            style={{ ...style, minWidth: 'max-content' }}
            className="px-4 space-y-1"
        >
            {children}
        </div>
    );
});

// Memoized Row Component to prevent re-renders of all rows when editing a single field
const GridRow = memo(({
    index,
    line,
    schema,
    editingField,
    setEditingField,
    handleFieldUpdate,
    isFieldEditable,
    isDropdownField,
    resultSummary
}: {
    index: number,
    line: any,
    schema: string,
    editingField: any,
    setEditingField: any,
    handleFieldUpdate: any,
    isFieldEditable: any,
    isDropdownField: any,
    resultSummary: any
}) => {
    return (
        <div className="flex items-start group min-h-0">
            <div className="w-12 py-1.5 px-3 text-right text-[10px] text-muted-foreground/30 font-mono shrink-0 select-none border-r border-border/10 bg-muted/5 group-hover:text-foreground/50 transition-colors">
                {line.lineNumber}
            </div>

            <div className={cn(
                "flex pl-2 py-1 transition-colors relative",
                !line.isValid && "bg-rose-500/5"
            )}>
                {!line.isValid && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-rose-500" />
                )}

                {line.type === 'Unknown' || !line.isValid ? (
                    <div className="flex flex-col py-2 px-1 gap-2 w-full">
                        <div className="flex items-center gap-2">
                            <div className="text-[10px] text-rose-500 font-bold uppercase tracking-tighter">!! {line.type === 'Unknown' ? 'SYSTEM_UNCOORDINATED' : 'DATA_ALIGNMENT_FAILURE'}</div>
                            {line.globalError && <span className="text-[9px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 font-mono">{line.globalError}</span>}
                        </div>

                        <div className="relative group/raw">
                            <div className="text-xs text-rose-500/70 font-mono whitespace-pre opacity-90 break-all border-l-2 border-rose-500 pl-2 bg-rose-500/5 py-2 overflow-x-auto scroller-hide">
                                {line.raw.slice(0, 220)}
                                {line.raw.length > 220 && (
                                    <span className="bg-rose-500 text-white font-bold animate-pulse" title="Overflow characters detected">
                                        {line.raw.slice(220)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {line.alignmentTips && (
                            <div className="space-y-1">
                                {line.alignmentTips.map((tip: string, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-[10px] text-emerald-400/80 font-mono bg-emerald-500/5 px-2 py-1 rounded-sm border border-emerald-500/10">
                                        <Activity className="w-3 h-3 shrink-0" />
                                        <span>DIAGNOSIS: {tip}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    line.fields.map((field: any, idx: number) => (
                        <Tooltip key={idx}>
                            <TooltipTrigger asChild>
                                <div
                                    className={cn(
                                        "h-7 flex items-center justify-center px-1 text-[10px] border border-transparent hover:border-border transition-all cursor-crosshair whitespace-nowrap",
                                        line.type === 'Header' && "text-foreground hover:bg-muted/10",
                                        line.type === 'Data' && "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/10",
                                        line.type === 'Trailer' && "text-purple-500 hover:bg-purple-500/10",
                                        !field.isValid && "text-rose-500 bg-rose-500/10 border-rose-500/20 font-bold",
                                    )}
                                    style={{
                                        width: `${Math.max(field.def.length * 12, 45)}px`,
                                        minWidth: `${Math.max(field.def.length * 12, 45)}px`
                                    }}
                                >
                                    {isFieldEditable(field.def.name) ? (
                                        isDropdownField(field.def.name) ? (
                                            <Select
                                                value={field.value.trim()}
                                                onValueChange={(val) => {
                                                    handleFieldUpdate(index, field.def, val);
                                                    if (schema === 'ACK' && field.def.name === 'Status') {
                                                        if (val === 'A') {
                                                            const lineFields = line.fields;
                                                            const rejectIdDef = lineFields.find((f: any) => f.def.name === 'Reject ID')?.def;
                                                            const rejectReasonDef = lineFields.find((f: any) => f.def.name === 'Reject Reason')?.def;
                                                            if (rejectIdDef) handleFieldUpdate(index, rejectIdDef, '');
                                                            if (rejectReasonDef) handleFieldUpdate(index, rejectReasonDef, '');
                                                        }
                                                    }
                                                    if (schema === 'ACK' && field.def.name === 'Reject ID') {
                                                        const selected = ACK_DENIAL_CODES.find(c => c.code === val);
                                                        if (selected) {
                                                            const reasonDef = line.fields.find((f: any) => f.def.name === 'Reject Reason')?.def;
                                                            if (reasonDef) handleFieldUpdate(index, reasonDef, selected.short);
                                                        }
                                                    }
                                                    if (schema === 'RESP' && field.def.name === 'MRx Claim Status') {
                                                        const lineFields = line.fields;
                                                        const apprField = lineFields.find((f: any) => f.def.name === 'Units approved');
                                                        const denyField = lineFields.find((f: any) => f.def.name === 'Units Denied');
                                                        if (val === 'DY') {
                                                            const currentAppr = apprField?.value.trim() || '0';
                                                            if (apprField) handleFieldUpdate(index, apprField.def, '0');
                                                            if (denyField) handleFieldUpdate(index, denyField.def, currentAppr === '0' ? '200' : currentAppr);
                                                        } else if (val === 'PA') {
                                                            let currentAppr = parseInt(apprField?.value.trim() || '200');
                                                            if (currentAppr < 3) {
                                                                currentAppr = 200;
                                                                if (apprField) handleFieldUpdate(index, apprField.def, '200');
                                                            }
                                                            const partialDeny = Math.max(2, Math.floor(currentAppr / 2));
                                                            if (denyField) handleFieldUpdate(index, denyField.def, partialDeny.toString());
                                                        } else if (val === 'PD') {
                                                            if (denyField) handleFieldUpdate(index, denyField.def, '0');
                                                        }
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="w-full h-full border-0 bg-transparent p-0 text-center text-[10px] focus:ring-0 [&>svg]:hidden">
                                                    <div className="w-full text-center truncate">{field.value}</div>
                                                </SelectTrigger>
                                                <SelectContent position="popper" sideOffset={4} className="bg-popover border-border text-popover-foreground max-h-[300px] z-[9999]">
                                                    {field.def.name === 'Status' && schema === 'ACK' && (
                                                        <>
                                                            <SelectItem value="A">A (Accepted)</SelectItem>
                                                            <SelectItem value="R">R (Rejected)</SelectItem>
                                                        </>
                                                    )}
                                                    {field.def.name === 'MRx Claim Status' && schema === 'RESP' && (
                                                        <>
                                                            <SelectItem value="PD">PD (Paid)</SelectItem>
                                                            <SelectItem value="DY">DY (Denied)</SelectItem>
                                                            <SelectItem value="PA">PA (Partial)</SelectItem>
                                                        </>
                                                    )}
                                                    {field.def.name === 'Reject ID' && schema === 'ACK' && (
                                                        ACK_DENIAL_CODES.map(c => (
                                                            <SelectItem key={c.code} value={c.code} className="text-[10px]">
                                                                {c.code}: {c.short.slice(0, 30)}...
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                    {field.def.name === 'Denial Code' && schema === 'RESP' && (
                                                        RESP_DENIAL_CODES.map(c => (
                                                            <SelectItem key={c.code} value={c.code} className="text-[10px]">
                                                                {c.code}: {c.short.slice(0, 30)}...
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <input
                                                type="text"
                                                value={editingField?.lineIdx === index && editingField?.fieldIdx === idx ? editingField.value : (field.def.name === 'Procedure Code' ? field.value.toUpperCase() : field.value)}
                                                onChange={(e) => {
                                                    setEditingField({ lineIdx: index, fieldIdx: idx, value: e.target.value });
                                                }}
                                                onBlur={() => {
                                                    if (editingField) {
                                                        handleFieldUpdate(editingField.lineIdx, field.def, editingField.value);
                                                        setEditingField(null);
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.currentTarget.blur();
                                                    }
                                                }}
                                                className="w-full h-full bg-transparent text-center focus:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                                spellCheck={false}
                                            />
                                        )
                                    ) : (
                                        field.def.name === 'Procedure Code' ? field.value.toUpperCase() : field.value
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="rounded-none border-border bg-popover px-3 py-2 text-popover-foreground shadow-xl">
                                <div className="space-y-2 font-mono">
                                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-1">Field Definition</div>
                                    <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 text-[11px]">
                                        <span className="text-muted-foreground">NAME</span> <span className="text-foreground font-bold">{field.def.name}</span>
                                        <span className="text-muted-foreground">VALUE</span> <span className="bg-primary/10 px-1 text-primary">{field.def.name === 'Procedure Code' ? field.value.toUpperCase() : field.value}</span>
                                        <span className="text-muted-foreground">RANGE</span> <span>{field.def.start} - {field.def.end} (L:{field.def.length})</span>
                                        <span className="text-muted-foreground">TYPE</span> <span>{field.def.type}</span>
                                        {field.def.expectedValue && (
                                            <>
                                                <span className="text-muted-foreground">EXPECTED</span> <span className="text-emerald-400">{field.def.expectedValue}</span>
                                            </>
                                        )}
                                        {!field.isValid && (
                                            <>
                                                <span className="text-rose-500">ERROR</span> <span className="text-rose-400 font-bold">{field.error}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    ))
                )}
            </div>
        </div>
    );
});
GridRow.displayName = 'GridRow';

export function GridView({
    result,
    schema,
    virtuosoRef,
    editingField,
    setEditingField,
    handleFieldUpdate,
    isFieldEditable,
    isDropdownField
}: GridViewProps) {
    return (
        <TooltipProvider delayDuration={0}>
            <div className="flex-1 relative h-full w-full">
                <div className="absolute inset-0">
                    <Virtuoso
                        ref={virtuosoRef}
                        style={{ height: '100%' }}
                        totalCount={result.lines.length}
                        overscan={20}
                        increaseViewportBy={300}
                        components={{
                            Header: GridHeader,
                            Scroller: GridScroller,
                            List: GridList
                        }}
                        itemContent={(index: number) => (
                            <GridRow
                                index={index}
                                line={result.lines[index]}
                                schema={schema}
                                editingField={editingField}
                                setEditingField={setEditingField}
                                handleFieldUpdate={handleFieldUpdate}
                                isFieldEditable={isFieldEditable}
                                isDropdownField={isDropdownField}
                                resultSummary={result.summary}
                            />
                        )}
                    />
                </div>
            </div>
        </TooltipProvider>
    );
}
