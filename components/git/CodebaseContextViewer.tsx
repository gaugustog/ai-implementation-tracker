'use client';

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Grid,
} from '@mui/material';
import {
  ExpandMore,
  Code,
  InsertChart,
  Architecture,
  Folder,
  Description,
} from '@mui/icons-material';

interface CodebaseContextViewerProps {
  context: {
    techStack?: {
      languages: string[];
      frameworks: string[];
      buildTools: string[];
      packageManagers: string[];
    };
    patterns?: {
      namingConventions: string[];
      architecturePattern: string;
      testingStrategy: string;
    };
    integrationPoints?: Array<{ file: string; purpose: string }>;
    fileStructure?: Record<string, unknown>;
    metrics?: {
      totalFiles: number;
      languageBreakdown: Record<string, number>;
    };
  };
  lastAnalyzedAt?: string;
}

export function CodebaseContextViewer({ context, lastAnalyzedAt }: CodebaseContextViewerProps) {
  const [expanded, setExpanded] = useState<string | false>('techStack');

  const handleChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Code sx={{ mr: 1 }} />
            <Typography variant="h6">Codebase Context</Typography>
          </Box>
          {lastAnalyzedAt && (
            <Typography variant="caption" color="text.secondary">
              Last analyzed: {new Date(lastAnalyzedAt).toLocaleString()}
            </Typography>
          )}
        </Box>

        {/* Tech Stack Section */}
        <Accordion expanded={expanded === 'techStack'} onChange={handleChange('techStack')}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Code sx={{ mr: 1 }} />
              <Typography>Technology Stack</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              {context.techStack?.languages && context.techStack.languages.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Languages
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {context.techStack.languages.map((lang) => (
                      <Chip key={lang} label={lang} size="small" color="primary" />
                    ))}
                  </Stack>
                </Box>
              )}

              {context.techStack?.frameworks && context.techStack.frameworks.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Frameworks
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {context.techStack.frameworks.map((framework) => (
                      <Chip key={framework} label={framework} size="small" color="secondary" />
                    ))}
                  </Stack>
                </Box>
              )}

              {context.techStack?.buildTools && context.techStack.buildTools.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Build Tools
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {context.techStack.buildTools.map((tool) => (
                      <Chip key={tool} label={tool} size="small" />
                    ))}
                  </Stack>
                </Box>
              )}

              {context.techStack?.packageManagers && context.techStack.packageManagers.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Package Managers
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {context.techStack.packageManagers.map((pm) => (
                      <Chip key={pm} label={pm} size="small" />
                    ))}
                  </Stack>
                </Box>
              )}

              {!context.techStack?.languages?.length &&
                !context.techStack?.frameworks?.length &&
                !context.techStack?.buildTools?.length && (
                  <Typography variant="body2" color="text.secondary">
                    No tech stack information available
                  </Typography>
                )}
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Patterns Section */}
        <Accordion expanded={expanded === 'patterns'} onChange={handleChange('patterns')}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Architecture sx={{ mr: 1 }} />
              <Typography>Code Patterns</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              {context.patterns?.architecturePattern && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Architecture Pattern
                  </Typography>
                  <Typography variant="body1">{context.patterns.architecturePattern}</Typography>
                </Box>
              )}

              {context.patterns?.testingStrategy && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Testing Strategy
                  </Typography>
                  <Typography variant="body1">{context.patterns.testingStrategy}</Typography>
                </Box>
              )}

              {!context.patterns?.architecturePattern && !context.patterns?.testingStrategy && (
                <Typography variant="body2" color="text.secondary">
                  No pattern information available
                </Typography>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Integration Points Section */}
        <Accordion expanded={expanded === 'integration'} onChange={handleChange('integration')}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Folder sx={{ mr: 1 }} />
              <Typography>Integration Points</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {context.integrationPoints && context.integrationPoints.length > 0 ? (
              <List dense>
                {context.integrationPoints.map((point, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={point.file}
                      secondary={point.purpose}
                      primaryTypographyProps={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No integration points identified
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Metrics Section */}
        {context.metrics && (
          <Accordion expanded={expanded === 'metrics'} onChange={handleChange('metrics')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <InsertChart sx={{ mr: 1 }} />
                <Typography>Code Metrics</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Total Files
                    </Typography>
                    <Typography variant="h4">{context.metrics.totalFiles}</Typography>
                  </Box>
                </Grid>

                {context.metrics.languageBreakdown &&
                  Object.keys(context.metrics.languageBreakdown).length > 0 && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Language Breakdown
                      </Typography>
                      <List dense>
                        {Object.entries(context.metrics.languageBreakdown).map(([ext, count]) => (
                          <ListItem key={ext}>
                            <ListItemText
                              primary={ext || 'No extension'}
                              secondary={`${count} files`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Grid>
                  )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
            <Description sx={{ mr: 1, fontSize: '1rem' }} />
            <Typography variant="caption" color="text.secondary">
              This context is automatically used when generating specifications to ensure they align
              with your codebase&apos;s existing patterns, technologies, and architecture.
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
