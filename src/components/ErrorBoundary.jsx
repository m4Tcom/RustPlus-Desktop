import { Component } from 'react'

// Catches render errors in the active page so one bad component shows a
// recoverable message instead of white-screening the whole app. Reset it by
// passing a changing `resetKey` (we key it on the current tab) or by clicking
// "try again". Error boundaries must be class components.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ui-error]', error, info?.componentStack)
  }

  componentDidUpdate(prev) {
    // Clear the error when the caller swaps resetKey (e.g. user changes tab).
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center bg-rust-card border border-black/30 rounded-xl p-6">
            <div className="text-rust-accent font-semibold mb-2">
              {this.props.title || 'Something went wrong'}
            </div>
            <p className="text-sm text-gray-400 mb-4 break-words">
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-3 py-1.5 rounded-lg bg-rust-bg border border-black/40 text-sm text-gray-200 hover:border-rust-accent"
            >
              {this.props.retryLabel || 'Try again'}
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
