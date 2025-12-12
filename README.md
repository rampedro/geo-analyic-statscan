# StatCan Pulse: AI-Powered Geo-Analytics Dashboard

## Overview
StatCan Pulse is a high-performance WebGL analytics platform designed to visualize Canadian Census and economic data. It combines real-time vector visualization with generative AI analysis to find hotspots, compare regions, and identify trends across Canada.

## Features
- **Geometric Glyph Visualization**: 
  - **Dot**: Single variable data (e.g., Population).
  - **Line/Bar**: 2-variable data (e.g., Value + Trend).
  - **Triangle**: 3-variable multi-dimensional data (e.g., Value + Trend + Volatility).
- **Dynamic Map Details**: Automatically switches from macro-level provincial boundaries to simulated Dissemination Area (neighborhood) polygons when zooming in.
- **AI Integration**:
  - **Google Gemini**: Cloud-based analysis of regional statistics.
  - **Local Ollama**: Support for local LLMs (Llama 3, Mistral) for privacy-first analysis.
- **Interactive Discovery**: Click anywhere on Canada to identify regions and load relevant data tables (Housing, Labour, Health, etc.).
- **WebGL Rendering**: Powered by Deck.gl and MapLibre for handling thousands of data points smoothly.

## Setup & Installation

### Prerequisites
- Node.js (v18+)
- (Optional) Google Gemini API Key
- (Optional) Ollama running locally for local AI

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your API key (create a `.env` file):
   ```
   API_KEY=your_gemini_api_key
   ```
4. Start the development server:
   ```bash
   npm start
   ```

### Using Local AI (Ollama)
1. Install Ollama from [ollama.com](https://ollama.com).
2. Run a model locally:
   ```bash
   ollama run llama3
   ```
3. In the application, click the **Settings (Gear)** icon in the top left.
4. Select **Ollama** as the provider.
5. Ensure the URL is `http://localhost:11434` (default).

## Usage
- **Navigation**: Pan and zoom like any standard map.
- **Discovery**: Click on a province or city to open the Data Connector panel.
- **Analysis**: Select a dataset, then click "Generate Report" in the sidebar to get an AI summary.
- **Detail View**: Zoom in past level 9 to see the "Load Neighbourhood Shapes" button. Click it to render detailed local grids.

## Tech Stack
- React 19
- Deck.gl / MapLibre (WebGL)
- Google GenAI SDK
- Tailwind CSS
- Recharts
