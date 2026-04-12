'use client'
type VisionEditorProps = {
  domainId: string
  onBack: () => void
}

export function VisionEditor({ domainId, onBack }: VisionEditorProps) {
  void domainId
  return <div><button onClick={onBack} className="text-blue-600 mb-4">Back</button><h2 className="text-4xl font-bold">Vision Editor</h2><p className="text-gray-600">Coming Week 2</p></div>
}
