import { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

export default function Countdown({ eventDate }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast: false
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(eventDate) - new Date();
      
      if (difference <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isPast: true
        });
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isPast: false
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [eventDate]);

  const TimeUnit = ({ value, label }) => (
    <div className="flex flex-col items-center">
      <div className="text-3xl md:text-4xl font-bold text-neutral-900 tabular-nums">
        {String(value).padStart(2, '0')}
      </div>
      <div className="text-xs text-neutral-500 uppercase tracking-wide mt-1">{label}</div>
    </div>
  );

  if (timeLeft.isPast) {
    return (
      <div className="card p-6 bg-gradient-to-br from-emerald-50 to-green-50 text-center">
        <div className="flex items-center justify-center gap-2 text-emerald-700 mb-2">
          <Calendar className="w-5 h-5" />
          <span className="font-semibold">Event is Live!</span>
        </div>
        <p className="text-sm text-neutral-600">
          {new Date(eventDate).toLocaleString()}
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="flex items-center justify-center gap-2 text-neutral-700 mb-4">
        <Clock className="w-5 h-5" />
        <span className="font-semibold">Time Until Event</span>
      </div>
      
      <div className="grid grid-cols-4 gap-4 md:gap-6">
        <TimeUnit value={timeLeft.days} label="Days" />
        <TimeUnit value={timeLeft.hours} label="Hours" />
        <TimeUnit value={timeLeft.minutes} label="Mins" />
        <TimeUnit value={timeLeft.seconds} label="Secs" />
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-200 text-center text-sm text-neutral-600">
        {new Date(eventDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })}
      </div>
    </div>
  );
}
