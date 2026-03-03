'use client';

import React, { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../ui/select';
import { RESP_DENIAL_CODES, ACK_DENIAL_CODES } from '@/lib/constants';
import { ParseResult, ParsedLine, FieldDefinition, ParsedField } from '@/lib/types';

interface GridViewProps {
    result: ParseResult;
    schema: 'ACK' | 'RESP' | 'MRX';
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    editingField: { lineIdx: number, fieldIdx: number, value: string } | null;
    setEditingField: (f: { lineIdx: number, fieldIdx: number, value: string } | null) => void;
    handleFieldUpdate: (originalLineIdx: number, fieldDef: FieldDefinition, newValue: string) => void;
    isFieldEditable?: (name: string) => boolean;
    isDropdownField?: (name: string) => boolean;
}

// Column width overrides for specific fields
const COLUMN_WIDTHS: Record<string, number> = {
    'Record Type': 80,
    'Patient ID': 120,
    'Member ID': 120,
    'Patient Name': 140,
    'Reject ID': 130,
    'Reject Reason': 380,
    'Denial Code': 110,
    'MRx Claim Line Number': 150,
    'Claim Line Number': 120,
};

const MIN_COLUMN_WIDTH = 90;
const CHAR_WIDTH = 8;
const COLUMN_PADDING = 24;

/** Calculate column width: use explicit override if available, otherwise derive from name length */
function getColumnWidth(fieldName: string): number {
    if (COLUMN_WIDTHS[fieldName]) return COLUMN_WIDTHS[fieldName];
    return Math.max(MIN_COLUMN_WIDTH, fieldName.length * CHAR_WIDTH + COLUMN_PADDING);
}

const GridHeaderLine = memo(({ fields }: { fields: ParsedField[] }) => {
    return (
        <div className="flex bg-muted/80 backdrop-blur-sm border-b border-border sticky top-0 z-20 min-w-max h-10">
            <div className="w-14 shrink-0 flex items-center justify-center px-4 border-r border-border/50">
                <div className="text-[11px] font-bold text-muted-foreground">#</div>
            </div>
            <div className="flex px-1 items-center h-full">
                {fields.map((field, idx) => (
                    <div
                        key={idx}
                        className="flex items-center justify-center px-2 text-[11px] font-bold text-foreground truncate text-center"
                        style={{
                            width: `${getColumnWidth(field.def.name)}px`,
                            minWidth: `${getColumnWidth(field.def.name)}px`
                        }}
                        title={field.def.name}
                    >
                        {field.def.name}
                    </div>
                ))}
            </div>
        </div>
    );
});
GridHeaderLine.displayName = 'GridHeaderLine';

const GridScroller = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Scroller({ style, ...props }, ref) {
    return <div {...props} ref={ref} style={{ ...style, overflow: 'auto' }} className="bg-background scrollbar-thin scrollbar-thumb-muted-foreground/20" />;
});

const GridList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function List({ style, children, ...props }, ref) {
    return (
        <div
            {...props}
            ref={ref}
            style={{ ...style, minWidth: 'max-content' }}
            className="focus:outline-none"
            tabIndex={0}
        >
            {children}
        </div>
    );
});

const GridRow = memo(({
    index,
    originalIndex,
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
    originalIndex: number,
    line: ParsedLine,
    schema: string,
    editingCol: number | null,
    editingValue: string | null,
    setEditingField: (f: { lineIdx: number, fieldIdx: number, value: string } | null) => void,
    handleFieldUpdate: (originalLineIdx: number, fieldDef: FieldDefinition, newValue: string) => void,
    isFieldEditable?: (name: string) => boolean,
    isDropdownField?: (name: string) => boolean,
    activeCol: number | null,
    setActiveCell: (cell: { row: number, col: number }) => void,
    isSelected: boolean
}) => {
    const activeCellRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeCol !== null && activeCellRef.current) {
            activeCellRef.current.scrollIntoView({
                behavior: 'auto',
                block: 'nearest',
                inline: 'nearest'
            });
        }
    }, [activeCol]);

    const isRejected = line.fields.some(f =>
        (f.def.name === 'Status' && f.value.trim() === 'R') ||
        (f.def.name === 'MRx Claim Status' && f.value.trim() === 'DY')
    );

    const isPartial = line.fields.some(f =>
        f.def.name === 'MRx Claim Status' && f.value.trim() === 'PA'
    );

    return (
        <div className={cn(
            "flex items-stretch transition-colors border-b border-border/40",
            isSelected
                ? "bg-primary/10"
                : isRejected
                    ? "bg-amber-400/15 hover:bg-amber-400/25 border-amber-400/30"
                    : isPartial
                        ? "bg-violet-400/15 hover:bg-violet-400/25 border-violet-400/30"
                        : "hover:bg-muted/30"
        )}>
            <div className="w-14 py-2 flex items-center justify-center px-4 text-[11px] text-muted-foreground font-medium border-r border-border/50 shrink-0 select-none">
                {index + 1}
            </div>

            <div className="flex px-1 py-1 gap-0 items-center">
                {line.fields.map((field, idx) => {
                    const isActive = activeCol === idx;
                    const canEdit = field.def.editable || isFieldEditable?.(field.def.name);
                    const isSelect = field.def.uiType === 'dropdown' || isDropdownField?.(field.def.name);

                    return (
                        <div
                            key={idx}
                            ref={isActive ? activeCellRef : null}
                            onClick={() => setActiveCell({ row: index, col: idx })}
                            className={cn(
                                "px-0.5 flex items-center group/cell overflow-hidden",
                                isActive && "z-10"
                            )}
                            style={{
                                width: `${getColumnWidth(field.def.name)}px`,
                                minWidth: `${getColumnWidth(field.def.name)}px`
                            }}
                        >
                            <div className={cn(
                                "w-full h-7 flex items-center justify-center px-1.5 rounded-md border transition-all duration-200 text-center",
                                isActive
                                    ? "bg-background border-primary/60 shadow-[inset_0_0_4px_rgba(var(--primary-rgb),0.1)]"
                                    : "bg-transparent border-transparent hover:bg-muted/10 hover:border-muted-foreground/20",
                                !field.isValid && "border-destructive/50 bg-destructive/5 text-destructive"
                            )}>
                                {canEdit ? (
                                    isSelect ? (
                                        <Select
                                            value={field.value.trim() || undefined}
                                            onValueChange={(val) => handleFieldUpdate(originalIndex, field.def, val)}
                                        >
                                            <SelectTrigger 
                                                className="w-full h-full border-0 bg-transparent p-0 flex items-center justify-center focus:ring-0 focus-visible:ring-0 focus-visible:border-0 focus:outline-none focus-visible:outline-none shadow-none text-[11px] font-semibold text-foreground [&_svg:last-child]:w-3.5 [&_svg:last-child]:h-3.5"
                                            >
                                                <div className="truncate pr-1 text-center">{field.value.trim() || '—'}</div>
                                            </SelectTrigger>
                                            <SelectContent 
                                                className="bg-popover border-border text-popover-foreground max-h-[300px] z-[9999]" 
                                                position="popper" 
                                                sideOffset={4}
                                                align="start"
                                            >
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
                                                            {c.code}: {c.short}
                                                        </SelectItem>
                                                    ))
                                                )}
                                                {field.def.name === 'Denial Code' && schema === 'RESP' && (
                                                    RESP_DENIAL_CODES.map(c => (
                                                        <SelectItem key={c.code} value={c.code} className="text-[10px]">
                                                            {c.code}: {c.short}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={editingCol === idx ? editingValue ?? '' : field.value}
                                            onChange={(e) => setEditingField({ lineIdx: originalIndex, fieldIdx: idx, value: e.target.value })}
                                            onBlur={() => {
                                                if (editingCol === idx) {
                                                    handleFieldUpdate(originalIndex, field.def, editingValue ?? '');
                                                    setEditingField(null);
                                                }
                                            }}
                                            onFocus={() => setActiveCell({ row: index, col: idx })}
                                            onKeyDown={(e) => { 
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    e.currentTarget.blur();
                                                }
                                            }}
                                            className="w-full h-full bg-transparent border-0 focus:outline-none text-foreground text-[11px] font-semibold text-center"
                                            spellCheck={false}
                                        />
                                    )
                                ) : (
                                    <div className="truncate text-muted-foreground font-medium text-[11px] text-center w-full" title={field.value.trim()}>{field.value}</div>
                                )}
                            </div>
                        </div>
                    );
                })}
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
    // Map dataRows to include originalIndex for correct state updates
    const dataRows = useMemo(() => result.lines
        .map((line, originalIndex) => ({ line, originalIndex }))
        .filter(item => item.line.type === 'Data'), [result.lines]);


    const [activeCell, setActiveCellState] = useState<{ row: number, col: number } | null>(() => {
        return dataRows.length > 0 ? { row: 0, col: 0 } : null;
    });
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

    const setActiveCell = useCallback((cell: { row: number, col: number }) => {
        setActiveCellState(cell);
    }, []);

    const firstDataLine = dataRows[0]?.line || result.lines.find(l => l.type === 'Data');
    const headerFields = firstDataLine?.fields || [];

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
        if (editingField) return;
        if (!activeCell) return;

        const { row, col } = activeCell;
        const item = dataRows[row];
        if (!item) return;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (row > 0) setActiveCell({ row: row - 1, col });
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (row < dataRows.length - 1) setActiveCell({ row: row + 1, col });
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (col > 0) setActiveCell({ row, col: col - 1 });
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (col < item.line.fields.length - 1) setActiveCell({ row, col: col + 1 });
                break;
            case 'Enter':
                const field = item.line.fields[col];
                if (field && (field.def.editable || isFieldEditable?.(field.def.name))) {
                    e.preventDefault();
                    setEditingField({ lineIdx: item.originalIndex, fieldIdx: col, value: field.value });
                }
                break;
            case 'Escape':
                setSelectedRows(new Set());
                break;
        }
    }, [activeCell, dataRows, editingField, isFieldEditable, setEditingField]);

    return (
        <div 
            className="flex-1 relative h-full w-full focus:outline-none bg-background"
            onKeyDown={handleKeyDown}
            tabIndex={0}
        >
            <div className="absolute inset-0">
                <Virtuoso
                    ref={virtuosoRef}
                    style={{ height: '100%' }}
                    totalCount={dataRows.length}
                    overscan={20}
                    increaseViewportBy={500}
                    components={{
                        Header: () => <GridHeaderLine fields={headerFields} />,
                        Scroller: GridScroller,
                        List: GridList
                    }}
                    itemContent={(index) => {
                        const item = dataRows[index];
                        return (
                            <GridRow
                                index={index}
                                originalIndex={item.originalIndex}
                                line={item.line}
                                schema={schema}
                                editingCol={editingField?.lineIdx === item.originalIndex ? editingField.fieldIdx : null}
                                editingValue={editingField?.lineIdx === item.originalIndex ? editingField.value : null}
                                setEditingField={setEditingField}
                                handleFieldUpdate={handleFieldUpdate}
                                isFieldEditable={isFieldEditable}
                                isDropdownField={isDropdownField}
                                activeCol={activeCell?.row === index ? activeCell.col : null}
                                setActiveCell={setActiveCell}
                                isSelected={selectedRows.has(index)}
                            />
                        );
                    }}
                />
            </div>
        </div>
    );
}
