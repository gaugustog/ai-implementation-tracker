'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ListTodo, Plus, Circle, Clock, CheckCircle2, FileText } from 'lucide-react';
import type { Ticket } from '@/lib/types';
import { ticketAPI } from '@/lib/api/amplify';

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'in-progress' | 'done'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ticketAPI.list();
      setTickets(data as Ticket[]);
    } catch (err) {
      console.error('Error loading tickets:', err);
      setError('Failed to load tickets. Using placeholder configuration.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = statusFilter === 'all'
    ? tickets
    : tickets.filter(ticket => ticket.status === statusFilter);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'todo':
        return <Circle size={16} />;
      case 'in-progress':
        return <Clock size={16} />;
      case 'done':
        return <CheckCircle2 size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo':
        return 'rgb(161 161 170)';
      case 'in-progress':
        return 'rgb(59 130 246)';
      case 'done':
        return 'rgb(34 197 94)';
    }
  };

  const getSpecTypeColor = (type?: string | null) => {
    if (!type) return 'rgb(161 161 170)';
    switch (type) {
      case 'ANALYSIS':
        return 'rgb(59 130 246)';
      case 'FIXES':
        return 'rgb(239 68 68)';
      case 'PLANS':
        return 'rgb(34 197 94)';
      case 'REVIEWS':
        return 'rgb(168 85 247)';
      default:
        return 'rgb(161 161 170)';
    }
  };

  return (
    <div className="space-y-6">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <div>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: 'rgb(250 250 250)', mb: 1 }}>
            Tickets
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgb(161 161 170)' }}>
            Track and manage specification tickets with markdown files in S3
          </Typography>
        </div>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: 'rgb(161 161 170)' }}>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'todo' | 'in-progress' | 'done')}
              sx={{
                color: 'rgb(250 250 250)',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(63 63 70)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(244 63 94)' },
                '& .MuiSvgIcon-root': { color: 'rgb(161 161 170)' },
              }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="todo">To Do</MenuItem>
              <MenuItem value="in-progress">In Progress</MenuItem>
              <MenuItem value="done">Done</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<Plus size={20} />}
            sx={{
              backgroundColor: 'rgb(244 63 94)',
              '&:hover': { backgroundColor: 'rgb(225 29 72)' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            New Ticket
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card
            sx={{
              backgroundColor: 'rgb(39 39 42)',
              border: '1px solid rgb(63 63 70)',
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ color: 'rgb(161 161 170)', mb: 1 }}>
                To Do
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'rgb(250 250 250)' }}>
                {tickets.filter(t => t.status === 'todo').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card
            sx={{
              backgroundColor: 'rgb(39 39 42)',
              border: '1px solid rgb(63 63 70)',
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ color: 'rgb(161 161 170)', mb: 1 }}>
                In Progress
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'rgb(59 130 246)' }}>
                {tickets.filter(t => t.status === 'in-progress').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card
            sx={{
              backgroundColor: 'rgb(39 39 42)',
              border: '1px solid rgb(63 63 70)',
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ color: 'rgb(161 161 170)', mb: 1 }}>
                Done
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'rgb(34 197 94)' }}>
                {tickets.filter(t => t.status === 'done').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'rgb(244 63 94)' }} />
        </Box>
      ) : filteredTickets.length === 0 ? (
        <Card
          sx={{
            backgroundColor: 'rgb(39 39 42)',
            border: '1px solid rgb(63 63 70)',
            textAlign: 'center',
            py: 8,
          }}
        >
          <CardContent>
            <ListTodo size={48} className="text-zinc-600 mx-auto mb-4" />
            <Typography variant="h6" sx={{ color: 'rgb(250 250 250)', mb: 2 }}>
              No tickets yet
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgb(161 161 170)', mb: 3 }}>
              Tickets will be automatically generated from specifications
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredTickets.map((ticket) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={ticket.id}>
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'rgb(250 250 250)' }}>
                      {ticket.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', color: getStatusColor(ticket.status || 'todo') }}>
                      {getStatusIcon(ticket.status || 'todo')}
                    </Box>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'rgb(161 161 170)', mb: 2 }}>
                    {ticket.description || 'No description'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {ticket.specType && (
                      <Chip
                        label={ticket.specType}
                        size="small"
                        sx={{
                          backgroundColor: getSpecTypeColor(ticket.specType),
                          color: '#fff',
                          fontWeight: 600,
                        }}
                      />
                    )}
                    <Chip
                      label={ticket.status || 'todo'}
                      size="small"
                      sx={{
                        backgroundColor: 'rgb(24 24 27)',
                        color: getStatusColor(ticket.status || 'todo'),
                        border: '1px solid rgb(63 63 70)',
                      }}
                    />
                    {ticket.fileKey && (
                      <Chip
                        icon={<FileText size={14} />}
                        label="Has file"
                        size="small"
                        sx={{
                          backgroundColor: 'rgb(24 24 27)',
                          color: 'rgb(161 161 170)',
                          border: '1px solid rgb(63 63 70)',
                        }}
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </div>
  );
}
