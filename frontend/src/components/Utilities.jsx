import { useState } from 'react';
import { QrCode, Calendar, Download, Share2, Copy, Check, Link as LinkIcon } from 'lucide-react';
import { utilityAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function Utilities({ eventId, subdomain, isOrganizer }) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  
  const eventUrl = subdomain
    ? `${window.location.origin}/e/${subdomain}`
    : `${window.location.origin}/event/${eventId}`;

  const qrCodeUrl = utilityAPI.generateQRCode(eventUrl);

  const copyLink = () => {
    navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCalendar = () => {
    const token = localStorage.getItem('eventToken');
    utilityAPI.downloadCalendar(eventId, token);
    toast.success('Calendar file downloading');
  };

  const downloadParticipants = () => {
    const token = localStorage.getItem('eventToken');
    utilityAPI.downloadParticipants(eventId, token);
    toast.success('Participant list downloading');
  };

  const shareEvent = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Event Invitation',
          text: 'Join this event!',
          url: eventUrl
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          copyLink();
        }
      }
    } else {
      copyLink();
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <Share2 className="w-6 h-6" />
            Share & Export
          </h2>
          <p className="text-neutral-500 mt-1">Share the event or export data</p>
        </div>

        {/* Event Link */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Event Link
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={eventUrl}
              className="input flex-1 bg-neutral-50 font-mono text-sm"
            />
            <button onClick={copyLink} className="btn btn-primary">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={shareEvent} className="btn">
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>

        {/* QR Code */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            QR Code
          </h3>
          <p className="text-neutral-500 mb-4">
            Let people scan this code to join the event instantly
          </p>
          
          <button
            onClick={() => setShowQR(!showQR)}
            className="btn btn-primary mb-4"
          >
            <QrCode className="w-4 h-4" />
            {showQR ? 'Hide QR Code' : 'Show QR Code'}
          </button>

          {showQR && (
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white border-2 border-neutral-200 rounded-lg">
                <img
                  src={qrCodeUrl}
                  alt="Event QR Code"
                  className="w-64 h-64"
                />
              </div>
              <a
                href={qrCodeUrl}
                download="event-qr-code.png"
                className="btn btn-sm"
              >
                <Download className="w-4 h-4" />
                Download QR Code
              </a>
            </div>
          )}
        </div>

        {/* Calendar Export */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Add to Calendar
          </h3>
          <p className="text-neutral-500 mb-4">
            Download an .ics file to add this event to your calendar app
          </p>
          <button onClick={downloadCalendar} className="btn btn-primary">
            <Download className="w-4 h-4" />
            Download Calendar File
          </button>
          <p className="text-xs text-neutral-400 mt-2">
            Compatible with Google Calendar, Apple Calendar, Outlook, and more
          </p>
        </div>

        {/* Participant Export (Organizer Only) */}
        {isOrganizer && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export Participant List
            </h3>
            <p className="text-neutral-500 mb-4">
              Download a CSV file with all participant information
            </p>
            <button onClick={downloadParticipants} className="btn btn-primary">
              <Download className="w-4 h-4" />
              Download CSV
            </button>
            <p className="text-xs text-neutral-400 mt-2">
              Includes usernames, roles, join times, and RSVP status
            </p>
          </div>
        )}

        {/* Social Sharing Tips */}
        <div className="card p-6 bg-gradient-to-br from-blue-50 to-purple-50">
          <h3 className="text-lg font-semibold text-neutral-900 mb-3">
            💡 Sharing Tips
          </h3>
          <ul className="space-y-2 text-sm text-neutral-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Share the link via email, text, or social media</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 font-bold">•</span>
              <span>Print the QR code for physical event invitations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-600 font-bold">•</span>
              <span>Send the calendar file so attendees don't forget</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 font-bold">•</span>
              <span>Display the QR code at your event entrance for easy check-in</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
