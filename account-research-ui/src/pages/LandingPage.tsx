// FILE: account-research-ui/src/pages/LandingPage.tsx
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Rocket, History } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-primary text-foreground p-6 text-center"> {/* Use theme colors */}
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 leading-tight">
        Account Research <span className="text-lime">AI Agent</span> {/* Highlight AI */}
      </h1>
      <p className="text-lg md:text-xl text-gray-lt max-w-2xl mb-10">
        Generate comprehensive, multi-lingual company insight reports powered by AI. Get started in minutes.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <Link to="/generate">
          {/* Use accent color for primary button */}
          <Button size="lg" className="bg-lime text-primary hover:bg-lime/90 font-semibold px-8 py-3 text-lg rounded-lg transition duration-300 ease-in-out transform hover:scale-105 flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            Start a New Report
          </Button>
        </Link>

        <Link to="/history">
          {/* Use secondary/outline style for history button */}
          <Button variant="outline" size="lg" className="text-white border-gray-dk hover:bg-navy hover:border-lime hover:text-lime font-semibold px-8 py-3 text-lg rounded-lg transition duration-300 ease-in-out flex items-center gap-2">
            <History className="w-5 h-5" />
            View History
          </Button>
        </Link>
      </div>

    </main>
  );
}