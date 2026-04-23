import { ProposalWorkbench } from '@/components/proposals/ProposalWorkbench';

export default async function PlatformProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProposalWorkbench proposalId={id} />;
}
