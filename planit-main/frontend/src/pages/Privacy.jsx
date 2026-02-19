import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

const LAST_UPDATED = 'February 17, 2026';

function Section({ number, title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-100">
        {number}. {title}
      </h2>
      <div className="space-y-4 text-neutral-700 leading-relaxed text-sm">
        {children}
      </div>
    </section>
  );
}

function Sub({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-800 mb-2">{title}</h3>
      <div className="space-y-2 text-neutral-700 leading-relaxed text-sm">{children}</div>
    </div>
  );
}

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="btn btn-secondary p-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-neutral-900 p-2 rounded-xl">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-neutral-900">Privacy Policy</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 md:p-12">

          <div className="mb-10">
            <h1 className="text-3xl font-bold text-neutral-900 mb-3">Privacy Policy</h1>
            <p className="text-sm text-neutral-500">Last updated: {LAST_UPDATED}</p>
            <div className="mt-4 p-4 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-600 leading-relaxed">
              This Privacy Policy describes how PlanIt ("we", "us", or "our") collects, uses, stores, and protects
              information when you use the PlanIt event planning platform, accessible at our website and as a
              Progressive Web App (collectively, the "Service"). Please read it carefully before using the Service.
            </div>
          </div>

          <Section number="1" title="Who We Are">
            <p>
              PlanIt is an event planning and collaboration platform that allows organizers to create event workspaces
              and invite participants to collaborate in real time. The Service is operated by Aakshat Hariharan.
            </p>
            <p>
              For any privacy-related questions or requests, you can contact us at:{' '}
              <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 font-medium underline underline-offset-2">
                planit.userhelp@gmail.com
              </a>
            </p>
          </Section>

          <Section number="2" title="Information We Collect">
            <Sub title="2.1 Information You Provide Directly">
              <p>When you use PlanIt, you voluntarily provide the following information:</p>
              <ul className="list-disc list-inside space-y-1.5 ml-3 mt-2">
                <li><strong>Organizer details:</strong> Your name and email address when creating an event. This is used to identify you as the event organizer and to send you the event confirmation.</li>
                <li><strong>Event information:</strong> The event title, description, date, time, timezone, and location that you provide when setting up an event space.</li>
                <li><strong>Passwords:</strong> Event-level passwords and participant account passwords are hashed using bcrypt before storage. We never store plaintext passwords and cannot retrieve them.</li>
                <li><strong>Participant usernames:</strong> The display name you choose when joining an event. This name is visible to all other participants in that event.</li>
                <li><strong>Chat messages:</strong> All messages you send within an event chat, including any text content and emoji reactions.</li>
                <li><strong>Poll responses:</strong> Your votes on polls created within an event.</li>
                <li><strong>Files and media:</strong> Any files you upload and share within an event space.</li>
                <li><strong>Tasks, notes, and expenses:</strong> Any content you create within the task, notes, or expense tracking features of an event.</li>
                <li><strong>RSVP status:</strong> Your attendance response (going, maybe, or not going) for an event.</li>
                <li><strong>Support messages:</strong> Any messages you submit through our support contact form, including your name, email, and message content.</li>
              </ul>
              <p className="mt-2">
                For Enterprise mode events, additional information may be collected as part of the guest invite and
                check-in process, including guest contact details, age group, and any notes added by the event organizer.
              </p>
            </Sub>

            <Sub title="2.2 Information Collected Automatically">
              <p>When you access the Service, certain information is collected automatically by our servers and infrastructure:</p>
              <ul className="list-disc list-inside space-y-1.5 ml-3 mt-2">
                <li><strong>IP address:</strong> Collected for rate limiting, anti-abuse, and security purposes. We apply rate limiting to event creation and authentication endpoints using your IP address to prevent automated abuse.</li>
                <li><strong>Device and browser information:</strong> Browser type, operating system, and device type, collected passively through standard HTTP headers.</li>
                <li><strong>Usage data:</strong> Which features you use within an event space, and general activity patterns used for improving the Service.</li>
                <li><strong>Connection data:</strong> WebSocket connection status for real-time presence features (showing who is currently online in an event).</li>
                <li><strong>Error and performance logs:</strong> Technical logs generated when errors occur, used solely for debugging and maintaining Service stability.</li>
              </ul>
            </Sub>

            <Sub title="2.3 Information We Do Not Collect">
              <p>PlanIt does not collect:</p>
              <ul className="list-disc list-inside space-y-1.5 ml-3 mt-2">
                <li>Payment or financial information of any kind. PlanIt is a free service and does not process payments.</li>
                <li>Government-issued identification numbers or biometric data.</li>
                <li>Precise geolocation data from your device.</li>
                <li>Contact lists or address books from your device.</li>
              </ul>
            </Sub>
          </Section>

          <Section number="3" title="How We Use Your Information">
            <p>We use the information we collect solely for the following purposes:</p>
            <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
              <li><strong>Providing the Service:</strong> To create and operate event spaces, enable real-time collaboration, manage participants, and deliver all features of the platform.</li>
              <li><strong>Authentication and access control:</strong> To verify organizer identity when logging in from a new device and to enforce event-level password protection where set by the organizer.</li>
              <li><strong>Real-time communication:</strong> To transmit chat messages, poll updates, task changes, and other collaborative content between participants within an event in real time via WebSocket connections.</li>
              <li><strong>Security and anti-abuse:</strong> To detect and prevent fraudulent activity, automated abuse, spam, and misuse of the platform through rate limiting, IP monitoring, and anti-fraud middleware.</li>
              <li><strong>File storage and delivery:</strong> Uploaded files are stored via Cloudinary and served to participants within the same event. Files are not shared across events or accessible to external parties.</li>
              <li><strong>Automated data cleanup:</strong> To delete all event data automatically seven days after the event date, as described in Section 6.</li>
              <li><strong>Support:</strong> To respond to enquiries submitted through our support contact form.</li>
              <li><strong>Service improvement:</strong> To understand how the platform is used in aggregate and improve its features and reliability.</li>
            </ul>
            <p className="mt-3 font-medium text-neutral-800">We do not use your information for advertising, profiling, or sale to third parties under any circumstances.</p>
          </Section>

          <Section number="4" title="How Your Information Is Shared">
            <Sub title="4.1 Within an Event">
              <p>
                Information you submit within an event — including your username, messages, poll votes, RSVP status,
                tasks, expenses, and any files you upload — is visible to all other participants of that same event.
                Event organizers have full visibility of all event content and participant activity within their event.
              </p>
              <p>
                Your information is never shared across separate events. Participants of one event cannot see the content
                of a different event.
              </p>
            </Sub>
            <Sub title="4.2 Third-Party Service Providers">
              <p>We use the following third-party services to operate the platform:</p>
              <ul className="list-disc list-inside space-y-1.5 ml-3 mt-2">
                <li><strong>Cloudinary:</strong> Used to store and serve files that participants upload within event spaces. Files uploaded to PlanIt are transferred to and stored on Cloudinary's infrastructure. Cloudinary's own privacy policy governs their handling of that data.</li>
                <li><strong>MongoDB Atlas:</strong> Our database provider. All event data, messages, participants, polls, and related records are stored in a MongoDB database hosted on MongoDB Atlas infrastructure.</li>
                <li><strong>Render:</strong> Our cloud hosting provider. The PlanIt backend and frontend are deployed on Render's infrastructure.</li>
                <li><strong>Google Fonts:</strong> Font files are loaded from Google's CDN for display purposes. This involves your browser making a request to Google's servers. No personally identifiable information beyond standard HTTP headers (including IP address) is sent as part of this request.</li>
              </ul>
              <p className="mt-2">
                We do not sell, rent, or otherwise share your personal information with any third party for marketing,
                advertising, or commercial purposes.
              </p>
            </Sub>
            <Sub title="4.3 Legal Requirements">
              <p>
                We may disclose your information if required to do so by law, regulation, court order, or governmental
                authority, or where we believe in good faith that disclosure is necessary to protect our rights, protect
                your safety or the safety of others, investigate fraud, or respond to a legal request.
              </p>
            </Sub>
          </Section>

          <Section number="5" title="Data Security">
            <p>
              We implement the following security measures to protect your information:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
              <li><strong>Password hashing:</strong> All passwords (event passwords and participant account passwords) are hashed using bcrypt before being stored. Plaintext passwords are never stored or logged.</li>
              <li><strong>JWT authentication:</strong> Access to event spaces is controlled through JSON Web Tokens scoped to the specific event and participant. Organizer tokens carry elevated permissions and are issued separately.</li>
              <li><strong>HTTPS enforcement:</strong> All data in transit is encrypted using TLS. HTTP Strict Transport Security (HSTS) is enforced with a two-year max age and preload enabled.</li>
              <li><strong>Security headers:</strong> We apply Content Security Policy, X-Frame-Options, X-Content-Type-Options, and referrer policy headers to protect against common web attacks.</li>
              <li><strong>Rate limiting:</strong> Event creation and authentication endpoints are rate-limited to prevent brute-force and automated abuse.</li>
              <li><strong>Anti-fraud middleware:</strong> Sensitive routes are protected by anti-fraud middleware to detect and block suspicious activity.</li>
            </ul>
            <p className="mt-3">
              No method of transmission over the internet and no method of electronic storage is completely secure.
              While we use commercially reasonable means to protect your information, we cannot guarantee absolute
              security. You use the Service at your own risk.
            </p>
          </Section>

          <Section number="6" title="Data Retention and Deletion">
            <Sub title="6.1 Automatic Event Deletion">
              <p>
                PlanIt operates a strict seven-day data retention policy. All data associated with an event —
                including messages, files, polls, tasks, expenses, notes, participant records, and invite data —
                is automatically and permanently deleted seven days after the event date. This deletion process
                runs automatically every day at 2:00 AM.
              </p>
              <p>
                Files stored on Cloudinary are also deleted as part of this process. There is no recovery of data
                after deletion has occurred. Participants are shown a warning banner within the event space as the
                deletion date approaches.
              </p>
            </Sub>
            <Sub title="6.2 Organizer Email Address">
              <p>
                The organizer's email address is stored in the event record. It is deleted along with the rest of
                the event data at the end of the seven-day retention window.
              </p>
            </Sub>
            <Sub title="6.3 Requesting Early Deletion">
              <p>
                If you are an event organizer and wish to have your event and all associated data deleted before
                the automatic seven-day window, you may contact us at{' '}
                <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 font-medium underline underline-offset-2">
                  planit.userhelp@gmail.com
                </a>{' '}
                with the event name and the email address used to create it. We will process the deletion request
                within 48 hours.
              </p>
            </Sub>
          </Section>

          <Section number="7" title="Cookies and Local Storage">
            <p>
              PlanIt does not use third-party advertising or tracking cookies. We use the following browser storage
              mechanisms solely to operate the Service:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
              <li><strong>localStorage (event token):</strong> When you join or create an event, an authentication token is stored in your browser's localStorage. This token allows you to re-access the event from the same browser without re-entering your credentials. It is scoped to the specific event and expires when the event is deleted.</li>
              <li><strong>localStorage (username):</strong> Your chosen username is stored in localStorage so it can be pre-filled on subsequent visits to the same event.</li>
            </ul>
            <p className="mt-3">
              You can clear these at any time through your browser settings. Doing so will require you to re-enter
              your details the next time you access an event. We do not use session cookies for tracking purposes.
            </p>
          </Section>

          <Section number="8" title="Camera Access">
            <p>
              Certain features of PlanIt, specifically the QR code scanning functionality used in Enterprise mode
              check-in, require access to your device's camera. Camera access is requested only when you navigate
              to a feature that explicitly requires it. You may deny camera access; doing so will disable QR
              scanning but will not affect any other feature of the Service. Camera data is processed locally on
              your device and is not transmitted to or stored on our servers.
            </p>
          </Section>

          <Section number="9" title="Children's Privacy">
            <p>
              PlanIt is not directed to children under the age of 13 and we do not knowingly collect personal
              information from children under 13. If you are a parent or guardian and believe that your child has
              provided personal information through the Service, please contact us at{' '}
              <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 font-medium underline underline-offset-2">
                planit.userhelp@gmail.com
              </a>{' '}
              and we will take steps to delete that information promptly.
            </p>
          </Section>

          <Section number="10" title="International Users and Data Transfers">
            <p>
              PlanIt is operated from infrastructure hosted by Render and MongoDB Atlas, which may be located in
              the United States or other jurisdictions. If you access the Service from outside the United States,
              your information may be transferred to, stored, and processed in a country whose data protection laws
              differ from those in your country of residence.
            </p>
            <p>
              By using the Service, you consent to the transfer of your information to our hosting infrastructure
              regardless of where it is located. We take steps to ensure that any such transfers comply with
              applicable law.
            </p>
          </Section>

          <Section number="11" title="Your Rights">
            <p>
              Depending on your location, you may have the following rights with respect to your personal information:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
              <li><strong>Access:</strong> The right to request a copy of the personal information we hold about you.</li>
              <li><strong>Correction:</strong> The right to request correction of inaccurate information.</li>
              <li><strong>Deletion:</strong> The right to request deletion of your personal information. Note that all event data is deleted automatically within seven days, but you may request earlier deletion as described in Section 6.3.</li>
              <li><strong>Object:</strong> The right to object to certain types of processing of your personal information.</li>
              <li><strong>Portability:</strong> The right to request that we provide your data in a portable format where technically feasible.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 font-medium underline underline-offset-2">
                planit.userhelp@gmail.com
              </a>. We will respond within 30 days. Some rights may be limited by applicable law or by the technical
              constraints of the Service, particularly given the automatic deletion of data within seven days of the
              event date.
            </p>
          </Section>

          <Section number="12" title="Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices, the Service,
              or applicable law. When we make material changes, we will update the "Last updated" date at the top
              of this page. We encourage you to review this page periodically. Your continued use of the Service
              after changes are posted constitutes your acceptance of the updated policy.
            </p>
          </Section>

          <Section number="13" title="Contact Us">
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or how we handle your
              personal information, please contact us:
            </p>
            <div className="mt-3 p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-2 text-sm">
              <p><strong>Email:</strong>{' '}
                <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 underline underline-offset-2">
                  planit.userhelp@gmail.com
                </a>
              </p>
              <p><strong>Response time:</strong> We aim to respond to all privacy enquiries within 48 hours.</p>
              <p><strong>Operating name:</strong> PlanIt</p>
            </div>
          </Section>

        </div>

        <div className="mt-8 text-center">
          <button onClick={() => navigate('/')} className="btn btn-secondary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
