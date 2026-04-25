import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, errorMessage: null };

  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };

  }

  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary]', error, info);

  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Ocorreu um erro inesperado</Text>
          <Text style={styles.message}>{this.state.errorMessage}</Text>
          <Button title="Tentar novamente" onPress={this.handleReset} />
        </View>
      );
  
  }

    return this.props.children;

  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, marginBottom: 16, textAlign: 'center' },
});
