# Spec-Driven Development Tracker

A Next.js dashboard application for managing spec-driven development projects with Claude CLI integration.

## Features

- 🎨 **Modern UI**: Built with Material UI 7.2+ and Tailwind CSS v4
- 🌙 **Dark Mode**: Full dark theme with zinc and rose color palette
- 📊 **Dashboard**: Overview of projects, specifications, and tickets
- 📁 **Project Management**: Create and manage development projects
- 📝 **Specification Management**: Organize specs by type (ANALYSIS, FIXES, PLANS, REVIEWS)
- 🎫 **Ticket System**: Break down specifications into actionable tickets
- 🤖 **Claude CLI Integration**: Generate specifications using AI (mock implementation included)

## Tech Stack

- **Framework**: Next.js 16.0.1 (App Router)
- **UI Library**: Material UI 7.2+
- **Styling**: Tailwind CSS v4 with dark mode
- **Icons**: Lucide React
- **Language**: TypeScript

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
├── app/                      # Next.js app directory
│   ├── projects/            # Projects page
│   ├── specifications/      # Specifications page
│   ├── tickets/             # Tickets page
│   ├── settings/            # Settings page
│   ├── layout.tsx           # Root layout with sidebar and header
│   └── page.tsx             # Dashboard home page
├── components/
│   ├── layout/              # Layout components
│   │   ├── Header.tsx       # Top navigation bar
│   │   └── Sidebar.tsx      # Side navigation menu
│   └── ThemeRegistry.tsx    # Material UI theme provider
├── lib/
│   ├── api/                 # API utilities
│   │   └── claude.ts        # Claude CLI integration
│   └── types/               # TypeScript type definitions
│       └── index.ts
└── public/                  # Static assets
```

## Specification Types

The application manages four types of specifications:

- **ANALYSIS**: Requirements analysis and system design
- **FIXES**: Bug fixes and issue resolutions
- **PLANS**: Implementation plans and roadmaps
- **REVIEWS**: Code and design reviews

Each specification can be broken down into multiple tickets for easier management.

## Claude CLI Integration

The application includes a mock implementation of Claude CLI integration in `lib/api/claude.ts`. To integrate with actual Claude CLI:

1. Install Claude CLI
2. Configure API keys in Settings
3. Replace mock functions with actual CLI calls

## Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Start Production Server

```bash
npm start
```

## Customization

### Theme Colors

The application uses a zinc and rose color palette. To customize:

Edit `app/globals.css` to change CSS variables:
- `--primary`: Rose accent color (default: #f43f5e)
- `--background`: Main background (default: #18181b)
- `--card`: Card background (default: #27272a)

### Material UI Theme

Edit `components/ThemeRegistry.tsx` to customize Material UI theme settings.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## License

MIT

