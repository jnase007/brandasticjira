import { Component } from 'react'

// Error boundary to catch and gracefully handle component errors
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Component error caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // Return fallback or null to hide the broken component
      return this.props.fallback || null
    }

    return this.props.children
  }
}

// Simple wrapper for 100x feature components that might fail
export function SafeComponent({ children, fallback = null }) {
  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  )
}

export default ErrorBoundary
