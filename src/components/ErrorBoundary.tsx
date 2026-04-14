import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 24px',
          textAlign: 'center',
          background: '#FFF5F5',
          border: '1px solid #FED7D7',
          borderRadius: '8px',
          margin: '20px',
        }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#C53030', marginBottom: '8px' }}>
            Something went wrong
          </div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px', fontFamily: 'monospace' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </div>
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 20px',
              background: '#0078d4',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
