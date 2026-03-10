# Magellan Response Protocol Suite

A high-performance, minimalist dashboard designed for technical analysts to visualize, validate, and convert medical data protocols (ACK, RESP, and MRX).

![Project Build](https://img.shields.io/badge/Build-Next.js%2015-black?style=for-the-badge&logo=nextdotjs)
![Style](https://img.shields.io/badge/Styling-Tailwind%20CSS-blue?style=for-the-badge&logo=tailwindcss)
![Performance](https://img.shields.io/badge/Optimization-Virtualized-emerald?style=for-the-badge)

## 🚀 Key Modules

### 1. Data Stream Visualizer
Real-time analysis of **ACK (Acknowledgement)** and **RESP (Response)** files.
- **High-Performance Grid**: Powered by `react-virtuoso` to handle files with 10k+ lines without lag.
- **Intelligent Detection**: Automatically identifies protocol schemas based on line signatures.
- **Error Diagnostics**: Deep-scan validation highlighting alignment failures and invalid field values.
- **Protocol Toggle**: Instant logic switching between ACK and RESP engines via the sidebar.

### 2. MRX Forge
A conversion laboratory for raw MRX data streams.
- **Synthesis Engine**: Transform raw MRX sequences into standardized ACK or RESP protocols.
- **CSV Export**: Extract data into compatible spreadsheet formats for external reporting.
- **Fixed-Width Validation**: Ensures metadata and record lengths match strict protocol specifications.

## ⚡ High-Performance Architecture: Rendering 1 Million Lines in <1 Second

Displaying a 1GB file with 1,000,000 rows in a browser would typically freeze the DOM and crash the tab due to massive memory consumption. We solve this using a **Windowed Lazy-Load VDOM Architecture**:

```mermaid
flowchart TD
    classDef ui fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#f8fafc,rx:5px,ry:5px;
    classDef logic fill:#166534,stroke:#4ade80,stroke-width:2px,color:#f0fdf4,rx:5px,ry:5px;
    classDef network fill:#86198f,stroke:#f0abfc,stroke-width:2px,color:#fdf4ff,rx:5px,ry:5px;

    subgraph Browser [Phase 1: Zero-Crash DOM Virtualization]
        A[User Scrolls Grid]:::ui --> B{React Virtuoso <br> Viewport Engine}:::logic
        B -->|Calculates exact Y-offset| C[Mounts only 30 DOM Nodes]:::ui
        B -->|Recycles nodes on scroll| D[Unmounts off-screen nodes]:::ui
    end

    subgraph Store [Phase 2: Sparse Array Pagination]
        C -.->|Requests Row Index 500,000| S(Zustand State Manager):::logic
        S -->|Checks Array Pointer| E{Is Data in Memory?}:::logic
        E -->|Yes| F[Serve cached ParsedLine]:::logic
        E -->|No| G(Trigger Lazy Load):::network
    end

    subgraph Backend [Phase 3: Chunked Session Fetching]
        G -->|Fetch indices 500,000 to 500,100| API[Backend Session API]:::network
        API -->|Streams NDJSON Chunk| H[JSON Parse & Hydrate]:::logic
        H -->|Fills Array "Holes"| S
    end

    F --> C
```

### 🔍 Deep Dive into the Rendering Pipeline

1. **DOM Virtualization (react-virtuoso)**
   The browser physically cannot render 1 million `<div className="row">` elements. Instead, the grid forces a fixed viewport height and row height (e.g., 37px per row). Mathematics dictate exactly which 30-40 rows should be visible at any scroll position. The UI **only mounts those 30 DOM nodes**. As you scroll, it doesn't create new nodes; it "recycles" the nodes that scrolled out of view by just swapping their text content.

2. **Sparse Array State Management**
   Instead of holding 1 million heavy JSON objects in the Redux/Zustand store instantly, the app knows the `totalDataCount` (e.g., 1,000,000) and creates a "Sparse Array" with 1 million empty slots (holes). This takes almost zero RAM. The scrollbar perfectly maps to this 1-million-slot array, giving the user the illusion the entire file is loaded.

3. **Background Lazy-Loading (Session Mode)**
   When the user jumps to Page 5,000 (Row 500,000), Virtuoso asks Zustand for the data at index `500,000`. Zustand notices that slot is empty (`undefined`). It immediately dispatches an async `fetchSessionRows` request to the backend, asking *only* for rows 500,000 through 500,100.
   While fetching, the UI renders clean blank placeholder rows. Within milliseconds, the backend replies, the array holes are "hydrated", and the React grid repaints the actual data.

4. **Garbage Collection Immunity**
   Because we heavily rely on React Server-Side rendering principles and strictly controlled component memoization (`memo`, `useMemo`, `useCallback`), scrolling fast does not trigger React reconciler panics. Old page data can be safely dropped from memory if the array gets too large, keeping the browser tab locked at a tiny ~100MB footprint.

## 🛠 Tech Stack

- **Core**: Next.js 15 (App Router)
- **State Preservation**: Component-persistent tab switching for zero data loss.
- **UI Architecture**: custom Tailwind CSS system with Theme support (Dark/Light).
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Utility**: date-fns for high-precision timestamping.

## 🏁 Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/bhavik-sakec/response.git
   cd response
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the development engine:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

## 🎨 UI Philosophy
The application follows a **Military-Grade Minimalism** aesthetic:
- **Monospace Priority**: All data presented in technical font families for better alignment reading.
- **Contextual StatBoxes**: Immediate visibility of Accepted vs. Rejected row counts.
- **Glassmorphism Sidebar**: Semi-transparent controls that stay out of the way of the data.

---
Built for speed and precision. 🛡️