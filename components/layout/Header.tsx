'use client';

import { AppBar, Toolbar, Typography, IconButton, Box } from '@mui/material';
import { Bell, User } from 'lucide-react';

export default function Header() {
  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: 'rgb(24 24 27)',
        borderBottom: '1px solid rgb(63 63 70)',
        boxShadow: 'none',
      }}
    >
      <Toolbar>
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ 
            flexGrow: 1,
            fontWeight: 600,
            color: 'rgb(250 250 250)',
            ml: { xs: 6, md: 0 }
          }}
        >
          Spec-Driven Development Tracker
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            color="inherit"
            sx={{ color: 'rgb(161 161 170)', '&:hover': { color: 'rgb(244 63 94)' } }}
          >
            <Bell size={20} />
          </IconButton>
          <IconButton 
            color="inherit"
            sx={{ color: 'rgb(161 161 170)', '&:hover': { color: 'rgb(244 63 94)' } }}
          >
            <User size={20} />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
