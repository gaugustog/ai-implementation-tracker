'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Typography,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  FormControlLabel,
  Stack,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { GeneratedTicket } from '@/lib/hooks/useTicketGeneration';

interface TicketCardProps {
  ticket: GeneratedTicket;
  isApproved: boolean;
  onApprove: (ticketNumber: number) => void;
  onUnapprove: (ticketNumber: number) => void;
  onUpdate: (ticketNumber: number, updates: Partial<GeneratedTicket>) => void;
  showDependencies?: boolean;
}

export function TicketCard({
  ticket,
  isApproved,
  onApprove,
  onUnapprove,
  onUpdate,
  showDependencies = true,
}: TicketCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(ticket.title);
  const [editedDescription, setEditedDescription] = useState(ticket.description);

  const handleSave = () => {
    onUpdate(ticket.ticketNumber, {
      title: editedTitle,
      description: editedDescription,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(ticket.title);
    setEditedDescription(ticket.description);
    setIsEditing(false);
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple':
        return 'success';
      case 'medium':
        return 'warning';
      case 'complex':
        return 'error';
      default:
        return 'default';
    }
  };

  const estimatedHours = Math.round(ticket.estimatedMinutes / 60);
  const estimatedDays = (ticket.estimatedMinutes / (8 * 60)).toFixed(1);

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        borderLeft: isApproved ? '4px solid #4caf50' : '4px solid #ccc',
        transition: 'all 0.3s',
        '&:hover': {
          boxShadow: 3,
        },
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box flex={1}>
              {isEditing ? (
                <TextField
                  fullWidth
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{ mb: 1 }}
                />
              ) : (
                <Typography variant="h6" gutterBottom>
                  #{ticket.ticketNumber} - {ticket.title}
                </Typography>
              )}
              
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  label={ticket.complexity}
                  color={getComplexityColor(ticket.complexity) as any}
                  size="small"
                />
                <Chip
                  label={`${estimatedHours}h (${estimatedDays}d)`}
                  size="small"
                  variant="outlined"
                />
                {ticket.epicNumber && (
                  <Chip label={`Epic #${ticket.epicNumber}`} size="small" color="primary" />
                )}
                {ticket.parallelizable && (
                  <Chip label="Paralelizável" size="small" color="info" />
                )}
                {ticket.aiAgentCapable && (
                  <Chip label="AI Capable" size="small" color="secondary" />
                )}
              </Stack>
            </Box>

            <Box display="flex" gap={1}>
              {isEditing ? (
                <>
                  <Button
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    variant="contained"
                    color="primary"
                  >
                    Salvar
                  </Button>
                  <Button
                    size="small"
                    startIcon={<CancelIcon />}
                    onClick={handleCancel}
                    variant="outlined"
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => setIsEditing(true)}
                    variant="outlined"
                  >
                    Editar
                  </Button>
                  <Button
                    size="small"
                    startIcon={isApproved ? <CancelIcon /> : <CheckCircleIcon />}
                    onClick={() =>
                      isApproved ? onUnapprove(ticket.ticketNumber) : onApprove(ticket.ticketNumber)
                    }
                    variant={isApproved ? 'outlined' : 'contained'}
                    color={isApproved ? 'inherit' : 'success'}
                  >
                    {isApproved ? 'Desaprovar' : 'Aprovar'}
                  </Button>
                </>
              )}
            </Box>
          </Box>

          {/* Description */}
          <Box>
            {isEditing ? (
              <TextField
                fullWidth
                multiline
                rows={4}
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                variant="outlined"
                size="small"
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                {ticket.description}
              </Typography>
            )}
          </Box>

          {/* Acceptance Criteria */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">
                Critérios de Aceite ({ticket.acceptanceCriteria.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                {ticket.acceptanceCriteria.map((criterion, index) => (
                  <Box key={index} display="flex" alignItems="flex-start">
                    <Typography variant="body2" sx={{ ml: 1 }}>
                      {index + 1}. {criterion}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Additional Details */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" gutterBottom>
                Expertise Necessária:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {ticket.requiredExpertise.map((exp, index) => (
                  <Chip key={index} label={exp} size="small" variant="outlined" />
                ))}
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" gutterBottom>
                Estratégia de Teste:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {ticket.testingStrategy}
              </Typography>
            </Grid>

            {showDependencies && ticket.dependencies.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Dependências:
                </Typography>
                <Stack direction="row" spacing={1}>
                  {ticket.dependencies.map((dep) => (
                    <Chip key={dep} label={`Ticket #${dep}`} size="small" color="warning" />
                  ))}
                </Stack>
              </Grid>
            )}
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
}
