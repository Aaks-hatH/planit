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

          <Section number="4" title="Legal Bases for Processing Personal Data (GDPR)">
            <p>
              If you are located in the European Economic Area (EEA), the United Kingdom, or Switzerland, we are required under applicable data protection law — including the General Data Protection Regulation (EU) 2016/679 ("GDPR") and the UK GDPR — to identify the legal basis upon which we process your personal data. We process personal data on the following legal bases, each of which is set out in Article 6 of the GDPR:
            </p>
            <ul className="list-disc list-inside space-y-3 ml-3 mt-3">
              <li>
                <strong>Performance of a contract (Article 6(1)(b)):</strong> Processing your data to provide you with the Service, including creating and operating event workspaces, enabling real-time collaboration, authenticating your identity, transmitting messages, and delivering all features of the platform. This is the primary legal basis for the majority of processing activities.
              </li>
              <li>
                <strong>Legitimate interests (Article 6(1)(f)):</strong> Where processing is necessary for our legitimate interests (or those of a third party), and where such interests are not overridden by your interests or fundamental rights. Our legitimate interests include: detecting and preventing fraud and abuse; securing and monitoring our infrastructure; improving the reliability, performance, and functionality of the Service; enforcing our Terms of Service; and protecting the rights of other Users. We have conducted and maintain legitimate interest assessments (LIAs) for processing under this basis.
              </li>
              <li>
                <strong>Compliance with legal obligations (Article 6(1)(c)):</strong> Where processing is necessary to comply with applicable legal obligations, including responding to lawful requests from courts, regulators, and law enforcement authorities.
              </li>
              <li>
                <strong>Consent (Article 6(1)(a)):</strong> Where you have given specific, freely given, informed, and unambiguous consent to processing for a particular purpose. You may withdraw consent at any time; withdrawal will not affect the lawfulness of processing carried out prior to withdrawal.
              </li>
            </ul>
            <p className="mt-3">
              Where we process special categories of personal data (Article 9 GDPR), we rely on the applicable condition under Article 9(2). PlanIt does not intentionally solicit or process special category data. If such data is included in User Content, it is processed on the basis of explicit consent by the individual or because the individual has manifestly made the data public.
            </p>
          </Section>

          <Section number="5" title="How Your Information Is Shared">
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

          <Section number="6" title="Data Security">
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

          <Section number="7" title="Data Retention and Deletion">
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

          <Section number="8" title="Cookies and Local Storage">
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

          <Section number="9" title="Camera Access">
            <p>
              Certain features of PlanIt, specifically the QR code scanning functionality used in Enterprise mode
              check-in, require access to your device's camera. Camera access is requested only when you navigate
              to a feature that explicitly requires it. You may deny camera access; doing so will disable QR
              scanning but will not affect any other feature of the Service. Camera data is processed locally on
              your device and is not transmitted to or stored on our servers.
            </p>
          </Section>

          <Section number="10" title="Children's Privacy">
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

          <Section number="11" title="International Users and Data Transfers">
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

          <Section number="12" title="Your Rights Under Applicable Data Protection Law">
            <p>
              Depending on your location and applicable law, you may have the following rights with respect to your personal information. Because all event data is automatically and permanently deleted within seven (7) days of the event date, many rights can be satisfied simply through the passage of time. However, we will respond to valid requests regardless.
            </p>

            <Sub title="12.1 Rights Under GDPR (EEA, UK, and Switzerland Users)">
              <p>If you are located in the EEA, United Kingdom, or Switzerland, you have the following rights under the GDPR or equivalent legislation:</p>
              <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
                <li><strong>Right of access (Article 15):</strong> The right to obtain confirmation of whether we process your personal data and, if so, to receive a copy of that data together with supplementary information about the processing.</li>
                <li><strong>Right to rectification (Article 16):</strong> The right to obtain rectification of inaccurate personal data and, taking into account the purposes of the processing, the right to have incomplete personal data completed.</li>
                <li><strong>Right to erasure / "right to be forgotten" (Article 17):</strong> The right to obtain erasure of your personal data where: the data is no longer necessary for the purpose for which it was collected; you withdraw consent and there is no other legal basis for processing; you object to processing under Article 21 and there are no overriding legitimate grounds; or the data has been unlawfully processed. Note that our automatic seven-day deletion policy ordinarily satisfies this right without action on your part.</li>
                <li><strong>Right to restriction of processing (Article 18):</strong> The right to obtain restriction of processing in certain circumstances, including where the accuracy of the data is contested or where processing is unlawful.</li>
                <li><strong>Right to data portability (Article 20):</strong> Where processing is based on consent or contract and carried out by automated means, the right to receive your personal data in a structured, commonly used, machine-readable format, and to transmit that data to another controller.</li>
                <li><strong>Right to object (Article 21):</strong> The right to object at any time to processing of your personal data where that processing is based on our legitimate interests, including profiling based on those interests. We shall cease processing unless we can demonstrate compelling legitimate grounds overriding your interests, or processing is necessary for the establishment, exercise, or defence of legal claims.</li>
                <li><strong>Rights related to automated decision-making (Article 22):</strong> The right not to be subject to a decision based solely on automated processing that produces legal or similarly significant effects concerning you. PlanIt does not engage in automated decision-making of this nature.</li>
                <li><strong>Right to withdraw consent:</strong> Where processing is based on consent, the right to withdraw that consent at any time without affecting the lawfulness of processing based on consent before withdrawal.</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, please contact us at <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 font-medium underline underline-offset-2">planit.userhelp@gmail.com</a>. We will respond within 30 days. You also have the right to lodge a complaint with the supervisory authority in your Member State of habitual residence, place of work, or place of the alleged infringement.
              </p>
            </Sub>

            <Sub title="12.2 Rights Under CCPA / CPRA (California Residents)">
              <p>
                If you are a California resident, you have the following rights under the California Consumer Privacy Act of 2018 as amended by the California Privacy Rights Act of 2020 ("CCPA/CPRA"):
              </p>
              <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
                <li><strong>Right to know:</strong> The right to request that we disclose the categories and specific pieces of personal information we have collected about you, the categories of sources from which we collected it, the business or commercial purposes for collecting it, the categories of third parties with whom we share it, and the categories shared for business purposes.</li>
                <li><strong>Right to delete:</strong> The right to request deletion of personal information we have collected from you, subject to certain exceptions permitted by law.</li>
                <li><strong>Right to correct:</strong> The right to request correction of inaccurate personal information we maintain about you.</li>
                <li><strong>Right to opt out of sale or sharing:</strong> PlanIt does not sell, rent, or share your personal information with third parties for cross-context behavioural advertising. You therefore have no reason to opt out under this right, but you may submit such a request and we will confirm our non-sale status.</li>
                <li><strong>Right to limit use of sensitive personal information:</strong> PlanIt does not use sensitive personal information beyond what is reasonably necessary to provide the Service.</li>
                <li><strong>Right to non-discrimination:</strong> You have the right not to receive discriminatory treatment for exercising any of your CCPA/CPRA rights. PlanIt will not deny you the Service, charge you different prices, provide a different level of quality, or retaliate against you for exercising your privacy rights.</li>
              </ul>
              <p className="mt-3">
                To submit a CCPA/CPRA request, contact us at <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 font-medium underline underline-offset-2">planit.userhelp@gmail.com</a> with the subject line "California Privacy Request." We will verify your identity before responding. We aim to respond within 45 days. We may extend this period once by an additional 45 days where reasonably necessary.
              </p>
              <p className="mt-2">
                <strong>Shine the Light:</strong> California Civil Code Section 1798.83 permits California residents to request information about how we share personal information with third parties for direct marketing purposes. PlanIt does not share personal information with third parties for direct marketing and has not done so in the preceding calendar year.
              </p>
            </Sub>

            <Sub title="12.3 Verification of Identity">
              <p>
                When you submit a request to exercise any data subject right, we may ask you to verify your identity before processing the request. Because PlanIt does not maintain a global persistent user account, verification may involve confirming your role in a specific event (by reference to the event name, organizer email, or other identifying details). We cannot process requests where identity cannot be reasonably verified.
              </p>
            </Sub>
          </Section>

          <Section number="13" title="Data Processor Relationships and Third-Party Processor Disclosures">
            <p>
              PlanIt acts as a data controller with respect to personal data it collects and processes in connection with operating the Service. Where we engage third-party service providers to process personal data on our behalf, such providers act as data processors (within the meaning of the GDPR) or service providers (within the meaning of the CCPA/CPRA). The following describes our processor relationships:
            </p>
            <ul className="list-disc list-inside space-y-3 ml-3 mt-3">
              <li>
                <strong>MongoDB Atlas (MongoDB, Inc.):</strong> Processes personal data as our primary database. All event records, messages, participant data, guest lists, and associated content are stored in MongoDB Atlas. MongoDB Atlas is certified under ISO 27001 and SOC 2 Type II and may process data in data centres located in the United States and other jurisdictions. Data processing is governed by MongoDB's Data Processing Addendum.
              </li>
              <li>
                <strong>Cloudinary (Cloudinary Ltd.):</strong> Processes uploaded media files (images, documents, and other files shared within event workspaces). Files are transferred to and stored on Cloudinary's infrastructure upon upload. Cloudinary maintains ISO 27001 certification. Data processing is governed by Cloudinary's Data Processing Agreement.
              </li>
              <li>
                <strong>Render (Render Services, Inc.):</strong> Hosts the PlanIt backend and frontend application servers. Server logs, including request logs containing IP addresses, may be generated and retained by Render's infrastructure for operational purposes. Data processing is governed by Render's Data Processing Agreement.
              </li>
              <li>
                <strong>Upstash, Inc.:</strong> Provides Redis-compatible caching and rate-limiting services. Rate-limiting counters keyed to IP addresses are transiently stored on Upstash's infrastructure. No personally identifiable information beyond IP address is stored in this layer.
              </li>
            </ul>
            <p className="mt-3">
              We have entered into, or rely upon, data processing agreements or standard contractual clauses with each processor where required by applicable data protection law. We do not authorise any processor to use personal data except as necessary to perform services on our behalf.
            </p>
          </Section>

          <Section number="14" title="Logging, Monitoring, and Automated Processing">
            <Sub title="14.1 Server and Application Logs">
              <p>
                PlanIt and its infrastructure providers generate and retain application logs, server access logs, error logs, security event logs, and performance logs in the ordinary course of operating the Service. These logs may contain personal data including IP addresses, request URLs, user agents, timestamps, event identifiers, and error context. Logs are used exclusively for: diagnosing and resolving technical issues; detecting and investigating security incidents and abuse; monitoring system performance and availability; and compliance with legal obligations. Logs are not used for commercial profiling or marketing.
              </p>
            </Sub>
            <Sub title="14.2 Anti-Fraud and Security Monitoring">
              <p>
                The Service operates automated anti-fraud middleware and rate-limiting systems that process request metadata — including IP address, request frequency, behavioural patterns, and response signing data — to detect and prevent abuse, credential stuffing, automated scraping, and other malicious activity. This processing is carried out on the basis of our legitimate interests in securing the Service and is necessary for the performance of our contract with you. Automated decisions may result in rate-limiting, request blocking, or access suspension where thresholds indicative of abuse are exceeded. You may contact us to dispute any automated restriction applied to your access.
              </p>
            </Sub>
            <Sub title="14.3 Automated Deletion">
              <p>
                A scheduled automated cleanup process runs daily and permanently and irreversibly deletes all event data — including all associated personal data — seven (7) days after the event's scheduled date. This automated process is a core architectural feature of the Service. The deletion process covers all database records, Cloudinary-hosted files, cached data, and all other data stores containing event-associated information. Deletion is confirmed and logged. No human intervention is required or involved in routine deletion cycles.
              </p>
            </Sub>
          </Section>

          <Section number="15" title="Security Incident and Data Breach Response">
            <p>
              In the event of a personal data breach within the meaning of Article 4(12) GDPR or equivalent applicable law, PlanIt will:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
              <li>Assess the nature, scope, and likely consequences of the breach within the shortest feasible time following discovery;</li>
              <li>Where required by applicable law, notify the competent supervisory authority without undue delay and, where feasible, within 72 hours of becoming aware of the breach, unless the breach is unlikely to result in a risk to the rights and freedoms of natural persons;</li>
              <li>Where the breach is likely to result in a high risk to the rights and freedoms of natural persons, communicate the breach to affected data subjects without undue delay in accordance with Article 34 GDPR;</li>
              <li>Document all breaches pursuant to Article 33(5) GDPR, including those not subject to mandatory reporting.</li>
            </ul>
            <p className="mt-3">
              <strong>Important limitations:</strong> Given that the Service does not maintain a global persistent user account system and does not collect email addresses from Participants, PlanIt may not have the means to directly notify all affected individuals of a breach. Notification may be made via prominent notice on the Service. PlanIt expressly disclaims all liability for any secondary loss, consequential damage, or harm arising from a security incident or data breach except to the extent required by applicable mandatory law.
            </p>
          </Section>

          <Section number="16" title="Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices, the Service,
              or applicable law. When we make material changes, we will update the "Last updated" date at the top
              of this page. We encourage you to review this page periodically. Your continued use of the Service
              after changes are posted constitutes your acceptance of the updated policy.
            </p>
          </Section>

          <Section number="17" title="Contact Us">
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
