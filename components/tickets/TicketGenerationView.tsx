'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
  Alert,
  Chip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { TicketCard } from './TicketCard';
import {
  useTicketGeneration,
  useTicketApproval,
  GeneratedTicket,
  Epic,
  type TicketGenerationRequest,
} from '@/lib/hooks/useTicketGeneration';
import { estimateTicketGenerationCost, formatCost } from '@/lib/utils/cost-tracking';

interface TicketGenerationViewProps {
  specificationId: string;
  specificationContent: string;
  specType: 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';
  planNamePrefix: string;
  projectContext?: any;
  onSave?: (tickets: GeneratedTicket[], epics: Epic[]) => Promise<void>;
}

export function TicketGenerationView({
  specificationId,
  specificationContent,
  specType,
  planNamePrefix,
  projectContext,
  onSave,
}: TicketGenerationViewProps) {
  const [currentTab, setCurrentTab] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  
  const { generateTickets, isGenerating, error, result, progress, reset } = useTicketGeneration();
  
  const {
    editedTickets,
    approvedTickets,
    updateTicket,
    approveTicket,
    unapproveTicket,
    approveAll,
    unapproveAll,
    isTicketApproved,
    allApproved,
  } = useTicketApproval(result?.tickets || []);

  // Estimate cost
  const costEstimate = estimateTicketGenerationCost(specificationContent);

  const handleGenerate = async () => {
    const request: TicketGenerationRequest = {
      specificationId,
      specificationContent,
      specType,
      planNamePrefix,
      projectContext,
    };

    await generateTickets(request);
  };

  const handleSave = async () => {
    if (!result || !onSave) return;

    setIsSaving(true);
    try {
      await onSave(editedTickets, result.epics);
    } catch (err) {
      console.error('Failed to save tickets:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadSummary = () => {
    if (!result) return;
    // In production, this would download from S3
    alert(`Download SUMMARY.md from: ${result.summaryPath}`);
  };

  const handleDownloadExecutionPlan = () => {
    if (!result) return;
    // In production, this would download from S3
    alert(`Download EXECUTION_PLAN.md from: ${result.executionPlanPath}`);
  };

  // Group tickets by epic
  const ticketsByEpic = result?.epics.reduce((acc, epic) => {
    acc[epic.epicNumber] = editedTickets.filter(t => t.epicNumber === epic.epicNumber);
    return acc;
  }, {} as Record<number, GeneratedTicket[]>) || {};

  const ticketsWithoutEpic = editedTickets.filter(t => !t.epicNumber);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* Header */}
          <Box>
            <Typography variant="h4" gutterBottom>
              Geração de Tickets
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Especificação: {specificationId} | Tipo: {specType}
            </Typography>
          </Box>

          <Divider />

          {/* Cost Estimate */}
          {!result && (
            <Alert severity="info">
              <Typography variant="subtitle2">Estimativa de Custo</Typography>
              <Typography variant="body2">
                Custo estimado: {formatCost(costEstimate.estimated.totalCost)} USD
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {costEstimate.breakdown.length} etapas de processamento
              </Typography>
            </Alert>
          )}

          {/* Generation Controls */}
          {!result && (
            <Box>
              <Button
                variant="contained"
                size="large"
                onClick={handleGenerate}
                disabled={isGenerating}
                startIcon={isGenerating ? <CircularProgress size={20} /> : undefined}
              >
                {isGenerating ? 'Gerando Tickets...' : 'Gerar Tickets'}
              </Button>
              
              {progress && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {progress}
                </Typography>
              )}
            </Box>
          )}

          {/* Error Display */}
          {error && (
            <Alert severity="error" onClose={reset}>
              <Typography variant="subtitle2">Erro ao gerar tickets</Typography>
              <Typography variant="body2">{error}</Typography>
            </Alert>
          )}

          {/* Results */}
          {result && (
            <>
              {/* Summary Stats */}
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={3} alignItems="center">
                    <Box>
                      <Typography variant="h4">{editedTickets.length}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Tickets Gerados
                      </Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                      <Typography variant="h4">{result.epics.length}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Épicos
                      </Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                      <Typography variant="h4">{approvedTickets.size}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Aprovados
                      </Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                      <Typography variant="h4">
                        {Math.round(
                          editedTickets.reduce((sum, t) => sum + t.estimatedMinutes, 0) / 60
                        )}h
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Tempo Total
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  onClick={approveAll}
                  startIcon={<CheckCircleIcon />}
                  disabled={allApproved}
                >
                  Aprovar Todos
                </Button>
                <Button
                  variant="outlined"
                  onClick={unapproveAll}
                  startIcon={<CancelIcon />}
                  disabled={approvedTickets.size === 0}
                >
                  Desaprovar Todos
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleDownloadSummary}
                  startIcon={<DownloadIcon />}
                >
                  Baixar SUMMARY.md
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleDownloadExecutionPlan}
                  startIcon={<DownloadIcon />}
                >
                  Baixar EXECUTION_PLAN.md
                </Button>
                <Button variant="outlined" onClick={reset} startIcon={<RefreshIcon />}>
                  Gerar Novamente
                </Button>
                {onSave && (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleSave}
                    disabled={!allApproved || isSaving}
                    startIcon={isSaving ? <CircularProgress size={20} /> : undefined}
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Tickets'}
                  </Button>
                )}
              </Stack>

              {/* Tabs */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
                  <Tab label="Por Épico" />
                  <Tab label="Todos os Tickets" />
                  <Tab label="Grafo de Dependências" />
                </Tabs>
              </Box>

              {/* Tab Content - By Epic */}
              {currentTab === 0 && (
                <Stack spacing={4}>
                  {result.epics.map((epic) => (
                    <Box key={epic.epicNumber}>
                      <Typography variant="h5" gutterBottom>
                        Épico #{epic.epicNumber}: {epic.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {epic.description}
                      </Typography>
                      <Stack spacing={2} sx={{ mt: 2 }}>
                        {ticketsByEpic[epic.epicNumber]?.map((ticket) => (
                          <TicketCard
                            key={ticket.ticketNumber}
                            ticket={ticket}
                            isApproved={isTicketApproved(ticket.ticketNumber)}
                            onApprove={approveTicket}
                            onUnapprove={unapproveTicket}
                            onUpdate={updateTicket}
                          />
                        ))}
                      </Stack>
                    </Box>
                  ))}
                  
                  {ticketsWithoutEpic.length > 0 && (
                    <Box>
                      <Typography variant="h5" gutterBottom>
                        Tickets Sem Épico
                      </Typography>
                      <Stack spacing={2} sx={{ mt: 2 }}>
                        {ticketsWithoutEpic.map((ticket) => (
                          <TicketCard
                            key={ticket.ticketNumber}
                            ticket={ticket}
                            isApproved={isTicketApproved(ticket.ticketNumber)}
                            onApprove={approveTicket}
                            onUnapprove={unapproveTicket}
                            onUpdate={updateTicket}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              )}

              {/* Tab Content - All Tickets */}
              {currentTab === 1 && (
                <Stack spacing={2}>
                  {editedTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.ticketNumber}
                      ticket={ticket}
                      isApproved={isTicketApproved(ticket.ticketNumber)}
                      onApprove={approveTicket}
                      onUnapprove={unapproveTicket}
                      onUpdate={updateTicket}
                    />
                  ))}
                </Stack>
              )}

              {/* Tab Content - Dependency Graph */}
              {currentTab === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Grafo de Dependências
                  </Typography>
                  
                  <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Caminho Crítico
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {result.dependencyGraph.criticalPath.map((ticketNum) => (
                        <Chip
                          key={ticketNum}
                          label={`Ticket #${ticketNum}`}
                          color="error"
                          size="small"
                        />
                      ))}
                    </Stack>
                  </Card>

                  <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Grupos Paralelos
                    </Typography>
                    {result.dependencyGraph.parallelGroups.map((group, index) => (
                      <Box key={index} sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Grupo {index + 1}:
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                          {group.map((ticketNum) => (
                            <Chip
                              key={ticketNum}
                              label={`Ticket #${ticketNum}`}
                              color="success"
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Stack>
                      </Box>
                    ))}
                  </Card>

                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Bloqueadores
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Tickets que bloqueiam outros tickets:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {result.dependencyGraph.blockers.map((ticketNum) => (
                        <Chip
                          key={ticketNum}
                          label={`Ticket #${ticketNum}`}
                          color="warning"
                          size="small"
                        />
                      ))}
                    </Stack>
                  </Card>
                </Box>
              )}
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
