import { create } from 'zustand';
import { ParseResult, ParsedLine, FieldDefinition } from './types';
import {
    cancelSession,
    batchExecuteSession,
    batchExecuteSessionStream
} from './api';
import { normalizeSummary } from './utils';

import { SCHEMAS, LINE_TYPES, FIELD_NAMES, ACK_STATUS, RESP_STATUS, ACK_DENIAL_CODES, RESP_DENIAL_CODES } from './constants';

export interface ActiveFileEntry {
    id: string;
    name: string;
    schema: State['schema'];
    lines: ParsedLine[];
    summary: ParseResult['summary'];
    content: string;
    processedLines: number;
    sessionId?: string | null;
    isSessionMode: boolean;
    currentPage: number;
}

interface State {
    lines: ParsedLine[];
    content: string; // Keep full string for export, but could be refactored to lines if needed
    summary: ParseResult['summary'];
    schema: 'ACK' | 'RESP' | 'MRX' | 'INVALID';
    fileName: string | null;
    sessionId: string | null;
    errorLines: number[];
    isSessionMode: boolean;
    history: { lines: ParsedLine[]; content: string; summary: ParseResult['summary']; validationErrors: string[] }[];
    
    // UI State
    isLoading: boolean;
    activePhase: 'IDLE' | 'UPLOADING' | 'PROCESSING' | 'PARSING' | 'INDEXING';
    processProgress: number;
    processedLines: number;
    error: string | null;
    validationErrors: string[];
    sessionEdits: Record<string, Record<number, ParsedLine>>; // { sessionId: { lineIndex: editedLine } }
    
    // Multi-file support
    activeFiles: ActiveFileEntry[];
    activeFileId: string | null;

    // Actions
    setResult: (result: Partial<ParseResult>) => void;
    addRows: (newLines: ParsedLine[], rawChunk?: string) => void;
    setSchema: (schema: 'ACK' | 'RESP' | 'MRX') => void;
    setFileName: (name: string | null, forceSchema?: State['schema']) => void;
    setLoading: (loading: boolean) => void;
    setActivePhase: (phase: State['activePhase']) => void;
    setProcessProgress: (progress: number) => void;
    setProcessedLines: (count: number) => void;
    setError: (error: string | null) => void;
    setSession: (mode: boolean, id: string | null, errorLines?: number[]) => void;
    switchFile: (fileId: string) => void;
    closeFile: (fileId: string) => void;
    clearStore: () => void;
    
    updateField: (lineIdx: number, fieldDef: FieldDefinition, newValue: string) => void;
    undo: () => void;
    recordHistory: (lineIdx?: number) => void;
    lastEditedLineIdx: number | null;
    
    // Bulk actions
    applyBulkAction: (mode: 'DY' | 'PA' | 'R', config: { 
        pct: number; 
        cnt: number; 
        inputMode: 'PCT' | 'CNT'; 
        randomize: boolean; 
        denialCode: string;
    }) => Promise<{ applied: number; requested: number; eligible: number; }>;

    // Pagination
    currentPage: number;
    pageSize: number;
    setPage: (page: number) => void;
    setPageSize: (size: number) => void;
}

const emptySummary = { total: 0, totalClaims: 0, valid: 0, invalid: 0, accepted: 0, rejected: 0, partial: 0 };

export const useStore = create<State>((set, get) => ({
    lines: [],
    content: '',
    summary: { ...emptySummary },
    schema: SCHEMAS.ACK as 'ACK',
    fileName: null,
    history: [],
    
    isLoading: false,
    activePhase: 'IDLE',
    processProgress: 0,
    processedLines: 0,
    error: null,
    validationErrors: [],
    sessionId: null,
    errorLines: [],
    isSessionMode: false,
    activeFiles: [],
    activeFileId: null,
    sessionEdits: {},
    lastEditedLineIdx: null,

    currentPage: 1,
    pageSize: 200,

    setPage: (currentPage) => set({ currentPage }),
    setPageSize: (pageSize) => set({ pageSize, currentPage: 1 }),

    setResult: (result) => set((s) => {
        const nextSchema = (['ACK', 'RESP', 'MRX', 'INVALID'].includes(result.detectedSchema as string)
            ? (result.detectedSchema as 'ACK' | 'RESP' | 'MRX' | 'INVALID')
            : s.schema);
        
        const lines = result.lines ?? s.lines;
        const summary = result.summary ? { ...s.summary, ...result.summary } : s.summary;

        // Sync with activeFiles entry to avoid data loss on switch
        const updatedFiles = s.activeFiles.map(f => 
            f.id === s.activeFileId ? { 
                ...f, 
                schema: nextSchema as State['schema'],
                lines,
                summary,
                processedLines: result.lines ? (s.processedLines + result.lines.length) : s.processedLines,
                content: result.rawContent ?? f.content,
                currentPage: s.currentPage
            } : f
        );

        return {
            lines,
            content: result.rawContent ?? s.content,
            summary,
            schema: nextSchema as State['schema'],
            validationErrors: result.validationErrors ?? s.validationErrors,
            activeFiles: updatedFiles
        };
    }),

    addRows: (newLines, rawChunk) => set((s) => {
        // Reconstruct raw content for each line if missing (needed for Export and edits)
        const processedBatch = newLines.map(line => {
            if (line.raw) return line;
            
            const fields = line.fields;
            if (!fields || fields.length === 0) return { ...line, raw: "" };
            
            const maxEnd = Math.max(...fields.map(f => f.def.end));
            let lineStr = " ".repeat(maxEnd);
            
            fields.forEach(f => {
                const def = f.def;
                let val = f.value || "";
                // Apply protocol-specific padding
                if (def.type === 'Numeric') {
                    val = val.padStart(def.length, '0');
                } else {
                    val = val.padEnd(def.length, ' ');
                }
                val = val.slice(0, def.length); // Safety truncate
                
                // Inject into fixed position
                lineStr = lineStr.substring(0, def.start - 1) + val + lineStr.substring(def.end);
            });
            return { ...line, raw: lineStr };
        });

        const MAX_DISPLAY_LINES = 100_000;
        const currentCount = s.lines.length;
        const remaining = Math.max(0, MAX_DISPLAY_LINES - currentCount);
        const linesToAdd = remaining > 0 ? processedBatch.slice(0, remaining) : [];

        const lines = currentCount < MAX_DISPLAY_LINES
            ? [...s.lines, ...linesToAdd]
            : s.lines;

        let chunkText = rawChunk;
        if (chunkText === undefined || chunkText === null) {
            // Reconstruct the full chunk text for the global content state
            chunkText = processedBatch.map(l => l.raw).join('\n') + (processedBatch.length > 0 ? '\n' : '');
        }

        const content = s.content + chunkText;

        const newSummary = { ...s.summary };
        newSummary.total += newLines.length;

        newLines.forEach(l => {
            if (l.type === LINE_TYPES.DATA) {
                newSummary.totalClaims++;
                const status = l.fields.find(f => f.def.name === FIELD_NAMES.STATUS || f.def.name === FIELD_NAMES.MRX_CLAIM_STATUS)?.value.trim();
                if (s.schema === SCHEMAS.RESP) {
                    if (status === RESP_STATUS.PAID) newSummary.accepted++;
                    else if (status === RESP_STATUS.PARTIAL) newSummary.partial++;
                    else if (status === RESP_STATUS.DENIED) newSummary.rejected++;
                } else if (s.schema === SCHEMAS.ACK) {
                    if (status === ACK_STATUS.ACCEPTED) newSummary.accepted++;
                    else if (status === ACK_STATUS.REJECTED) newSummary.rejected++;
                }
            }
            if (!l.isValid) newSummary.invalid++;
        });

        const updatedFiles = s.activeFiles.map(f => 
            f.id === s.activeFileId ? { ...f, lines, summary: newSummary, content, currentPage: s.currentPage } : f
        );

        return { lines, content, summary: newSummary, activeFiles: updatedFiles };
    }),

    setSchema: (schema) => set((s) => ({ 
        schema,
        activeFiles: s.activeFiles.map(f => f.id === s.activeFileId ? { ...f, schema } : f)
    })),
    setLoading: (isLoading) => set({ isLoading }),
    setActivePhase: (activePhase) => set({ activePhase }),
    setProcessProgress: (processProgress) => set({ processProgress }),
    setProcessedLines: (processedLines) => set({ processedLines }),
    setError: (error) => set({ error }),
    setSession: (isSessionMode, sessionId, errorLines = []) => set((s) => {
        const updatedFiles = s.activeFiles.map(f => 
            f.id === s.activeFileId ? { ...f, isSessionMode, sessionId } : f
        );
        return { isSessionMode, sessionId, errorLines, activeFiles: updatedFiles };
    }),

    switchFile: (fileId) => set((s) => {
        if (s.activeFileId === fileId) return s;
        
        const updatedFiles = s.activeFiles.map(f => 
            f.id === s.activeFileId ? { 
                ...f, 
                lines: s.lines, 
                summary: s.summary,
                processedLines: s.processedLines,
                schema: s.schema,
                content: s.content,
                currentPage: s.currentPage
            } : f
        );

        const targetFile = updatedFiles.find(f => f.id === fileId);
        if (!targetFile) return { activeFiles: updatedFiles };

        return {
            activeFileId: fileId,
            lines: targetFile.lines,
            summary: targetFile.summary,
            schema: targetFile.schema,
            fileName: targetFile.name,
            sessionId: targetFile.sessionId,
            isSessionMode: targetFile.isSessionMode,
            processedLines: targetFile.processedLines,
            content: targetFile.content,
            currentPage: targetFile.currentPage || 1,
            activeFiles: updatedFiles,
            error: null,
            validationErrors: [],
            history: [],
            lastEditedLineIdx: null // Reset on switch
        };
    }),

    closeFile: (fileId) => {
        const s = get();
        const fileToClose = s.activeFiles.find(f => f.id === fileId);
        if (fileToClose?.sessionId) {
            cancelSession(fileToClose.sessionId);
        }

        set((s) => {
            const remaining = s.activeFiles.filter(f => f.id !== fileId);
            if (remaining.length === 0) {
                return {
                    activeFiles: [],
                    activeFileId: null,
                    lines: [],
                    content: '',
                    summary: { ...emptySummary },
                    fileName: null,
                    sessionId: null,
                    isSessionMode: false,
                    history: [],
                    activePhase: 'IDLE'
                };
            }
            
            if (s.activeFileId === fileId) {
                const next = remaining[0];
                return {
                    activeFiles: remaining,
                    activeFileId: next.id,
                    lines: next.lines,
                    summary: next.summary,
                    schema: next.schema,
                    fileName: next.name,
                    sessionId: next.sessionId,
                    isSessionMode: next.isSessionMode,
                    processedLines: next.processedLines,
                    content: next.content,
                    currentPage: next.currentPage || 1,
                    history: [],
                    activePhase: next.sessionId ? 'INDEXING' : 'IDLE' // Update phase for focus
                };
            }
            
            return { activeFiles: remaining };
        });
    },

    setFileName: (name, forceSchema) => set((s) => {
        if (!name) return { fileName: null };
        
        const exists = s.activeFiles.find(f => f.name === name);
        if (exists) {
            // If it exists, switch focus to it
            return { 
                fileName: name, 
                activeFileId: exists.id,
                lines: exists.lines,
                summary: exists.summary,
                schema: exists.schema,
                processedLines: exists.processedLines,
                content: exists.content,
                currentPage: exists.currentPage || 1,
                history: [] 
            };
        }

        // Use forceSchema if provided, otherwise guess from extension
        const resolvedSchema: State['schema'] = forceSchema ?? (name.toLowerCase().endsWith('.mrx') ? 'MRX' : 'INVALID');
        const isMrx = resolvedSchema === 'MRX';
        const matrixFiles = s.activeFiles.filter(f => f.schema !== 'MRX' && f.schema !== 'INVALID');
        const forgeFiles = s.activeFiles.filter(f => f.schema === 'MRX');

        // Enforce specific slot limits: 2 for Data Matrix, 1 for MRX Forge
        if (isMrx && forgeFiles.length >= 1) return s;
        if (!isMrx && matrixFiles.length >= 2) return s;
        if (s.activeFiles.length >= 3) return s;

        const id = Math.random().toString(36).substring(7);
        const newFile: ActiveFileEntry = {
            id,
            name,
            schema: resolvedSchema,
            lines: [],
            summary: { ...emptySummary },
            content: '',
            processedLines: 0,
            sessionId: null,
            isSessionMode: false,
            currentPage: 1
        };

        return {
            fileName: name,
            activeFileId: id,
            activeFiles: [...s.activeFiles, newFile],
            lines: [],
            content: '',
            summary: { ...emptySummary },
            processedLines: 0,
            sessionId: null,
            isSessionMode: false,
            schema: newFile.schema,
            currentPage: 1,
            error: null,
            validationErrors: [],
            history: []
        };
    }),

    clearStore: () => set({
        lines: [],
        content: '',
        summary: { ...emptySummary },
        fileName: null,
        history: [],
        error: null,
        activePhase: 'IDLE',
        processProgress: 0,
        processedLines: 0,
        sessionId: null,
        errorLines: [],
        isSessionMode: false,
        activeFiles: [],
        activeFileId: null,
        currentPage: 1
    }),

    recordHistory: (lineIdx) => set((s) => {
        // If we're editing the same line as the last recorded state, skip recording
        // to allow "batch undo" for a single line's edits.
        if (lineIdx !== undefined && s.lastEditedLineIdx === lineIdx) {
            return s;
        }

        return {
            lastEditedLineIdx: lineIdx ?? null,
            history: [{ 
                lines: [...s.lines], 
                content: s.content, 
                summary: { ...s.summary },
                validationErrors: [...s.validationErrors]
            }, ...s.history].slice(0, 50)
        };
    }),

    undo: () => set((s) => {
        if (s.history.length === 0) return s;
        const [lastState, ...remaining] = s.history;
        const newState = {
            lines: lastState.lines,
            content: lastState.content,
            summary: lastState.summary,
            validationErrors: lastState.validationErrors,
            history: remaining,
            lastEditedLineIdx: null // Reset after undo
        };
        return {
            ...newState,
            activeFiles: s.activeFiles.map(f => 
                f.id === s.activeFileId ? { 
                    ...f, 
                    lines: lastState.lines, 
                    summary: lastState.summary,
                    content: lastState.content
                } : f
            )
        };
    }),

    updateField: (lineIdx, fieldDef, newValue) => set((s) => {
        let line = s.lines.find(l => l.lineNumber === lineIdx + 1);
        if (!line && !s.isSessionMode) line = s.lines[lineIdx];
        if (!line) return s;

        const fields = [...line.fields];
        const statusFieldIdx = fields.findIndex(f => f.def.name === fieldDef.name);
        if (statusFieldIdx === -1) return s;

        // 1. Update the target field first
        const def = fields[statusFieldIdx].def;
        let padded = def.type === 'Numeric' ? newValue.padStart(def.length, '0') : newValue.padEnd(def.length, ' ');
        padded = padded.slice(0, def.length);
        fields[statusFieldIdx] = { ...fields[statusFieldIdx], value: padded };

        const updateInArray = (fieldName: string, val: string) => {
            const idx = fields.findIndex(f => f.def.name === fieldName);
            if (idx === -1) return;
            const fDef = fields[idx].def;
            let p = fDef.type === 'Numeric' ? val.padStart(fDef.length, '0') : val.padEnd(fDef.length, ' ');
            p = p.slice(0, fDef.length);
            fields[idx] = { ...fields[idx], value: p };
        };

        // 2. Apply Dependent Logic (REJECT / DENY / PARTIAL)

        // ACK Validation Handlers
        if (s.schema === SCHEMAS.ACK) {
            if (fieldDef.name === FIELD_NAMES.REJECT_ID) {
                const code = ACK_DENIAL_CODES.find(c => c.code === newValue.trim());
                if (code) updateInArray(FIELD_NAMES.REJECT_REASON, code.short);
            }

            if (fieldDef.name === FIELD_NAMES.STATUS) {
                if (newValue === ACK_STATUS.REJECTED) {
                    const currentCode = fields.find(f => f.def.name === FIELD_NAMES.REJECT_ID)?.value.trim();
                    if (!currentCode || currentCode === "") {
                        const first = ACK_DENIAL_CODES[0];
                        updateInArray(FIELD_NAMES.REJECT_ID, first.code);
                        updateInArray(FIELD_NAMES.REJECT_REASON, first.short);
                    }
                } else if (newValue === ACK_STATUS.ACCEPTED) {
                    updateInArray(FIELD_NAMES.REJECT_ID, "");
                    updateInArray(FIELD_NAMES.REJECT_REASON, "");
                }
            }
        }

        // RESP Validation Handlers
        if (s.schema === SCHEMAS.RESP) {
            if (fieldDef.name === FIELD_NAMES.MRX_CLAIM_STATUS) {
                const apprVal = fields.find(f => f.def.name === FIELD_NAMES.UNITS_APPROVED)?.value.trim() || '0';
                const denyVal = fields.find(f => f.def.name === FIELD_NAMES.UNITS_DENIED)?.value.trim() || '0';
                const total = (parseInt(apprVal) || 0) + (parseInt(denyVal) || 0);

                if (newValue === RESP_STATUS.DENIED) {
                    updateInArray(FIELD_NAMES.UNITS_APPROVED, '0');
                    updateInArray(FIELD_NAMES.UNITS_DENIED, total.toString());
                    const currentCode = fields.find(f => f.def.name === FIELD_NAMES.DENIAL_CODE)?.value.trim();
                    if (!currentCode || currentCode === "") {
                        updateInArray(FIELD_NAMES.DENIAL_CODE, RESP_DENIAL_CODES[0].code);
                    }
                } else if (newValue === RESP_STATUS.PAID) {
                    updateInArray(FIELD_NAMES.UNITS_APPROVED, total.toString());
                    updateInArray(FIELD_NAMES.UNITS_DENIED, '0');
                    updateInArray(FIELD_NAMES.DENIAL_CODE, "");
                } else if (newValue === RESP_STATUS.PARTIAL && total >= 2) {
                    const maxDeny = Math.floor((total - 1) / 2);
                    const newDeny = Math.floor(Math.random() * maxDeny) + 1;
                    const newAppr = total - newDeny;
                    updateInArray(FIELD_NAMES.UNITS_APPROVED, newAppr.toString());
                    updateInArray(FIELD_NAMES.UNITS_DENIED, newDeny.toString());
                    const currentCode = fields.find(f => f.def.name === FIELD_NAMES.DENIAL_CODE)?.value.trim();
                    if (!currentCode || currentCode === "") {
                        updateInArray(FIELD_NAMES.DENIAL_CODE, RESP_DENIAL_CODES[0].code);
                    }
                }
            } else if (fieldDef.name === FIELD_NAMES.UNITS_APPROVED || fieldDef.name === FIELD_NAMES.UNITS_DENIED) {
                // If user manually edits approved/denied units, auto-calculate the Status
                const apprVal = fields.find(f => f.def.name === FIELD_NAMES.UNITS_APPROVED)?.value.trim() || '0';
                const denyVal = fields.find(f => f.def.name === FIELD_NAMES.UNITS_DENIED)?.value.trim() || '0';
                const appr = parseInt(apprVal) || 0;
                const deny = parseInt(denyVal) || 0;
                
                if (deny > 0 && appr === 0) {
                    updateInArray(FIELD_NAMES.MRX_CLAIM_STATUS, RESP_STATUS.DENIED);
                    const currentCode = fields.find(f => f.def.name === FIELD_NAMES.DENIAL_CODE)?.value.trim();
                    if (!currentCode || currentCode === "") {
                        updateInArray(FIELD_NAMES.DENIAL_CODE, RESP_DENIAL_CODES[0].code);
                    }
                } else if (deny === 0 && appr > 0) {
                    updateInArray(FIELD_NAMES.MRX_CLAIM_STATUS, RESP_STATUS.PAID);
                    updateInArray(FIELD_NAMES.DENIAL_CODE, "");
                } else if (deny > 0 && appr > 0) {
                    updateInArray(FIELD_NAMES.MRX_CLAIM_STATUS, RESP_STATUS.PARTIAL);
                    const currentCode = fields.find(f => f.def.name === FIELD_NAMES.DENIAL_CODE)?.value.trim();
                    if (!currentCode || currentCode === "") {
                        updateInArray(FIELD_NAMES.DENIAL_CODE, RESP_DENIAL_CODES[0].code);
                    }
                }
            }
        }

        const updatedLine = { ...line, fields };

        // 4. Incremental summary update
        const oldStatus = line.fields.find(f => f.def.name === FIELD_NAMES.STATUS || f.def.name === FIELD_NAMES.MRX_CLAIM_STATUS)?.value.trim();
        const newStatus = fields.find(f => f.def.name === FIELD_NAMES.STATUS || f.def.name === FIELD_NAMES.MRX_CLAIM_STATUS)?.value.trim();
        const summary = { ...s.summary };

        if (oldStatus !== newStatus && line.type === LINE_TYPES.DATA) {
            if (s.schema === SCHEMAS.RESP) {
                if (oldStatus === RESP_STATUS.PAID) summary.accepted--;
                else if (oldStatus === RESP_STATUS.PARTIAL) summary.partial--;
                else if (oldStatus === RESP_STATUS.DENIED) summary.rejected--;
                
                if (newStatus === RESP_STATUS.PAID) summary.accepted++;
                else if (newStatus === RESP_STATUS.PARTIAL) summary.partial++;
                else if (newStatus === RESP_STATUS.DENIED) summary.rejected++;
            } else {
                if (oldStatus === ACK_STATUS.ACCEPTED) summary.accepted--;
                else if (oldStatus === ACK_STATUS.REJECTED) summary.rejected--;
                
                if (newStatus === ACK_STATUS.ACCEPTED) summary.accepted++;
                else if (newStatus === ACK_STATUS.REJECTED) summary.rejected++;
            }
        }

        // 5. Sync content (raw text line)
        const contentLines = s.content.split('\n');
        let lineStr = contentLines[lineIdx];
        if (lineStr) {
            fields.forEach(f => {
                let p = f.def.type === 'Numeric' ? f.value.padStart(f.def.length, '0') : f.value.padEnd(f.def.length, ' ');
                p = p.slice(0, f.def.length);
                lineStr = lineStr.substring(0, f.def.start - 1) + p + lineStr.substring(f.def.end);
            });
            contentLines[lineIdx] = lineStr;
        }

        if (s.isSessionMode && s.sessionId) {
            return {
                sessionEdits: {
                    ...s.sessionEdits,
                    [s.sessionId]: { ...(s.sessionEdits[s.sessionId] || {}), [lineIdx]: updatedLine }
                },
                lines: s.lines.map(l => l.lineNumber === line.lineNumber ? updatedLine : l),
                content: contentLines.join('\n'),
                summary
            };
        }

        const newAllLines = [...s.lines];
        newAllLines[lineIdx] = updatedLine;

        const updatedFiles = s.activeFiles.map(f => 
            f.id === s.activeFileId ? { ...f, lines: newAllLines, content: contentLines.join('\n'), summary } : f
        );

        return { 
            lines: newAllLines, 
            content: contentLines.join('\n'),
            activeFiles: updatedFiles,
            summary
        };
    }),


    /**
     * applyBulkAction: apply status changes randomly to a percentage or count of claims.
     * ⚡ SESSION COMPATIBLE: If in session mode, offloads to high-performance random-access backend.
     */
    applyBulkAction: async (mode, config) => {
        const s = get();
        const { pct, cnt, inputMode, randomize, denialCode } = config;

        // --- SESSION MODE (Large Files) ---
        if (s.isSessionMode && s.sessionId) {
            try {
                const apiConfig = {
                    mode: mode as 'DY' | 'PA' | 'R',
                    pct: Number(pct) || 0,
                    count: inputMode === 'CNT' ? (Number(cnt) || 0) : 0,
                    randomizeCodes: randomize,
                    denialCode: denialCode
                };

                let finalApplied = 0;
                let finalEligible = 0;
                let finalSummary = s.summary;

                await batchExecuteSessionStream(s.sessionId, apiConfig, (update) => {
                    if (update.type === 'row_update' && update.row && typeof update.index === 'number') {
                        set((st) => {
                            const newLines = [...st.lines];
                            newLines[update.index!] = update.row!;
                            return {
                                lines: newLines,
                                activeFiles: st.activeFiles.map(f => 
                                    f.id === st.activeFileId ? { ...f, lines: newLines } : f
                                )
                            };
                        });
                    } else if (update.type === 'complete') {
                        finalApplied = update.applied || 0;
                        finalEligible = update.eligible || 0;
                        if (update.summary) {
                            finalSummary = normalizeSummary(update.summary);
                            set((st) => ({
                                summary: finalSummary,
                                activeFiles: st.activeFiles.map(f => 
                                    f.id === st.activeFileId ? { ...f, summary: finalSummary } : f
                                )
                            }));
                        }
                    }
                });

                return { 
                    applied: finalApplied, 
                    requested: apiConfig.count || Math.max(1, Math.round((apiConfig.pct / 100) * finalEligible)), 
                    eligible: finalEligible 
                };
            } catch (err) {
                let message = 'Unknown error';
                if (err instanceof Error) message = err.message;
                if (typeof window !== 'undefined' && (window as any).toast) {
                    (window as any).toast.error('Batch Action Error', { description: message, duration: 5000 });
                }
                return { applied: 0, requested: 0, eligible: 0 };
            }
        }


        // --- LOCAL MODE (Small Files) ---
        const eligibleIdxs: number[] = [];
        s.lines.forEach((line, idx) => {
            if (line.type !== LINE_TYPES.DATA) return;
            const fields = line.fields;
            if (s.schema === SCHEMAS.RESP) {
                const appr = parseInt(fields.find(f => f.def.name === FIELD_NAMES.UNITS_APPROVED)?.value.trim() || '0') || 0;
                const deny = parseInt(fields.find(f => f.def.name === FIELD_NAMES.UNITS_DENIED)?.value.trim() || '0') || 0;
                const total = appr + deny;
                const currentStatus = fields.find(f => f.def.name === FIELD_NAMES.MRX_CLAIM_STATUS)?.value.trim() || '';

                if (mode === RESP_STATUS.PARTIAL) {
                    if (total >= 2 && currentStatus !== RESP_STATUS.PARTIAL) eligibleIdxs.push(idx); 
                } else if (mode === RESP_STATUS.DENIED) {
                    if (currentStatus !== RESP_STATUS.DENIED) eligibleIdxs.push(idx);
                } else {
                    eligibleIdxs.push(idx);
                }
            } else {
                const currentStatus = fields.find(f => f.def.name === FIELD_NAMES.STATUS)?.value.trim() || '';
                if (mode === ACK_STATUS.REJECTED) {
                    if (currentStatus !== ACK_STATUS.REJECTED) eligibleIdxs.push(idx);
                } else {
                    eligibleIdxs.push(idx);
                }
            }
        });

        const eligible = eligibleIdxs.length;
        const requested = inputMode === 'CNT' 
            ? cnt 
            : Math.max(1, Math.round((pct / 100) * eligibleIdxs.length));

        if (eligible === 0) return { applied: 0, requested, eligible };
        if (inputMode === 'CNT' && requested > eligible) return { applied: 0, requested, eligible };

        const applied = inputMode === 'CNT' 
            ? Math.min(cnt, eligibleIdxs.length) 
            : Math.max(1, Math.round((pct / 100) * eligibleIdxs.length));

        s.recordHistory();

        set((s2) => {
            const shuffled = [...eligibleIdxs].sort(() => Math.random() - 0.5);
            const targetIdxs = new Set(shuffled.slice(0, applied));
            const newLines = [...s2.lines];
            const contentLines = s2.content.split('\n');

            targetIdxs.forEach(idx => {
                const line = { ...newLines[idx] };
                const fields = [...line.fields];
                let lineStr = contentLines[idx];

                const update = (name: string, val: string) => {
                    const fIdx = fields.findIndex(f => f.def.name === name);
                    if (fIdx === -1) return;
                    const def = fields[fIdx].def;
                    let padded = def.type === 'Numeric' ? val.padStart(def.length, '0') : val.padEnd(def.length, ' ');
                    padded = padded.slice(0, def.length);
                    fields[fIdx] = { ...fields[fIdx], value: padded };
                    if (lineStr) {
                        lineStr = lineStr.substring(0, def.start - 1) + padded + lineStr.substring(def.end);
                    }
                };

            if (s.schema === SCHEMAS.RESP) {
                const apprField = fields.find(f => f.def.name === FIELD_NAMES.UNITS_APPROVED);
                const denyField = fields.find(f => f.def.name === FIELD_NAMES.UNITS_DENIED);
                const appr = parseInt(apprField?.value.trim() || '0') || 0;
                const deny = parseInt(denyField?.value.trim() || '0') || 0;
                
                const getCode = () => {
                    if (!randomize) {
                         return RESP_DENIAL_CODES.find(c => c.code === denialCode) || RESP_DENIAL_CODES[0];
                    }
                    return RESP_DENIAL_CODES[Math.floor(Math.random() * RESP_DENIAL_CODES.length)];
                };
                const codeObj = getCode();
                const total = appr + deny;

                if (mode === RESP_STATUS.DENIED) {
                    update(FIELD_NAMES.MRX_CLAIM_STATUS, RESP_STATUS.DENIED);
                    update(FIELD_NAMES.UNITS_APPROVED, '0');
                    update(FIELD_NAMES.UNITS_DENIED, total.toString());
                    update(FIELD_NAMES.DENIAL_CODE, codeObj.code);
                } else if (mode === RESP_STATUS.PARTIAL) {
                    // split total such that newAppr > newDeny and newDeny > 0
                    const maxDeny = Math.floor((total - 1) / 2); // if 100, max is 49. 51 > 49.
                    const newDenyAlloc = Math.floor(Math.random() * maxDeny) + 1; 
                    const newApprAlloc = total - newDenyAlloc;
                    
                    update(FIELD_NAMES.MRX_CLAIM_STATUS, RESP_STATUS.PARTIAL);
                    update(FIELD_NAMES.UNITS_APPROVED, newApprAlloc.toString());
                    update(FIELD_NAMES.UNITS_DENIED, newDenyAlloc.toString());
                    update(FIELD_NAMES.DENIAL_CODE, codeObj.code);
                }
            } else {
                const getCode = () => {
                    if (!randomize) {
                        return ACK_DENIAL_CODES.find(c => c.code === denialCode) || ACK_DENIAL_CODES[0];
                    }
                    return ACK_DENIAL_CODES[Math.floor(Math.random() * ACK_DENIAL_CODES.length)];
                };
                const codeObj = getCode();
                
                update(FIELD_NAMES.STATUS, ACK_STATUS.REJECTED);
                update(FIELD_NAMES.REJECT_ID, codeObj.code);
                update(FIELD_NAMES.REJECT_REASON, codeObj.short);
            }

            line.fields = fields;
            newLines[idx] = line;
            contentLines[idx] = lineStr;
        });

        const summary = { ...s2.summary, accepted: 0, rejected: 0, partial: 0 };
        newLines.forEach(l => {
            if (l.type === LINE_TYPES.DATA) {
                const status = l.fields.find(f => f.def.name === (s2.schema === SCHEMAS.RESP ? FIELD_NAMES.MRX_CLAIM_STATUS : FIELD_NAMES.STATUS))?.value.trim() || '';
                if (s2.schema === SCHEMAS.RESP) {
                    if (status === RESP_STATUS.PAID) summary.accepted++;
                    else if (status === RESP_STATUS.PARTIAL) summary.partial++;
                    else if (status === RESP_STATUS.DENIED) summary.rejected++;
                } else {
                    if (status === ACK_STATUS.ACCEPTED) summary.accepted++;
                    else if (status === ACK_STATUS.REJECTED) summary.rejected++;
                }
            }
        });

        const content = contentLines.join('\n');
        return { 
            lines: newLines, 
            content,
            summary,
            activeFiles: s2.activeFiles.map(f => 
                f.id === s2.activeFileId ? { ...f, lines: newLines, summary, content } : f
            )
        };
        });

        return { applied, requested, eligible };
    }
}));
