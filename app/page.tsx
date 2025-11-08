'use client';

import { Card, CardContent, Typography, Box, Button, Grid } from '@mui/material';
import { FolderKanban, FileText, ListTodo, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const stats = [
  { name: 'Total Projects', value: '0', icon: FolderKanban, href: '/projects' },
  { name: 'Specifications', value: '0', icon: FileText, href: '/specifications' },
  { name: 'Open Tickets', value: '0', icon: ListTodo, href: '/tickets' },
  { name: 'Completion Rate', value: '0%', icon: TrendingUp, href: '/projects' },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: 'rgb(250 250 250)', mb: 1 }}>
          Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgb(161 161 170)' }}>
          Welcome to your spec-driven development tracker
        </Typography>
      </div>

      <Grid container spacing={3}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={stat.name}>
              <Card 
                sx={{ 
                  backgroundColor: 'rgb(39 39 42)',
                  border: '1px solid rgb(63 63 70)',
                  '&:hover': {
                    borderColor: 'rgb(244 63 94)',
                  },
                  transition: 'border-color 0.2s',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" sx={{ color: 'rgb(161 161 170)', fontWeight: 500 }}>
                      {stat.name}
                    </Typography>
                    <Icon size={20} className="text-rose-500" />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'rgb(250 250 250)' }}>
                    {stat.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card 
        sx={{ 
          backgroundColor: 'rgb(39 39 42)',
          border: '1px solid rgb(63 63 70)',
        }}
      >
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'rgb(250 250 250)', mb: 2 }}>
            Getting Started
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgb(161 161 170)', mb: 3 }}>
            Start managing your spec-driven development projects with Claude CLI integration.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Link href="/projects">
              <Button 
                variant="contained" 
                sx={{ 
                  backgroundColor: 'rgb(244 63 94)',
                  '&:hover': { backgroundColor: 'rgb(225 29 72)' },
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                Create Project
              </Button>
            </Link>
            <Link href="/specifications">
              <Button 
                variant="outlined" 
                sx={{ 
                  borderColor: 'rgb(63 63 70)',
                  color: 'rgb(250 250 250)',
                  '&:hover': { borderColor: 'rgb(244 63 94)', backgroundColor: 'transparent' },
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                View Specifications
              </Button>
            </Link>
          </Box>
        </CardContent>
      </Card>

      <Card 
        sx={{ 
          backgroundColor: 'rgb(39 39 42)',
          border: '1px solid rgb(63 63 70)',
        }}
      >
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'rgb(250 250 250)', mb: 2 }}>
            Specification Types
          </Typography>
          <Grid container spacing={2}>
            {['ANALYSIS', 'FIXES', 'PLANS', 'REVIEWS'].map((type) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={type}>
                <Box 
                  sx={{ 
                    p: 2,
                    border: '1px solid rgb(63 63 70)',
                    borderRadius: 1,
                    backgroundColor: 'rgb(24 24 27)',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'rgb(161 161 170)', fontWeight: 600 }}>
                    {type}
                  </Typography>
                  <Typography variant="h5" sx={{ color: 'rgb(250 250 250)', mt: 1 }}>
                    0
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </div>
  );
}

