"use client"

import React from 'react'
import { Zap, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '../lib/utils'

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
                        Data Stream
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
                        MRX Forge
                    </button>
                </div>
            </div>

            {/* Right: Theme Toggle - Minimalist */}
            <ThemeToggle />
        </nav>
    )
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
