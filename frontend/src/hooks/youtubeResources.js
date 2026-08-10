import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../api';

const YOUTUBE_TOPIC_LIMIT = 6;
const REQUEST_DEBOUNCE_MS = 350;

export function useYouTubeResources(searchRequest) {
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const requestKey = searchRequest?.key || 0;
  const searchTopics = useMemo(() => searchRequest?.topics || [], [searchRequest]);
  const limitedTopics = useMemo(() => searchTopics.slice(0, YOUTUBE_TOPIC_LIMIT), [searchTopics]);
  const requestBody = useMemo(() => JSON.stringify({ topics: limitedTopics }), [limitedTopics]);

  useEffect(() => {
    if (!requestKey || !limitedTopics.length) {
      setResources([]);
      setIsLoading(false);
      setError('');
      return;
    }

    const controller = new window.AbortController();

    async function loadResources() {
      setIsLoading(true);
      setError('');
      setResources([]);

      try {
        const response = await fetch(apiUrl('/api/youtube-resources/'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load video suggestions.');
        }

        const nextResources = Array.isArray(data.resources) ? data.resources : [];
        setResources(nextResources);

        if (data.configured === false) {
          setError(data.message || 'Add YOUTUBE_API_KEY to enable video search.');
        } else if (Array.isArray(data.errors) && data.errors.length > 0) {
          setError(data.errors[0] || 'Video suggestions are temporarily unavailable.');
        } else if (!nextResources.length) {
          setError('No video matches found for the current selections yet.');
        }
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          return;
        }

        setResources([]);
        setError(fetchError.message || 'Failed to load video suggestions.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    const timer = window.setTimeout(loadResources, REQUEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [limitedTopics, requestBody, requestKey]);

  return { resources, isLoading, error, topicLimit: YOUTUBE_TOPIC_LIMIT };
}
