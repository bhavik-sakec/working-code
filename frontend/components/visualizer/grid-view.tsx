'use client';

import React, { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { RESP_DENIAL_CODES, ACK_DENIAL_CODES, SCHEMAS, ACK_STATUS, RESP_STATUS, LINE_TYPES, FIELD_NAMES } from '@/lib/constants';
import { ParseResult, ParsedLine, FieldDefinition, ParsedField } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../ui/select';

import { useStore } from '@/lib/store';
import { fetchSessionRows } from '@/lib/api';
import { HeaderVisualizer } from './header-visualizer';
import { Pagination } from './pagination';

interface GridViewProps {
    result: ParseResult;
    schema: 'ACK' | 'RESP' | 'MRX' | 'INVALID';
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    editingField: { lineIdx: number, fieldIdx: number, value: string } | null;
    setEditingField: (f: { lineIdx: number, fieldIdx: number, value: string } | null) => void;
    handleFieldUpdate: (originalLineIdx: number, fieldDef: FieldDefinition, newValue: string) => void;
    isFieldEditable?: (name: string) => boolean;
    isDropdownField?: (name: string) => boolean;
    headerLines?: ParsedLine[];
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
    }, [activeCol, activeCellRef]);

    const isRejected = line.fields.some(f =>
        (f.def.name === FIELD_NAMES.STATUS && f.value.trim() === ACK_STATUS.REJECTED) ||
        (f.def.name === FIELD_NAMES.MRX_CLAIM_STATUS && f.value.trim() === RESP_STATUS.DENIED)
    );

    const isPartial = line.fields.some(f =>
        f.def.name === FIELD_NAMES.MRX_CLAIM_STATUS && f.value.trim() === RESP_STATUS.PARTIAL
    );

    // Backend sets lengthError=true when line overflows or fields are missing/truncated
    const rowHasLengthError = line.fields.some(f => f.lengthError);
    // Any other backend-flagged invalidity (schema errors, expected value mismatches, etc.)
    const rowHasSchemaError = !line.isValid && !rowHasLengthError;

    return (
        <div className={cn(
            "flex items-stretch transition-colors border-b border-border/40",
            isSelected
                ? "bg-primary/10"
                : rowHasLengthError
                    // Structural length error — strongest red, always wins
                    ? "bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 border-l-4 border-l-rose-500"
                    : rowHasSchemaError
                        // Schema/value error — softer rose tint
                        ? "bg-rose-500/8 hover:bg-rose-500/15 border-rose-500/25 border-l-2 border-l-rose-400"
                        : isRejected
                            ? "bg-amber-400/15 hover:bg-amber-400/25 border-amber-400/30"
                            : isPartial
                                ? "bg-violet-400/15 hover:bg-violet-400/25 border-violet-400/30"
                                : "hover:bg-muted/30"
        )}>
            <div className={cn(
                "w-14 py-2 flex items-center justify-center px-4 text-[11px] font-medium border-r border-border/50 shrink-0 select-none",
                rowHasLengthError
                    ? "text-rose-400 font-black bg-rose-500/10"
                    : rowHasSchemaError
                        ? "text-rose-400 font-bold"
                        : "text-muted-foreground"
            )}
                title={
                    rowHasLengthError
                        ? 'This row has field length violations (line too long or too short)'
                        : rowHasSchemaError
                            ? `Schema error: ${line.globalError ?? 'one or more fields failed validation'}`
                            : undefined
                }
            >
                {index + 1}
                {(rowHasLengthError || rowHasSchemaError) && (
                    <span className="ml-1 text-rose-500 text-[9px] font-black leading-none">!</span>
                )}
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
                            <div
                                className={cn(
                                    "w-full h-7 flex items-center justify-center px-1.5 rounded-md border transition-all duration-200 text-center",
                                    isActive
                                        ? "bg-background border-primary/60 shadow-[inset_0_0_4px_rgba(var(--primary-rgb),0.1)]"
                                        : "bg-transparent border-transparent hover:bg-muted/10 hover:border-muted-foreground/20",
                                    !field.isValid && "border-destructive/50 bg-destructive/5 text-destructive",
                                    field.lengthError && "!border-rose-500/70 !bg-rose-500/10 !text-rose-400"
                                )}
                                title={field.lengthError
                                    ? (field.error ?? `Length error: expected ${field.def.length} chars`)
                                    : undefined
                                }
                            >
                                {canEdit ? (
                                    isSelect ? (
                                        <Select
                                            value={field.value.trim() || undefined}
                                            onValueChange={(val: string) => handleFieldUpdate(originalIndex, field.def, val)}
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
                                                {field.def.name === FIELD_NAMES.STATUS && schema === SCHEMAS.ACK && (
                                                    <>
                                                        <SelectItem value={ACK_STATUS.ACCEPTED}>{ACK_STATUS.ACCEPTED} (Accepted)</SelectItem>
                                                        <SelectItem value={ACK_STATUS.REJECTED}>{ACK_STATUS.REJECTED} (Rejected)</SelectItem>
                                                    </>
                                                )}
                                                {field.def.name === FIELD_NAMES.MRX_CLAIM_STATUS && schema === SCHEMAS.RESP && (
                                                    <>
                                                        <SelectItem value={RESP_STATUS.PAID}>{RESP_STATUS.PAID} (Paid)</SelectItem>
                                                        <SelectItem value={RESP_STATUS.DENIED}>{RESP_STATUS.DENIED} (Denied)</SelectItem>
                                                        <SelectItem value={RESP_STATUS.PARTIAL}>{RESP_STATUS.PARTIAL} (Partial)</SelectItem>
                                                    </>
                                                )}
                                                {field.def.name === FIELD_NAMES.REJECT_ID && schema === SCHEMAS.ACK && (
                                                    ACK_DENIAL_CODES.map(c => (
                                                        <SelectItem key={c.code} value={c.code} className="text-[10px]">
                                                            {c.code}: {c.short}
                                                        </SelectItem>
                                                    ))
                                                )}
                                                {field.def.name === FIELD_NAMES.DENIAL_CODE && schema === SCHEMAS.RESP && (
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
    isDropdownField,
    headerLines
}: GridViewProps) {
    const isSessionMode = useStore(s => s.isSessionMode);
    const sessionId = useStore(s => s.sessionId) || (window as { _activeSessionId?: string })._activeSessionId;
    const { currentPage, pageSize, setPage } = useStore();

    // Map dataRows while safely handling sparse arrays (holes) in session mode
    // Enforces pagination strictly for all modes (small and large files)
    const { pageData, totalDataCount } = useMemo(() => {
        const allLines = result.lines;
        const totalClaims = isSessionMode 
            ? (result.summary.totalClaims || result.summary.total || 0) 
            : allLines.filter(l => l?.type === LINE_TYPES.DATA).length;

        const start = (currentPage - 1) * pageSize;
        const end = Math.min(start + pageSize, totalClaims);
        const dataOnlyRows: { line: ParsedLine | undefined, originalIndex: number }[] = [];

        if (!isSessionMode) {
            // STREAMING MODE: Filter valid data lines then slice according to page
            const allData = allLines
                .map((l, idx) => ({ line: l, originalIndex: idx }))
                .filter(item => item.line?.type === LINE_TYPES.DATA);
            return { pageData: allData.slice(start, end), totalDataCount: allData.length };
        }

        // SESSION MODE: Use paginated logic with direct lookup for sparse array
        let skipOffset = 0;
        const firstLine = allLines[0];
        if (firstLine && firstLine.type === LINE_TYPES.HEADER) {
            skipOffset = 1;
        }
        
        for (let i = start; i < end; i++) {
            const absoluteFileIdx = i + skipOffset;
            const line = allLines[absoluteFileIdx];
            if (!line || line.type === LINE_TYPES.DATA) {
                dataOnlyRows.push({ line, originalIndex: absoluteFileIdx });
            }
        }

        return { pageData: dataOnlyRows, totalDataCount: totalClaims };
    }, [result.lines, result.summary.total, result.summary.totalClaims, isSessionMode, currentPage, pageSize]);

    const [activeCell, setActiveCellState] = useState<{ row: number, col: number } | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    
    const rowCount = pageData.length;

    // Initialize active cell when data first arrives or page changes
    useEffect(() => {
        if (!activeCell && rowCount > 0) {
            setActiveCellState({ row: 0, col: 0 });
        }
    }, [rowCount, activeCell, setActiveCellState]);


    // Reset scroll and active cell row when page changes
    useEffect(() => {
        if (virtuosoRef.current) {
            virtuosoRef.current.scrollToIndex(0);
        }
        setActiveCellState(prev => prev ? { ...prev, row: 0 } : null);
    }, [currentPage, virtuosoRef]);

    // Lazy loader for session mode
    const [loadingIndices, setLoadingIndices] = useState<Set<number>>(new Set());
    
    const loadMore = useCallback(async (startIndex: number) => {
        if (!isSessionMode || !sessionId || loadingIndices.has(startIndex)) return;
        
        setLoadingIndices(prev => new Set(prev).add(startIndex));
        try {
            // Fetch a chunk of rows based on pageSize
            const fetchCount = pageSize; 
            const newRows = await fetchSessionRows(sessionId, startIndex, fetchCount);
            const edits = useStore.getState().sessionEdits[sessionId] || {};
            
            // Merge into store and apply any pending edits
            const currentLines = [...useStore.getState().lines];
            newRows.forEach((r, i) => {
                const globalIdx = startIndex + i;
                currentLines[globalIdx] = edits[globalIdx] ? edits[globalIdx] : r;
            });
            useStore.getState().setResult({ lines: currentLines });

        } catch (e) {
            console.error('Lazy loading failed', e);
        } finally {
            setLoadingIndices(prev => {
                const n = new Set(prev);
                n.delete(startIndex);
                return n;
            });
        }
    }, [isSessionMode, sessionId, loadingIndices]);

    // Proactively load page data when page changes
    useEffect(() => {
        if (isSessionMode && sessionId) {
            const startIdx = (currentPage - 1) * pageSize;
            
            // Heuristic: adjust for the header at index 0
            const firstLine = result.lines[0];
            const fileStartIdx = (firstLine && firstLine.type === LINE_TYPES.HEADER) ? startIdx + 1 : startIdx;

            const hasInitialData = result.lines[fileStartIdx] !== undefined;
            if (!hasInitialData) {
                // If the data we expect for this page is missing, fetch rows starting from where the data should be
                loadMore(fileStartIdx);
            }
        }
    }, [currentPage, isSessionMode, sessionId, pageSize, result.lines, loadMore]);

    const setActiveCell = useCallback((cell: { row: number, col: number }) => {
        setActiveCellState(cell);
    }, []);

    const HeaderComponent = useMemo(() => {
        const firstDataLine = pageData[0]?.line || result.lines.find(l => l?.type === LINE_TYPES.DATA);
        const headerFields = firstDataLine?.fields || [];
        
        return function GridHeader() { 
            return (
                <div className="flex flex-col">
                    {headerLines && <HeaderVisualizer headerLines={headerLines} />}
                    <GridHeaderLine fields={headerFields} />
                </div>
            );
        };
    }, [pageData, result.lines, headerLines]);

    useEffect(() => {
        if (activeCell && virtuosoRef.current) {
            virtuosoRef.current.scrollIntoView({
                index: activeCell.row,
                behavior: 'auto',
                done: () => {}
            });
        }
    }, [activeCell, virtuosoRef]);

    // Stable refs for values used inside itemContent to avoid re-creating the callback
    const pageDataRef = useRef(pageData);
    pageDataRef.current = pageData;
    const editingFieldRef = useRef(editingField);
    editingFieldRef.current = editingField;
    const activeCellRef = useRef(activeCell);
    activeCellRef.current = activeCell;
    const selectedRowsRef = useRef(selectedRows);
    selectedRowsRef.current = selectedRows;

    // Stable key computation — allows Virtuoso to efficiently recycle DOM nodes
    const computeItemKey = useCallback((index: number) => {
        const item = pageDataRef.current[index];
        return item ? `loaded_${item.originalIndex}` : `missing_${index}`;
    }, []);

    // Stable itemContent callback — never changes reference, reads from refs
    const itemContent = useCallback((index: number) => {
        const item = pageDataRef.current[index];
        const ef = editingFieldRef.current;
        const ac = activeCellRef.current;
        const sr = selectedRowsRef.current;
        
        // If line is missing in session mode, show a clean blank space while loading/after end of data
        if (!item?.line) {
            return (
                <div key={`missing_${index}`} className="flex h-[37px] items-center border-b border-white/5 opacity-0" />
            );
        }

        return (
            <GridRow
                index={index + (currentPage - 1) * pageSize}
                originalIndex={item.originalIndex}
                line={item.line}
                schema={schema}
                editingCol={ef?.lineIdx === item.originalIndex ? ef.fieldIdx : null}
                editingValue={ef?.lineIdx === item.originalIndex ? ef.value : null}
                setEditingField={setEditingField}
                handleFieldUpdate={handleFieldUpdate}
                isFieldEditable={isFieldEditable}
                isDropdownField={isDropdownField}
                activeCol={ac?.row === index ? ac.col : null}
                setActiveCell={setActiveCell}
                isSelected={sr.has(index)}
            />
        );
    }, [schema, setEditingField, handleFieldUpdate, isFieldEditable, isDropdownField, setActiveCell, currentPage, pageSize]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (editingField) return;
        if (!activeCell) return;

        const { row, col } = activeCell;
        const item = pageData[row];
        if (!item) return;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (row > 0) setActiveCell({ row: row - 1, col });
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (row < pageData.length - 1) setActiveCell({ row: row + 1, col });
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (col > 0) setActiveCell({ row, col: col - 1 });
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (item.line && col < item.line.fields.length - 1) setActiveCell({ row, col: col + 1 });
                break;
            case 'Enter':
                const field = item.line?.fields[col];
                if (field && (field.def.editable || isFieldEditable?.(field.def.name))) {
                    e.preventDefault();
                    setEditingField({ lineIdx: item.originalIndex, fieldIdx: col, value: field.value });
                }
                break;
            case 'Escape':
                setSelectedRows(new Set());
                break;
            case 'PageDown':
                e.preventDefault();
                setPage(currentPage + 1);
                break;
            case 'PageUp':
                e.preventDefault();
                setPage(currentPage - 1);
                break;
        }
    }, [activeCell, pageData, editingField, isFieldEditable, setEditingField, setActiveCell, currentPage, setPage, isSessionMode]);

    // Stable Virtuoso components object — avoids object recreation on every render
    const virtuosoComponents = useMemo(() => ({
        Header: HeaderComponent,
        Scroller: GridScroller,
        List: GridList
    }), [HeaderComponent]);

    return (
        <div 
            className="flex-1 relative h-full w-full focus:outline-none bg-background"
            onKeyDown={handleKeyDown}
            tabIndex={0}
        >
            <div className="absolute inset-x-0 top-0 bottom-10">
                <Virtuoso
                    ref={virtuosoRef}
                    style={{ height: '100%' }}
                    totalCount={rowCount}
                    overscan={isSessionMode ? 10 : 5}
                    increaseViewportBy={500}
                    fixedItemHeight={37}
                    computeItemKey={computeItemKey}
                    components={{
                        ...virtuosoComponents,
                        Footer: () => null
                    }}
                    itemContent={itemContent}
                />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-10 border-t border-border bg-muted/5">
                {totalDataCount > 0 && (
                    <Pagination totalItems={totalDataCount} />
                )}
            </div>
        </div>
    );
}
