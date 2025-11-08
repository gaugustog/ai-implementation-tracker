'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  ListTodo,
  Settings,
  Menu,
  X
} from 'lucide-react';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, IconButton } from '@mui/material';

const menuItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Specifications', href: '/specifications', icon: FileText },
  { name: 'Tickets', href: '/tickets', icon: ListTodo },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <div className="flex h-full flex-col bg-zinc-900 border-r border-zinc-800">
      <div className="flex h-16 items-center justify-between px-6 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-rose-500">Spec Tracker</h1>
        <IconButton
          onClick={handleDrawerToggle}
          className="md:hidden text-zinc-400"
          sx={{ color: 'rgb(161 161 170)' }}
        >
          <X size={20} />
        </IconButton>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <List>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <ListItem key={item.name} disablePadding>
                <Link href={item.href} className="w-full" onClick={() => setMobileOpen(false)}>
                  <ListItemButton
                    selected={isActive}
                    sx={{
                      px: 3,
                      py: 1.5,
                      '&.Mui-selected': {
                        backgroundColor: 'rgb(244 63 94)',
                        '&:hover': {
                          backgroundColor: 'rgb(225 29 72)',
                        },
                      },
                      '&:hover': {
                        backgroundColor: 'rgb(63 63 70)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: isActive ? '#fff' : 'rgb(161 161 170)' }}>
                      <Icon size={20} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.name}
                      sx={{ 
                        color: isActive ? '#fff' : 'rgb(161 161 170)',
                        '& .MuiTypography-root': {
                          fontWeight: isActive ? 600 : 400
                        }
                      }}
                    />
                  </ListItemButton>
                </Link>
              </ListItem>
            );
          })}
        </List>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <IconButton
        onClick={handleDrawerToggle}
        className="md:hidden fixed top-4 left-4 z-50"
        sx={{ color: 'rgb(161 161 170)' }}
      >
        <Menu size={24} />
      </IconButton>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 280 },
        }}
      >
        {drawer}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 280 },
        }}
        open
      >
        {drawer}
      </Drawer>
    </>
  );
}
