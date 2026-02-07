const searchParams = useSearchParams()
const router = useRouter()
const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(
  searchParams.get('apt') || null
)

// Sync selectedAppointmentId to URL so refresh preserves the open chart
useEffect(() => {
  const currentApt = searchParams.get('apt') || null
  if (selectedAppointmentId !== currentApt) {
    const url = new URL(window.location.href)
    if (selectedAppointmentId) {
      url.searchParams.set('apt', selectedAppointmentId)
    } else {
      url.searchParams.delete('apt')
    }
    router.replace(url.pathname + url.search, { scroll: false })
  }
}, [selectedAppointmentId])




























