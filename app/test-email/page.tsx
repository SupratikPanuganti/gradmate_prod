'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase'

const LAMBDA_URL = 'https://53dhwuhsl8.execute-api.us-east-2.amazonaws.com/default/gradmate-ai-service';

export default function TestEmailPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);

  const testEmailGeneration = async () => {
    setLoading(true);
    setError(null);
    setDebug(null);
    try {
      const apiKey = process.env.NEXT_PUBLIC_AI_SERVICE_KEY;
      setDebug(`API Key present: ${!!apiKey}\nURL: ${LAMBDA_URL}`);

      // Grab current user ID (if logged in)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Build the request body.  We will attempt to pull profile fields from Supabase
      // so the Lambda has richer context.  If any field is missing we fall back to
      // sensible placeholders so the request always succeeds.
      const requestBody: Record<string, any> = {
        lab_title: 'Test Lab',
        professors: ['Dr. A'],
      };

      if (user?.id) {
        requestBody.user_id = user.id;

        // Fetch the user's profile (mirrors logic on /profile page)
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('name, school, major')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('Unable to fetch profile for request body:', error);
        }

        requestBody.student_name = profile?.name || 'Student';
        requestBody.school = profile?.school || 'Unknown University';
        requestBody.student_major = profile?.major || 'Undeclared';
      } else {
        // Not logged in; use placeholders
        requestBody.student_name = 'Student';
        requestBody.school = 'Unknown University';
        requestBody.student_major = 'Undeclared';
      }

      setDebug(prev => `${prev}\nRequest body: ${JSON.stringify(requestBody, null, 2)}`);

      const response = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || '',
        },
        body: JSON.stringify(requestBody),
      }).catch(err => {
        setDebug(prev => `${prev}\nFetch error: ${err.message}`);
        throw err;
      });

      setDebug(prev => `${prev}\nResponse status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        setDebug(prev => `${prev}\nError response: ${errorText}`);
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      setDebug(prev => `${prev}\nResponse template: ${data.template_used}`);
    } catch (err) {
      console.error('Full error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setDebug(prev => `${prev}\nError details: ${JSON.stringify(err, null, 2)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Test Email Generation</h1>
      <button
        onClick={testEmailGeneration}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
      >
        {loading ? 'Generating...' : 'Generate Test Email'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {debug && (
        <div className="mt-4 p-4 bg-gray-100 text-gray-700 rounded">
          <h2 className="text-xl font-semibold mb-2">Debug Info:</h2>
          <pre className="whitespace-pre-wrap">{debug}</pre>
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Email Preview:</h2>
            <pre className="bg-green-50 whitespace-pre-wrap p-4 rounded max-h-96 overflow-auto">
              {result.email}
            </pre>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Raw JSON:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
} 