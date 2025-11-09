'use client';

import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
} from '@mui/material';
import { Settings as SettingsIcon, Save } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: 'rgb(250 250 250)', mb: 1 }}>
          Settings
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgb(161 161 170)' }}>
          Configure your application preferences
        </Typography>
      </div>

      <Card
        sx={{
          backgroundColor: 'rgb(39 39 42)',
          border: '1px solid rgb(63 63 70)',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <SettingsIcon size={24} className="text-rose-500 mr-2" />
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'rgb(250 250 250)' }}>
              Claude CLI Configuration
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Claude API Key"
              type="password"
              fullWidth
              placeholder="sk-ant-..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'rgb(250 250 250)',
                  '& fieldset': { borderColor: 'rgb(63 63 70)' },
                  '&:hover fieldset': { borderColor: 'rgb(244 63 94)' },
                },
                '& .MuiInputLabel-root': { color: 'rgb(161 161 170)' },
              }}
            />
            
            <TextField
              label="Model"
              fullWidth
              defaultValue="anthropic.claude-opus-4-20250514-v1:0"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'rgb(250 250 250)',
                  '& fieldset': { borderColor: 'rgb(63 63 70)' },
                  '&:hover fieldset': { borderColor: 'rgb(244 63 94)' },
                },
                '& .MuiInputLabel-root': { color: 'rgb(161 161 170)' },
              }}
            />
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
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'rgb(250 250 250)', mb: 3 }}>
            Application Settings
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Default Specification Type"
              fullWidth
              defaultValue="ANALYSIS"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'rgb(250 250 250)',
                  '& fieldset': { borderColor: 'rgb(63 63 70)' },
                  '&:hover fieldset': { borderColor: 'rgb(244 63 94)' },
                },
                '& .MuiInputLabel-root': { color: 'rgb(161 161 170)' },
              }}
            />
            
            <TextField
              label="Tickets per Specification"
              type="number"
              fullWidth
              defaultValue="5"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'rgb(250 250 250)',
                  '& fieldset': { borderColor: 'rgb(63 63 70)' },
                  '&:hover fieldset': { borderColor: 'rgb(244 63 94)' },
                },
                '& .MuiInputLabel-root': { color: 'rgb(161 161 170)' },
              }}
            />
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<Save size={20} />}
          sx={{
            backgroundColor: 'rgb(244 63 94)',
            '&:hover': { backgroundColor: 'rgb(225 29 72)' },
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          Save Settings
        </Button>
      </Box>
    </div>
  );
}
