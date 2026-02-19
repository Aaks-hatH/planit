import { useState } from 'react';
import { QrCode, Calendar, Download, Share2, Copy, Check, Link as LinkIcon, UserCheck, Users } from 'lucide-react';
import { utilityAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Utilities({ eventId, subdomain, isOrganizer, isEnterpriseMode }) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const navigate = useNavigate();
  
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
        {/* Enterprise Mode Banner */}
        {isEnterpriseMode && isOrganizer && (
          <div className="card p-6 bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-700 shadow-xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-1">Enterprise Event Management</h3>
                <p className="text-sm text-blue-100">Manage personalized invites, track RSVPs, and check in guests with QR codes</p>
              </div>
            </div>
            <button 
              onClick={() => navigate(`/event/${eventId}/checkin`)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-lg font-bold text-base hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl"
            >
              <UserCheck className="w-5 h-5" />
              Open Check-in Dashboard
            </button>
            <div className="mt-4 pt-4 border-t border-white/20">
              <p className="text-xs text-blue-100 mb-2 font-medium">Quick Actions:</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-blue-50">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                  <span>Add guests with group sizes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                  <span>Send personalized invite links</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                  <span>Scan QR codes at entrance</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                  <span>View real-time attendance</span>
                </div>
              </div>
            </div>
          </div>
        )}

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
