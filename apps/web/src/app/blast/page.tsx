'use client';

import React from 'react';
import { BlastDispatcher } from '@/components/blast/BlastDispatcher';
import { PageLayout } from '@/components/layout/PageLayout';

export default function BlastPage() {
  return (
    <PageLayout
      title="CSV Blast"
      description="Ingest CSV contact lists with client-side E.164 verification, duplicate detection, and opt-out suppression gates."
      width="wide"
    >
      <BlastDispatcher />
    </PageLayout>
  );
}
