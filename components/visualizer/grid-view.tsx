'use client';

import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../ui/select';
import { RESP_DENIAL_CODES } from '../../lib/resp-schema';
import { ACK_DENIAL_CODES } from '../../lib/ack-schema';
import { Activity } from 'lucide-react';
import { ParseResult, ParsedLine, FieldDefinition, ParsedField } from '@/lib/types';

interface GridViewProps {
    result: ParseResult;
    schema: 'ACK' | 'RESP' | 'MRX';
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    editingField: { lineIdx: number, fieldIdx: number, value: string } | null;
    setEditingField: (f: { lineIdx: number, fieldIdx: number, value: string } | null) => void;
    handleFieldUpdate: (lineIdx: number, fieldDef: FieldDefinition, newValue: string) => void;
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
            className="px-4 space-y-1 focus:outline-none"
            tabIndex={0}
        >
            {children}
        </div>
    );
});

// Memoized Row Component
const GridRow = memo(({
    index,
    line,
    schema,
    editingCol,
    editingValue,
    setEditingField,
    handleFieldUpdate,
    isFieldEditable,
    isDropdownField,
    activeCol,
    setActiveCell,
    isSelected
}: {
    index: number,
    line: ParsedLine,
    schema: string,
    editingCol: number | null,
    editingValue: string | null,
    setEditingField: (f: { lineIdx: number, fieldIdx: number, value: string } | null) => void,
    handleFieldUpdate: (lineIdx: number, fieldDef: FieldDefinition, newValue: string) => void,
    isFieldEditable: (name: string) => boolean,
    isDropdownField: (name: string) => boolean,
    activeCol: number | null,
    setActiveCell: (cell: { row: number, col: number }) => void,
    isSelected: boolean
}) => {
    const activeCellRef = useRef<HTMLDivElement>(null);

    // Follow active cell (especially for horizontal scrolling)
    // PERFORMANCE: This effect now only runs for the active row
    useEffect(() => {
        if (activeCol !== null && activeCellRef.current) {
            activeCellRef.current.scrollIntoView({
                behavior: 'auto',
                block: 'nearest',
                inline: 'nearest'
            });
        }
    }, [activeCol]);

    return (
        <div className={cn(
            "flex items-start group min-h-0 transition-colors",
            isSelected && "bg-primary/10"
        )}>
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
                                    <span className="bg-rose-500 text-white font-bold animate-pulse">
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
                    line.fields.map((field: ParsedField, idx: number) => {
                        const isActive = activeCol === idx;
                        return (
                            <div
                                key={idx}
                                ref={isActive ? activeCellRef : null}
                                onClick={() => setActiveCell({ row: index, col: idx })}
                                className={cn(
                                    "h-7 flex items-center justify-center px-1 text-[10px] border transition-all cursor-crosshair whitespace-nowrap relative",
                                    line.type === 'Header' && "text-foreground",
                                    line.type === 'Data' && "text-zinc-600 dark:text-zinc-400",
                                    line.type === 'Trailer' && "text-purple-500",
                                    !field.isValid && "text-rose-500 bg-rose-500/10 border-rose-500/20 font-bold",
                                    isActive ? "border-primary ring-1 ring-primary z-10 bg-primary/5 shadow-[0_0_10px_rgba(var(--primary-rgb),0.2)]" : "border-transparent hover:border-border/30"
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
                                                        const rejectIdDef = lineFields.find((f: ParsedField) => f.def.name === 'Reject ID')?.def;
                                                        const rejectReasonDef = lineFields.find((f: ParsedField) => f.def.name === 'Reject Reason')?.def;
                                                        if (rejectIdDef) handleFieldUpdate(index, rejectIdDef, '');
                                                        if (rejectReasonDef) handleFieldUpdate(index, rejectReasonDef, '');
                                                    }
                                                }
                                                if (schema === 'ACK' && field.def.name === 'Reject ID') {
                                                    const selected = ACK_DENIAL_CODES.find(c => c.code === val);
                                                    if (selected) {
                                                        const reasonDef = line.fields.find((f: ParsedField) => f.def.name === 'Reject Reason')?.def;
                                                        if (reasonDef) handleFieldUpdate(index, reasonDef, selected.short);
                                                    }
                                                }
                                                if (schema === 'RESP' && field.def.name === 'MRx Claim Status') {
                                                    const lineFields = line.fields;
                                                    const apprField = lineFields.find((f: ParsedField) => f.def.name === 'Units approved');
                                                    const denyField = lineFields.find((f: ParsedField) => f.def.name === 'Units Denied');
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
                                            <SelectTrigger 
                                                className="w-full h-full border-0 bg-transparent p-0 text-center text-[10px] focus:ring-0 [&>svg]:hidden"
                                                aria-label={`${field.def.name}, row ${line.lineNumber}, column ${idx + 1}`}
                                            >
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
                                            value={editingCol === idx ? editingValue ?? '' : (field.def.name === 'Procedure Code' ? field.value.toUpperCase() : field.value)}
                                            onChange={(e) => {
                                                setEditingField({ lineIdx: index, fieldIdx: idx, value: e.target.value });
                                            }}
                                            onBlur={() => {
                                                if (editingCol === idx) {
                                                    handleFieldUpdate(index, field.def, editingValue ?? '');
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
                                            aria-label={`${field.def.name}, row ${line.lineNumber}, column ${idx + 1}`}
                                            aria-describedby={`field-constraint-${index}-${idx}`}
                                            role="textbox"
                                            aria-invalid={!field.isValid}
                                        />
                                    )
                                ) : (
                                    field.def.name === 'Procedure Code' ? field.value.toUpperCase() : field.value
                                )}
                                {/* Screen reader only: field constraints */}
                                <span id={`field-constraint-${index}-${idx}`} className="sr-only">
                                    Maximum {field.def.length} characters
                                </span>
                            </div>
                        );
                    })
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
    const [activeCell, setActiveCell] = useState<{ row: number, col: number } | null>(() => {
        return result.lines.length > 0 ? { row: 0, col: 0 } : null;
    });
    // Selected rows state
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

    // Auto-scroll when active row changes
    useEffect(() => {
        if (activeCell && virtuosoRef.current) {
            virtuosoRef.current.scrollIntoView({
                index: activeCell.row,
                behavior: 'auto',
                done: () => {}
            });
        }
    }, [activeCell, virtuosoRef]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Don't intercept global keys if editing a field (unless it's basic navigation we want to allow, but usually safer to block)
        if (editingField) return;

        if (!activeCell) {
            if (result.lines.length > 0) setActiveCell({ row: 0, col: 0 });
            return;
        }

        const { row, col } = activeCell;
        const line = result.lines[row];
        if (!line) return;

        if (e.shiftKey && e.code === 'Space') {
            e.preventDefault();
            setSelectedRows(prev => {
                const next = new Set(prev);
                if (next.has(row)) {
                    next.delete(row);
                } else {
                    next.add(row);
                }
                return next;
            });
            return;
        }

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (row > 0) setActiveCell({ row: row - 1, col });
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (row < result.lines.length - 1) setActiveCell({ row: row + 1, col });
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (col > 0) setActiveCell({ row, col: col - 1 });
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (col < line.fields.length - 1) setActiveCell({ row, col: col + 1 });
                break;
            case 'Enter':
                if (!editingField) {
                    const field = line.fields[col];
                    if (field && isFieldEditable(field.def.name)) {
                        e.preventDefault();
                        setEditingField({ lineIdx: row, fieldIdx: col, value: field.value });
                    }
                }
                break;
            case 'Escape':
                setSelectedRows(new Set());
                break;
        }
    }, [activeCell, result.lines, editingField, isFieldEditable, setEditingField]);

    // Focus treatment
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div 
            ref={containerRef}
            className="flex-1 relative h-full w-full focus:outline-none"
            onKeyDown={handleKeyDown}
            tabIndex={0}
        >
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
                            editingCol={editingField?.lineIdx === index ? editingField.fieldIdx : null}
                            editingValue={editingField?.lineIdx === index ? editingField.value : null}
                            setEditingField={setEditingField}
                            handleFieldUpdate={handleFieldUpdate}
                            isFieldEditable={isFieldEditable}
                            isDropdownField={isDropdownField}
                            activeCol={activeCell?.row === index ? activeCell.col : null}
                            setActiveCell={setActiveCell}
                            isSelected={selectedRows.has(index)}
                        />
                    )}
                />
            </div>
        </div>
    );
}
