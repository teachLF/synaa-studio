import ErrorBoundary from '@/components/ErrorBoundary';
import VideoStudio from '@/components/editor/VideoStudio';

export default function HomePage() {
  return (
    <ErrorBoundary>
      <VideoStudio />
    </ErrorBoundary>
  );
}
