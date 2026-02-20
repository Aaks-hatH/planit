import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
/*
Copyright (C) 2026 Aakshat Hariharan 

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, version 3.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
const LAST_UPDATED = 'February 20, 2026';

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

export default function Terms() {
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
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-neutral-900">Terms of Service</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 md:p-12">

          <div className="mb-10">
            <h1 className="text-3xl font-bold text-neutral-900 mb-3">Terms of Service</h1>
            <p className="text-sm text-neutral-500">Last updated: {LAST_UPDATED}</p>
            <div className="mt-4 p-4 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-600 leading-relaxed">
              These Terms of Service ("Terms") govern your access to and use of the PlanIt event planning platform,
              including its website and Progressive Web App (collectively, the "Service"), operated by Aakshat Hariharan
              ("PlanIt", "we", "us", or "our"). By accessing or using the Service in any way, you agree to be bound
              by these Terms. If you do not agree, do not use the Service.
            </div>
          </div>

          <Section number="1" title="Description of the Service">
            <p>
              PlanIt is a web-based collaborative event planning platform that allows users to create event workspaces
              ("Events") and invite other participants to collaborate in real time. Features include group chat, RSVP
              management, polls, shared file storage, task management, announcements, shared notes, expense tracking,
              event analytics, and, in Enterprise mode, QR-code-based guest invitation and check-in management.
            </p>
            <p>
              PlanIt is provided free of charge. We reserve the right to introduce paid features or plans in the future,
              in which case clear notice will be given before any charges are applied.
            </p>
          </Section>

          <Section number="2" title="Eligibility">
            <p>
              You must be at least 13 years of age to use the Service. By using the Service, you represent and warrant
              that you meet this minimum age requirement. If you are between 13 and 18 years of age, you represent that
              you have your parent or guardian's permission to use the Service.
            </p>
            <p>
              If you are creating an Event on behalf of a business, organisation, or other legal entity, you represent
              that you have the authority to bind that entity to these Terms, and these Terms apply to that entity as well.
            </p>
          </Section>

          <Section number="3" title="Accounts and Event Creation">
            <Sub title="3.1 No Persistent User Accounts">
              <p>
                PlanIt does not require you to create a persistent user account. Instead, organizers create individual
                Events and receive a unique event link. Participants join using a chosen display name. Each Event exists
                independently, and your access to an Event does not grant you access to any other Event.
              </p>
            </Sub>
            <Sub title="3.2 Organizer Responsibilities">
              <p>
                When you create an Event, you become the "Organizer" of that Event. As Organizer, you are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-1.5 ml-3 mt-2">
                <li>Providing accurate information when creating the Event, including a valid email address.</li>
                <li>Maintaining the confidentiality of your organizer account password and any event-level password you set.</li>
                <li>All activity that occurs within your Event, including content posted by participants you have invited.</li>
                <li>Ensuring that participants you invite are aware of these Terms and our Privacy Policy.</li>
                <li>Using the Event features in a lawful and responsible manner.</li>
              </ul>
            </Sub>
            <Sub title="3.3 Participant Responsibilities">
              <p>
                When you join an Event as a participant, you are responsible for the accuracy of the display name you
                choose and for all content you submit within that Event.
              </p>
            </Sub>
            <Sub title="3.4 Account Passwords">
              <p>
                Participants may optionally set an account password that protects their chosen display name within a
                given Event. If you lose your account password, we cannot recover it. You would need to contact the
                event Organizer or reach out to us at{' '}
                <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 font-medium underline underline-offset-2">
                  planit.userhelp@gmail.com
                </a>{' '}
                for assistance.
              </p>
            </Sub>
          </Section>

          <Section number="4" title="Acceptable Use">
            <Sub title="4.1 Permitted Uses">
              <p>
                The Service may be used for lawful personal, social, and professional event planning and collaboration
                purposes, including but not limited to planning social gatherings, corporate events, conferences,
                community events, and any other legitimate group activity.
              </p>
            </Sub>
            <Sub title="4.2 Prohibited Uses">
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc list-inside space-y-1.5 ml-3 mt-2">
                <li>Violate any applicable local, national, or international law or regulation.</li>
                <li>Post, transmit, or share content that is defamatory, obscene, fraudulent, hateful, discriminatory, or otherwise objectionable.</li>
                <li>Harass, threaten, intimidate, or abuse any other user of the Service.</li>
                <li>Impersonate any person, organisation, or entity, or otherwise misrepresent your identity or affiliation.</li>
                <li>Upload, share, or transmit any content that infringes the intellectual property rights, privacy rights, or other legal rights of any third party.</li>
                <li>Transmit any malware, viruses, ransomware, spyware, or other harmful or malicious code.</li>
                <li>Attempt to gain unauthorised access to any part of the Service, another user's event, or our backend infrastructure.</li>
                <li>Use automated scripts, bots, crawlers, or other automated tools to interact with the Service without our prior written consent.</li>
                <li>Interfere with or disrupt the integrity or performance of the Service, including by sending excessive requests that place unreasonable load on our infrastructure.</li>
                <li>Collect, harvest, or store personal information about other users without their explicit consent.</li>
                <li>Use the Service for unsolicited advertising, spam, or any other form of unauthorized promotion.</li>
                <li>Circumvent, disable, or otherwise interfere with any security features of the Service, including rate limiting, authentication, or access controls.</li>
                <li>Use the Service for any purpose that could expose PlanIt, its users, or third parties to legal liability.</li>
              </ul>
            </Sub>
            <Sub title="4.3 Enforcement">
              <p>
                We reserve the right to investigate any suspected violation of this Section and to take appropriate
                action, including immediate removal of content, termination of access, and where warranted, referral
                to law enforcement authorities.
              </p>
            </Sub>
          </Section>

          <Section number="5" title="User Content">
            <Sub title="5.1 Ownership">
              <p>
                You retain all ownership rights to content you create and submit through the Service, including messages,
                files, poll questions and options, task descriptions, notes, and expense records ("User Content").
              </p>
            </Sub>
            <Sub title="5.2 License to PlanIt">
              <p>
                By submitting User Content to the Service, you grant PlanIt a limited, non-exclusive, royalty-free,
                worldwide license to store, display, transmit, and reproduce that content solely to the extent necessary
                to operate and provide the Service to you and other participants of the same Event. This license exists
                only for the duration that the content is stored on our servers and terminates when the content is deleted
                in accordance with our seven-day data retention policy.
              </p>
              <p>
                We do not use your User Content for any commercial purpose, advertising, or AI/machine learning training.
              </p>
            </Sub>
            <Sub title="5.3 Content Standards">
              <p>
                All User Content must comply with Section 4 (Acceptable Use). You represent and warrant that:
              </p>
              <ul className="list-disc list-inside space-y-1.5 ml-3 mt-2">
                <li>You own or have the necessary rights to submit the User Content.</li>
                <li>The User Content does not infringe, misappropriate, or violate any third party's intellectual property rights, privacy rights, or other legal rights.</li>
                <li>The User Content complies with all applicable laws and regulations.</li>
              </ul>
            </Sub>
            <Sub title="5.4 Content Removal">
              <p>
                We reserve the right, but not the obligation, to review, monitor, or remove User Content at our
                sole discretion, without notice, if we determine that such content violates these Terms or is
                otherwise harmful. Organizers also have the ability to delete messages and content within their Events.
              </p>
            </Sub>
          </Section>

          <Section number="6" title="Data Retention and Event Deletion">
            <p>
              All data associated with an Event — including messages, files, polls, tasks, expenses, notes, RSVP
              records, and participant information — is automatically and permanently deleted seven days after the
              Event date. Files stored via Cloudinary are also deleted as part of this process.
            </p>
            <p>
              PlanIt is not a permanent storage solution. You acknowledge and agree that you are responsible for
              saving or exporting any content from an Event before the deletion date. We strongly recommend
              downloading important files and exporting the calendar event before the seven-day window closes.
              PlanIt accepts no liability for loss of data as a result of the automatic deletion process.
            </p>
            <p>
              Organizers may request early deletion of their Event and all associated data by contacting us at{' '}
              <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 font-medium underline underline-offset-2">
                planit.userhelp@gmail.com
              </a>.
            </p>
          </Section>

          <Section number="7" title="Enterprise Mode">
            <p>
              Enterprise mode is a feature of PlanIt that enables organizers to issue individual QR-code-based
              invitations to guests and manage a structured check-in process. If you use Enterprise mode, the
              following additional terms apply:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-3 mt-2">
              <li>You as the Organizer are solely responsible for the accuracy of guest information entered into the system.</li>
              <li>Invite QR codes are single-use identifiers. You are responsible for distributing them securely to the correct individuals.</li>
              <li>Guest personal information entered into the Enterprise invite system (name, contact details, etc.) is subject to the same seven-day deletion policy and is visible only to Organizers and authorised check-in staff for that Event.</li>
              <li>You agree to use the check-in and manager override features only for legitimate event management purposes and not to unlawfully discriminate against or deny entry to any person on protected grounds.</li>
              <li>You are responsible for ensuring that any personal data you collect from guests through the Enterprise invite system complies with applicable data protection and privacy laws in your jurisdiction.</li>
            </ul>
          </Section>

          <Section number="8" title="Intellectual Property">
            <Sub title="8.1 PlanIt's Intellectual Property">
              <p>
                The Service, including its design, interface, code, branding, logo, and all features and functionality,
                is owned by PlanIt and protected by applicable intellectual property laws. You are granted a limited,
                non-exclusive, non-transferable, revocable licence to access and use the Service for its intended
                purpose subject to these Terms.
              </p>
              <p>
                You may not copy, modify, distribute, sell, license, reverse engineer, decompile, or otherwise
                exploit any part of the Service without our prior written consent.
              </p>
            </Sub>
            <Sub title="8.2 Feedback">
              <p>
                If you submit feedback, suggestions, or ideas about the Service to us, you grant PlanIt a perpetual,
                irrevocable, royalty-free licence to use that feedback without obligation or restriction.
              </p>
            </Sub>
          </Section>

          <Section number="9" title="Third-Party Services">
            <p>
              The Service integrates with certain third-party services to deliver its functionality, including Cloudinary
              for file storage, MongoDB Atlas for database services, and Render for hosting. Your use of the Service is
              subject to the terms and privacy policies of these third parties to the extent they govern the processing
              of your data.
            </p>
            <p>
              The Service may display links to external websites or services. These links are provided for your
              convenience only. PlanIt has no control over the content or practices of external sites and accepts no
              responsibility for them. Visiting third-party websites is at your own risk.
            </p>
          </Section>

          <Section number="10" title="Disclaimers">
            <p>
              The Service is provided on an "as is" and "as available" basis without any warranties of any kind,
              express or implied. To the fullest extent permitted by applicable law, PlanIt disclaims all warranties,
              including but not limited to implied warranties of merchantability, fitness for a particular purpose,
              title, and non-infringement.
            </p>
            <p>We do not warrant or represent that:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-3 mt-2">
              <li>The Service will be available at all times or free from interruption, errors, or bugs.</li>
              <li>The Service will meet your specific requirements or expectations.</li>
              <li>Any errors in the Service will be corrected.</li>
              <li>The Service or its servers are free from viruses or other harmful components.</li>
              <li>Any content, data, or information obtained through the Service will be accurate or reliable.</li>
            </ul>
            <p className="mt-3">
              We reserve the right to modify, suspend, or discontinue the Service or any part of it at any time,
              with or without notice, and we will not be liable to you or any third party for doing so.
            </p>
          </Section>

          <Section number="11" title="Limitation of Liability">
            <p>
              To the fullest extent permitted by applicable law, PlanIt, its operators, officers, employees, and agents
              shall not be liable for any indirect, incidental, special, consequential, punitive, or exemplary damages
              arising out of or in connection with your use of, or inability to use, the Service, including but not
              limited to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-3 mt-2">
              <li>Loss of data, including event content, messages, or files resulting from the automatic deletion policy or any other cause.</li>
              <li>Loss of profits, revenue, goodwill, or business opportunities.</li>
              <li>Unauthorised access to or alteration of your data or transmissions.</li>
              <li>Conduct or content of any third party using the Service.</li>
              <li>Service interruptions, downtime, or technical failures.</li>
            </ul>
            <p className="mt-3">
              Our total aggregate liability to you for any claim arising under or in connection with these Terms or
              the Service shall not exceed the amount you have paid us in the twelve months preceding the claim. As
              PlanIt is a free service, this means our aggregate liability is zero unless and until paid features are
              introduced.
            </p>
            <p>
              Some jurisdictions do not allow the exclusion or limitation of certain warranties or liabilities.
              In such jurisdictions, our liability is limited to the greatest extent permitted by law.
            </p>
          </Section>

          <Section number="12" title="Indemnification">
            <p>
              You agree to defend, indemnify, and hold harmless PlanIt and its operators, officers, employees, and
              agents from and against any claims, damages, losses, liabilities, costs, and expenses (including
              reasonable legal fees) arising out of or related to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-3 mt-2">
              <li>Your use of or access to the Service.</li>
              <li>Your violation of any provision of these Terms.</li>
              <li>Any User Content you submit, post, or transmit through the Service.</li>
              <li>Your violation of any applicable law or the rights of any third party.</li>
            </ul>
          </Section>

          <Section number="13" title="Termination and Suspension">
            <Sub title="13.1 Termination by PlanIt">
              <p>
                We reserve the right to suspend or terminate your access to the Service at any time, without notice
                and without liability, if we reasonably believe that you have violated these Terms or if your use of
                the Service poses a risk to other users, third parties, or the Service itself.
              </p>
              <p>
                Upon termination, your right to access the Service ceases immediately. Any Event data will continue
                to be subject to the automatic seven-day deletion policy and will be deleted in due course.
              </p>
            </Sub>
            <Sub title="13.2 Termination by You">
              <p>
                You may stop using the Service at any time. If you are an Organizer and wish to have your Event deleted
                before the automatic seven-day window, contact us at{' '}
                <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 font-medium underline underline-offset-2">
                  planit.userhelp@gmail.com
                </a>.
              </p>
            </Sub>
            <Sub title="13.3 Survival">
              <p>
                The following sections survive termination: Section 5.2 (License to PlanIt, for the duration content
                exists on our servers), Section 8 (Intellectual Property), Section 10 (Disclaimers), Section 11
                (Limitation of Liability), Section 12 (Indemnification), and Section 15 (Governing Law).
              </p>
            </Sub>
          </Section>

          <Section number="14" title="Changes to These Terms">
            <p>
              We may update these Terms from time to time. When we make material changes, we will update the "Last
              updated" date at the top of this page. We will not retroactively reduce your rights under these Terms
              without providing reasonable notice. Your continued use of the Service after changes are posted
              constitutes your acceptance of the updated Terms.
            </p>
            <p>
              If you disagree with any changes to these Terms, your sole remedy is to stop using the Service.
            </p>
          </Section>

          <Section number="15" title="Governing Law and Disputes">
            <p>
              These Terms are governed by and construed in accordance with applicable law. Any disputes arising
              out of or relating to these Terms or the Service shall first be addressed informally by contacting
              us at{' '}
              <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 font-medium underline underline-offset-2">
                planit.userhelp@gmail.com
              </a>{' '}
              and we will make a reasonable effort to resolve the matter within 30 days.
            </p>
          </Section>

          <Section number="16" title="Contact Information">
            <p>
              If you have any questions about these Terms, wish to report a violation, or need assistance with
              anything related to your use of PlanIt, please contact us:
            </p>
            <div className="mt-3 p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-2 text-sm">
              <p><strong>Email:</strong>{' '}
                <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 underline underline-offset-2">
                  planit.userhelp@gmail.com
                </a>
              </p>
              <p><strong>Use for:</strong> General enquiries, capacity increase requests, early event deletion, bug reports, legal or privacy matters.</p>
              <p><strong>Response time:</strong> We aim to respond within 48 hours on business days.</p>
              <p><strong>Operating name:</strong> PlanIt</p>
            </div>
          </Section>

          <div className="mt-10 p-5 bg-neutral-900 rounded-xl">
            <p className="text-sm text-neutral-300 leading-relaxed">
              <strong className="text-white">Summary:</strong> By using PlanIt you agree to use it lawfully and
              responsibly, to take ownership of content you submit, and to understand that all event data is
              permanently deleted seven days after the event date. PlanIt is provided free of charge, as is, with
              no guarantees of uptime or suitability for any particular purpose. For any questions or assistance,
              contact us at{' '}
              <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-300 underline underline-offset-2">
                planit.userhelp@gmail.com
              </a>.
            </p>
          </div>

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
