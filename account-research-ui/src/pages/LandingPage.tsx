import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

/** Public home‑page – acts as a simple hero + CTA */
export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-6">
      <h1 className="text-5xl font-extrabold text-center mb-4">
        Account&nbsp;Research&nbsp;<span className="text-lime-green">AI</span>&nbsp;Agent
      </h1>
      <p className="text-lg text-light-gray/90 max-w-xl text-center mb-10">
        Generate beautifully‑formatted, multi‑lingual company insight reports in minutes.
      </p>

      <Link to="/generate">
        <Button className="bg-lime-green text-black px-8 py-3 text-lg rounded-lg hover:bg-light-lime transition">
          Start a new report
        </Button>
      </Link>

      <Link
        to="/history"
        className="mt-6 text-soft-blue hover:underline text-sm tracking-wide"
      >
        View previous reports →
      </Link>
    </main>
  );
}
