import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'

interface LocationState {
  pathname: string
  timestamp: number
}

const navigationHistory: LocationState[] = []
const MAX_HISTORY = 50

export function useNavigationHistory() {
  const location = useLocation()

  useEffect(() => {
    navigationHistory.push({
      pathname: location.pathname,
      timestamp: Date.now(),
    })

    if (navigationHistory.length > MAX_HISTORY) {
      navigationHistory.shift()
    }
  }, [location.pathname])

  return navigationHistory
}

export function useBackNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const historyRef = useRef<LocationState[]>([])

  useEffect(() => {
    // Add current location to history
    if (
      !historyRef.current.length ||
      historyRef.current[historyRef.current.length - 1].pathname !==
        location.pathname
    ) {
      historyRef.current.push({
        pathname: location.pathname,
        timestamp: Date.now(),
      })

      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.shift()
      }
    }
  }, [location.pathname])

  const canGoBack = historyRef.current.length > 1

  const goBack = () => {
    if (canGoBack) {
      // Remove current location and go back
      historyRef.current.pop()
      const previousLocation = historyRef.current[
        historyRef.current.length - 1
      ]
      navigate(previousLocation.pathname)
    } else {
      // Fallback to home page if no history
      navigate('/')
    }
  }

  return { goBack, canGoBack }
}
