import { useNavigate } from 'react-router-dom';
import { Home, Search, Calendar, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50 to-accent-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="relative inline-block">
            <div className="text-9xl font-display font-bold text-neutral-200">404</div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-gradient-to-br from-primary-500 to-accent-500 p-8 rounded-3xl animate-bounce">
                <Search className="w-16 h-16 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-neutral-900 mb-4">
            Page Not Found
          </h1>
          <p className="text-lg md:text-xl text-neutral-600 mb-2">
            Oops! The page you're looking for doesn't exist.
          </p>
          <p className="text-neutral-600">
            It might have been moved, deleted, or the link may be incorrect.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary flex items-center gap-2"
          >
            <Home className="w-5 h-5" />
            Go to Home
          </button>
          
          <button
            onClick={() => navigate(-1)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>

        {/* Suggestions */}
        <div className="mt-12 p-6 bg-white rounded-2xl shadow-lg border border-neutral-100">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            What you can do:
          </h3>
          <div className="grid sm:grid-cols-3 gap-4 text-left">
            <div className="p-4 bg-primary-50 rounded-xl">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center mb-3">
                <Home className="w-5 h-5 text-white" />
              </div>
              <h4 className="font-semibold text-neutral-900 mb-1">Visit Home</h4>
              <p className="text-sm text-neutral-600">
                Go back to the homepage and explore our features
              </p>
            </div>

            <div className="p-4 bg-accent-50 rounded-xl">
              <div className="w-10 h-10 bg-accent-500 rounded-lg flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h4 className="font-semibold text-neutral-900 mb-1">Create Event</h4>
              <p className="text-sm text-neutral-600">
                Start planning your next event with Plan It
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-xl">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mb-3">
                <Search className="w-5 h-5 text-white" />
              </div>
              <h4 className="font-semibold text-neutral-900 mb-1">Check URL</h4>
              <p className="text-sm text-neutral-600">
                Make sure the web address is correct
              </p>
            </div>
          </div>
        </div>

        {/* Footer Message */}
        <div className="mt-8 text-sm text-neutral-500">
          <p>
            Need help? Contact us at{' '}
            <a href="mailto:planit.userhelp@gmail.com" className="text-primary-600 hover:text-primary-700 font-medium">
              planit.userhelp@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
