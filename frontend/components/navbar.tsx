"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Zap, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '../lib/utils'
import { checkHealth } from '@/lib/api'
import { toast } from 'sonner'

interface NavbarProps {
    activeTab: 'visualizer' | 'converter';
    onTabChange: (tab: 'visualizer' | 'converter') => void;
}

export function Navbar({ activeTab, onTabChange }: NavbarProps) {
    return (
        <nav className="h-14 border-b border-border bg-background flex items-center justify-between px-6 shrink-0 z-50">
            {/* Left: Minimal Brand */}
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-2.5">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold tracking-[0.2em]">MAGELLAN</span>
                    <BackendStatus />
                </div>

                {/* Navigation Tabs - Minimalist Style */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onTabChange('visualizer')}
                        className={cn(
                            "px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all rounded-md",
                            activeTab === 'visualizer'
                                ? "text-primary bg-primary/5"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        DATA MATRIX
                    </button>
                    <button
                        onClick={() => onTabChange('converter')}
                        className={cn(
                            "px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all rounded-md",
                            activeTab === 'converter'
                                ? "text-primary bg-primary/5"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Prepay Forge
                    </button>
                </div>
            </div>

            {/* Right: Theme Toggle - Minimalist */}
            <ThemeToggle />
        </nav>
    )
}

/**
 * BackendStatus — Lightweight heartbeat indicator.
 * Polls /health every 5 seconds and shows a live/offline dot.
 * Fires a toast when status transitions (online → offline or offline → online).
 */
function BackendStatus() {
    const [isOnline, setIsOnline] = useState<boolean | null>(null); // null = initial check pending
    const prevOnline = useRef<boolean | null>(null);

    useEffect(() => {
        let active = true;

        const poll = async () => {
            const alive = await checkHealth();
            if (!active) return;

            setIsOnline(alive);

            // Notify on transitions (skip the very first check to avoid a "connected" toast on load)
            if (prevOnline.current !== null && prevOnline.current !== alive) {
                if (alive) {
                    toast.success('Backend Online', {
                        description: 'Connection to the processing engine restored.',
                        duration: 2000,
                    });
                } else {
                    toast.error('Backend Offline', {
                        description: 'Cannot reach the processing engine. Retrying...',
                        duration: 5000,
                    });
                }
            }
            prevOnline.current = alive;
        };

        // Immediate first check
        poll();

        // Then every 5 seconds
        const interval = setInterval(poll, 5000);
        return () => { active = false; clearInterval(interval); };
    }, []);

    // Don't render anything until first check completes
    if (isOnline === null) {
        return <div className="w-2 h-2 rounded-full bg-muted-foreground/30 ml-1" title="Checking backend..." />;
    }

    return (
        <div
            className={cn(
                "w-2 h-2 rounded-full ml-1 transition-colors duration-300",
                isOnline
                    ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                    : "bg-rose-500 animate-pulse shadow-[0_0_6px_rgba(225,29,72,0.5)]"
            )}
            title={isOnline ? "Backend: Online" : "Backend: Offline"}
        />
    );
}

function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-8 h-8 rounded-lg bg-muted/20" />;
    }

    const isDark = theme === 'dark';

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/30 transition-all text-muted-foreground hover:text-foreground"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
            {isDark ? (
                <Sun className="w-3.5 h-3.5" />
            ) : (
                <Moon className="w-3.5 h-3.5" />
            )}
        </button>
    );
}
