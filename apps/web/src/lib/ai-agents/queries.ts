'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateAiAgentRequest } from '@vynor/contracts';
import { localAiAgentRepository as repository } from './repository';

export const aiAgentKeys = {
  all: ['ai-agents'] as const,
  detail: (id: string) => ['ai-agents', id] as const,
};

export function useAiAgents() {
  return useQuery({ queryKey: aiAgentKeys.all, queryFn: () => repository.list() });
}

export function useAiAgent(id: string) {
  return useQuery({ queryKey: aiAgentKeys.detail(id), queryFn: () => repository.get(id) });
}

function useInvalidateAgents() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: aiAgentKeys.all });
}

export function useCreateAiAgent() {
  const invalidate = useInvalidateAgents();
  return useMutation({
    mutationFn: (name: string) => repository.create({ name }),
    onSuccess: invalidate,
  });
}

export function useUpdateAiAgent() {
  const invalidate = useInvalidateAgents();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateAiAgentRequest }) =>
      repository.update(id, patch),
    onSuccess: invalidate,
  });
}

export function useDuplicateAiAgent() {
  const invalidate = useInvalidateAgents();
  return useMutation({
    mutationFn: (id: string) => repository.duplicate(id),
    onSuccess: invalidate,
  });
}

export function useDeleteAiAgent() {
  const invalidate = useInvalidateAgents();
  return useMutation({ mutationFn: (id: string) => repository.remove(id), onSuccess: invalidate });
}
