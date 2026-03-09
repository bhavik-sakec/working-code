'use client';

import { useState } from 'react';
import { UniversalVisualizer } from '../components/universal-visualizer';
import { MrxConverter } from '../components/mrx-converter';
import { Navbar } from '../components/navbar';
import { cn } from '../lib/utils';
import { useStore } from '../lib/store';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'visualizer' | 'converter'>('visualizer');
  const [pendingMrxFile, setPendingMrxFile] = useState<File | null>(null);
  const [pendingContent, setPendingContent] = useState<{ text: string; fileName: string } | null>(null);
  
  const { activeFiles, activeFileId, switchFile } = useStore();

  const handleTabChange = (tab: 'visualizer' | 'converter') => {
    setActiveTab(tab);
    
    // Auto-switch file focus based on tab intent
    if (tab === 'converter') {
      const lastMrx = activeFiles.find(f => f.schema === 'MRX');
      if (lastMrx && lastMrx.id !== activeFileId) {
        switchFile(lastMrx.id);
      }
    } else {
      const lastMatrix = activeFiles.find(f => f.schema !== 'MRX' && f.schema !== 'INVALID');
      if (lastMatrix && lastMatrix.id !== activeFileId) {
        switchFile(lastMatrix.id);
      }
    }
  };

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col bg-background">
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="flex-1 min-h-0 relative">
        <div className={cn("h-full w-full", activeTab !== 'visualizer' && "hidden")}>
          <UniversalVisualizer
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