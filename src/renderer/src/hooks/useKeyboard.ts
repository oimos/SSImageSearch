import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function useGlobalShortcuts(): void {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key === 'n') {
        e.preventDefault()
        navigate('/workspace')
      }
      if (mod && e.key === 'h') {
        e.preventDefault()
        navigate('/history')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
