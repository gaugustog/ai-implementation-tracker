import type { Metadata } from "next";
import "./globals.css";
import ThemeRegistry from "@/components/ThemeRegistry";
import AmplifyProvider from "@/components/AmplifyProvider";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Box, Toolbar } from "@mui/material";

export const metadata: Metadata = {
  title: "Spec-Driven Development Tracker",
  description: "Manage your spec-driven development projects with Claude CLI integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AmplifyProvider>
          <ThemeRegistry>
            <Box sx={{ display: 'flex' }}>
              <Header />
              <Sidebar />
              <Box
                component="main"
                sx={{
                  flexGrow: 1,
                  p: 3,
                  width: { xs: '100%', md: 'calc(100% - 280px)' },
                  ml: { xs: 0, md: '280px' },
                  minHeight: '100vh',
                }}
              >
                <Toolbar />
                {children}
              </Box>
            </Box>
          </ThemeRegistry>
        </AmplifyProvider>
      </body>
    </html>
  );
}
