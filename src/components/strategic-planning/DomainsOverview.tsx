'use client'

type DomainItem = {
	id: string
	domain_name: string
	description?: string
	priority_rank?: number
}

type DomainsOverviewProps = {
	domains?: DomainItem[]
	selectedDomainId?: string | null
	onSelectDomain?: (domainId: string) => void
}

export function DomainsOverview({
	domains = [],
	selectedDomainId = null,
	onSelectDomain,
}: DomainsOverviewProps) {
	if (domains.length === 0) {
		return (
			<div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
				No domains yet. Add your first strategic domain to get started.
			</div>
		)
	}

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{domains.map((domain) => {
				const isSelected = selectedDomainId === domain.id

				return (
					<button
						key={domain.id}
						type="button"
						onClick={() => onSelectDomain?.(domain.id)}
						className={`rounded-lg border p-4 text-left transition ${
							isSelected
								? 'border-blue-500 bg-blue-50'
								: 'border-slate-200 bg-white hover:border-slate-300'
						}`}
					>
						<div className="text-base font-semibold text-slate-900">{domain.domain_name}</div>
						{domain.description ? (
							<div className="mt-2 text-sm text-slate-600">{domain.description}</div>
						) : null}
						<div className="mt-3 text-xs text-slate-500">
							Priority: {domain.priority_rank ?? '-'}
						</div>
					</button>
				)
			})}
		</div>
	)
}

export default DomainsOverview