'use client';

import { useState } from 'react';
import { AckVisualizer } from '../components/ack-visualizer';
import { MrxConverter } from '../components/mrx-converter';
import { Navbar } from '../components/navbar';
import { cn } from '../lib/utils';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'visualizer' | 'converter'>('visualizer');
  const [pendingMrxFile, setPendingMrxFile] = useState<File | null>(null);
  const [pendingContent, setPendingContent] = useState<{ text: string; fileName: string } | null>(null);

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col bg-background">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 min-h-0 relative">
        <div className={cn("h-full w-full", activeTab !== 'visualizer' && "hidden")}>
          <AckVisualizer
            onSwitchToMrxForge={(file) => {
              setPendingMrxFile(file);
              setActiveTab('converter');
            }}
            pendingContent={pendingContent}
            onPendingContentConsumed={() => setPendingContent(null)}
          />
        </div>
        <div className={cn("h-full w-full", activeTab !== 'converter' && "hidden")}>
          <MrxConverter
            pendingFile={pendingMrxFile}
            onPendingFileConsumed={() => setPendingMrxFile(null)}
            onOpenInDataMatrix={(text, fileName) => {
              setPendingContent({ text, fileName });
              setActiveTab('visualizer');
            }}
          />
        </div>
      </div>
    </main>
  );
}