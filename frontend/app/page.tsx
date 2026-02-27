'use client';

import { useState } from 'react';
import { AckVisualizer } from '../components/ack-visualizer';
import { MrxConverter } from '../components/mrx-converter';
import { Navbar } from '../components/navbar';
import { cn } from '../lib/utils';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'visualizer' | 'converter'>('visualizer');

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col bg-background">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 min-h-0 relative">
        <div className={cn("h-full w-full", activeTab !== 'visualizer' && "hidden")}>
          <AckVisualizer />
        </div>
        <div className={cn("h-full w-full", activeTab !== 'converter' && "hidden")}>
          <MrxConverter />
        </div>
      </div>
    </main>
  );
}