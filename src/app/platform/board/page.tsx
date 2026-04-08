'use client'
export default function BoardPackPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Board Pack</h1>
        <p className="text-sm text-zinc-400 mt-1">Generate and manage board-ready documents</p>
      </div>
      <div className="border border-zinc-800 rounded-lg p-8 text-center">
        <div className="text-3xl mb-3">📋</div>
        <p className="text-zinc-400 text-sm font-medium">Board Pack generator</p>
        <p className="text-zinc-600 text-xs mt-2">Assemble board-ready packs from your PIOS data. Available in the Executive module.</p>
      </div>
    </div>
  )
}
