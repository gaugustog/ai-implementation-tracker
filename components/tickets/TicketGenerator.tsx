'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Alert,
  Chip,
  Stack,
  Divider,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { GeneratedTicket, TicketGeneration } from '@/lib/types';

interface TicketGeneratorProps {
  specificationId: string;
  specificationContent: string;
  projectContext?: any;
  onComplete?: (generation: TicketGeneration) => void;
}

export function TicketGenerator({
  specificationId,
  specificationContent,
  projectContext,
  onComplete,
}: TicketGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress('Iniciando geração de tickets...');
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/tickets/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          specificationId,
          specificationContent,
          projectContext,
          language: 'pt-BR',
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar tickets');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      setProgress('Geração concluída!');

      if (onComplete) {
        onComplete(data);
      }
    } catch (err) {
      console.error('Error generating tickets:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsGenerating(false);
    }
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

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Geração Inteligente de Tickets
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Utilize IA para quebrar a especificação em tickets implementáveis de 1-3 dias,
            com análise de dependências e otimização de paralelização.
          </Typography>

          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleGenerate}
            disabled={isGenerating}
            fullWidth
          >
            {isGenerating ? 'Gerando Tickets...' : 'Gerar Tickets com IA'}
          </Button>

          {isGenerating && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                {progress}
              </Typography>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }} icon={<ErrorIcon />}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <Box>
          <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircleIcon />}>
            Tickets gerados com sucesso! {result.tickets?.length || 0} tickets criados.
          </Alert>

          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 300px' }}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="primary">
                    {result.tickets?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total de Tickets
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: '1 1 300px' }}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="primary">
                    {result.tokensUsed?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tokens Utilizados
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: '1 1 300px' }}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="primary">
                    ${result.totalCost?.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Custo Estimado
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <DescriptionIcon color="primary" />
                <Typography variant="h6">Documentos Gerados</Typography>
              </Stack>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    SUMMARY.md
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {result.summaryPath}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    EXECUTION_PLAN.md
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {result.executionPlanPath}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Typography variant="h6" sx={{ mb: 2 }}>
            Tickets Gerados
          </Typography>

          <Stack spacing={2}>
            {result.tickets?.map((ticket: GeneratedTicket, index: number) => (
              <Card key={index}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
                    <Typography variant="h6" sx={{ flex: 1 }}>
                      {ticket.title}
                    </Typography>
                    <Chip
                      label={ticket.complexity}
                      size="small"
                      color={getComplexityColor(ticket.complexity) as any}
                    />
                  </Stack>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {ticket.description}
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                    <Chip
                      label={`${ticket.estimatedHours}h`}
                      size="small"
                      variant="outlined"
                    />
                    {ticket.parallelizable && (
                      <Chip label="Paralelizável" size="small" color="info" variant="outlined" />
                    )}
                    {ticket.aiAgentCapable && (
                      <Chip label="IA Capable" size="small" color="success" variant="outlined" />
                    )}
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" gutterBottom>
                    Critérios de Aceitação:
                  </Typography>
                  <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                    {ticket.acceptanceCriteria.map((criteria, idx) => (
                      <Typography component="li" variant="body2" key={idx} sx={{ mb: 0.5 }}>
                        {criteria}
                      </Typography>
                    ))}
                  </Box>

                  {ticket.dependencies.length > 0 && (
                    <>
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                        Dependências:
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {ticket.dependencies.map((dep, idx) => (
                          <Chip key={idx} label={dep} size="small" />
                        ))}
                      </Stack>
                    </>
                  )}

                  {ticket.requiredExpertise.length > 0 && (
                    <>
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                        Expertise Necessária:
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {ticket.requiredExpertise.map((exp, idx) => (
                          <Chip key={idx} label={exp} size="small" color="secondary" />
                        ))}
                      </Stack>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
