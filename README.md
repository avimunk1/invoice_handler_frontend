# Invoice Handler Frontend

React + TypeScript + Vite frontend for the Invoice Handler application.

## Features

- Upload files to S3 or process local folders
- AI-powered invoice processing via Azure Document Intelligence
- Editable results table with Hebrew (RTL) support
- Real-time upload progress tracking

## Setup

### Prerequisites

- Node.js 20.x or higher
- Backend API running (see `../backend/README.md`)

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Update the backend URL if needed:
```
VITE_API_URL=http://localhost:8000
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Usage

### S3 Mode (Recommended for production)

1. Click "Upload Files (S3)" button
2. Select one or more invoice files (PDF, JPG, PNG)
3. Files are uploaded to S3 automatically
4. Backend processes files from S3
5. Results appear in the editable table

### Local Mode (For development)

1. Click "Local Folder" button
2. Enter the full path to a folder containing invoices
3. Backend reads files directly from disk
4. Results appear in the editable table

### Editing Results

- Click any cell in the results table to edit
- Press Enter or click outside to save changes
- Changes are stored in local state (future: save to DB)

## Architecture

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Axios** - HTTP client

## Project Structure

```
src/
├── api/          # API client functions
├── components/   # React components
├── services/     # Business logic (S3 upload)
├── types/        # TypeScript type definitions
├── App.tsx       # Main application component
└── main.tsx      # Application entry point
```

## Future Enhancements

- [ ] Save edited results to database
- [ ] Batch processing with queue
- [ ] Export results to CSV/Excel
- [ ] User authentication
- [ ] Invoice templates and validation rules
