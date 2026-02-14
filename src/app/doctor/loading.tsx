export default function DoctorLoading() {
  return (
    <div className="h-full bg-[#0a1f1f] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-400 mx-auto mb-4" />
        <p className="text-sm text-gray-400 font-medium">Loading...</p>
      </div>
    </div>
  )
}
