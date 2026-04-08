'use client'
export default function TimesheetLogPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Timesheet Log</h1>
        <p className="text-sm text-zinc-400 mt-1">Log and review consulting time entries</p>
      </div>
      <div className="border border-zinc-800 rounded-lg p-8 text-center">
        <div className="text-3xl mb-3">⏱</div>
        <p className="text-zinc-400 text-sm font-medium">Timesheet log</p>
        <p className="text-zinc-600 text-xs mt-2">Time entry logging for KSP-001 and other consulting engagements.</p>
      </div>
    </div>
  )
}
