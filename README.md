# Antigravity Response Project

## Overview
This project consists of two main parts:

- **backend/**: Java-based file parser engine and API server. Includes build scripts, configuration, and documentation for API usage and testing.
- **frontend/**: Next.js web application for visualizing and interacting with parsed data. Includes UI components, layouts, and utilities.
- **testing/**: Automated test scenarios for backend APIs using Karate and TestNG.

## Features
- File parsing and processing engine
- REST API for file operations
- Modern web UI for data visualization
- Automated testing and validation

## Getting Started
1. Clone the repository.
2. See backend/README.md and frontend/README.md for setup instructions.

## Folder Structure
- `backend/` - Java backend
- `frontend/` - Next.js frontend
- `testing/` - API and integration tests

## License
This project is for demonstration and internal use.

## How to Run

### Backend
1. Navigate to the `backend` folder.
2. Run:
	- On Windows: `gradlew.bat bootRun`
	- On Unix: `./gradlew bootRun`
3. The API server will start on the configured port (default: 8080).

### Frontend
1. Navigate to the `frontend` folder.
2. Install dependencies:
	- `npm install`
3. Start the development server:
	- `npm run dev`
4. The app will be available at `http://localhost:3000`.

### Example .env
Create a `.env` file in the `frontend` folder with the following content:

```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_API_HEALTH=/api/health
NEXT_PUBLIC_API_LAYOUTS=/api/layouts
NEXT_PUBLIC_API_PARSE=/api/parse
NEXT_PUBLIC_API_PARSE_TEXT=/api/parse-text
NEXT_PUBLIC_API_CONVERT_ACK=/api/convert/mrx-to-ack
NEXT_PUBLIC_API_CONVERT_RESP=/api/convert/mrx-to-resp
NEXT_PUBLIC_API_CONVERT_CSV=/api/convert/mrx-to-csv
NEXT_PUBLIC_API_VALIDATE=/api/validate
NEXT_PUBLIC_API_PARSE_STREAM=/api/parse-stream
NODE_ENV=development
```

Adjust values as needed for your environment.
