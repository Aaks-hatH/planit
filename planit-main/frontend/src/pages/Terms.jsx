import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

const LAST_UPDATED = 'February 26, 2026';
const EFFECTIVE_DATE = 'February 26, 2026';

function Section({ number, title, children }) {
  return (
    <section className="mb-12">
      <h2 className="text-lg font-bold text-neutral-900 mb-4 pb-3 border-b-2 border-neutral-200 tracking-tight">
        {number}. {title}
      </h2>
      <div className="space-y-4 text-neutral-700 leading-relaxed text-sm">
        {children}
      </div>
    </section>
  );
}

function Sub({ number, title, children }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-bold text-neutral-800 mb-2">{number} {title}</h3>
      <div className="space-y-3 text-neutral-700 leading-relaxed text-sm">{children}</div>
    </div>
  );
}

function DefItem({ term, children }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-neutral-100 last:border-0">
      <span className="font-bold text-neutral-900 w-44 flex-shrink-0 text-xs uppercase tracking-wide pt-0.5">"{term}"</span>
      <span className="text-neutral-600 text-sm leading-relaxed">{children}</span>
    </div>
  );
}

function LegalCallout({ children }) {
  return (
    <div className="my-5 p-4 bg-neutral-900 rounded-xl text-sm text-neutral-300 leading-relaxed">
      {children}
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
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 md:p-14">

          <div className="mb-12">
            <h1 className="text-4xl font-black text-neutral-900 mb-2 tracking-tight">Terms of Service</h1>
            <p className="text-sm text-neutral-500 mb-1">Last updated: {LAST_UPDATED}</p>
            <p className="text-sm text-neutral-500 mb-6">Effective date: {EFFECTIVE_DATE}</p>
            <LegalCallout>
              <strong className="text-white">PLEASE READ THESE TERMS OF SERVICE CAREFULLY AND IN THEIR ENTIRETY BEFORE ACCESSING OR USING THE SERVICE.</strong> These Terms of Service constitute a legally binding agreement between you and PlanIt. Your access to or use of the Service in any manner whatsoever — including browsing, creating an Event, joining an Event workspace, submitting Content, or otherwise interacting with the Service — constitutes your unconditional acceptance of and agreement to be bound by these Terms of Service and all policies incorporated herein by reference. IF YOU DO NOT AGREE TO THESE TERMS IN THEIR ENTIRETY, YOU MUST IMMEDIATELY CEASE ALL USE OF AND ACCESS TO THE SERVICE.
            </LegalCallout>
          </div>

          <Section number="1" title="Definitions and Interpretive Provisions">
            <p>
              For the purposes of these Terms of Service, the following defined terms shall have the meanings set forth herein. Capitalised terms not otherwise defined shall bear the meanings commonly attributed to them in the context of software-as-a-service agreements governed by commercial law. The singular shall include the plural and vice versa. Headings are for convenience only. References to any statute or statutory provision include all amendments, re-enactments, and consolidations thereof.
            </p>
            <div className="mt-4 border border-neutral-200 rounded-xl overflow-hidden">
              <DefItem term="Agreement">These Terms of Service together with the Privacy Policy, any Supplemental Terms, and all other policies, notices, or guidelines published by PlanIt from time to time, each of which is incorporated herein by reference and forms an integral part of this Agreement.</DefItem>
              <DefItem term="Authorised Use">Use of the Service strictly within the scope of the permissions expressly granted in Section 6 hereof and consistent with the features and functionalities made available through PlanIt's standard user interface, as modified from time to time.</DefItem>
              <DefItem term="Content">Any and all data, text, messages, materials, files, images, graphics, audio, video, metadata, and information of whatever nature or kind that is uploaded, submitted, transmitted, posted, stored, or otherwise made available through the Service by any User or by PlanIt.</DefItem>
              <DefItem term="Enterprise Mode">The operational configuration of the Service enabling advanced Guest management, QR-code-based invitation issuance and cryptographic validation, anti-fraud middleware, real-time check-in administration, and attendance analytics, as further described in the Service documentation.</DefItem>
              <DefItem term="Event">A discrete, independently secured workspace instance created by an Organizer within the Service, together with all associated Content, configuration, Participants, Guest invitation records, and data pertaining thereto.</DefItem>
              <DefItem term="Guest">An individual for whom an Organizer has created a personal invite record within an Enterprise Mode Event, regardless of whether that individual has accessed the Service or presented their credentials.</DefItem>
              <DefItem term="Intellectual Property Rights">All patents, patent applications, copyrights, moral rights, trademarks, service marks, trade dress, trade names, trade secrets, database rights, design rights, rights in software, and all other intellectual or industrial property rights of whatever nature, whether registered or unregistered, including all applications and rights to apply for registration, in every jurisdiction worldwide.</DefItem>
              <DefItem term="Operator">Aakshat Hariharan, the individual developer, proprietor, and operator of the PlanIt Service, operating under the trading designation "PlanIt."</DefItem>
              <DefItem term="Organizer">A User who creates an Event and is thereby vested with elevated administrative privileges with respect to that Event, including the ability to manage Participants and Guests, post Announcements, configure security and Enterprise Mode settings, and administer the Guest list.</DefItem>
              <DefItem term="Participant">Any User accessing an Event workspace in a capacity other than Organizer, regardless of the means by which access was obtained.</DefItem>
              <DefItem term="Personal Data">Information relating to an identified or identifiable natural person, as further defined and governed by the Privacy Policy.</DefItem>
              <DefItem term="Platform">The entirety of PlanIt's technical infrastructure, including the frontend application, backend application servers, load balancing router, watchdog monitoring service, database systems, real-time communication layer, mesh authentication infrastructure, and all associated APIs, microservices, and third-party integrations.</DefItem>
              <DefItem term="Prohibited Content">Content falling within the categories enumerated in Section 6.2 of these Terms.</DefItem>
              <DefItem term="Service">The PlanIt event planning platform accessible at planitapp.onrender.com and any successor domains, subdomains, or applications, including all features, functionalities, and services available therethrough, accessed via web browser, progressive web application, or any other means.</DefItem>
              <DefItem term="User">Any individual or entity that accesses, browses, uses, or interacts with the Service in any capacity, including Organizers, Participants, and Guests.</DefItem>
              <DefItem term="User Content">Content uploaded, submitted, transmitted, or made available through the Service by a User, including messages, tasks, poll responses, notes, announcements, expense records, and uploaded files.</DefItem>
            </div>
          </Section>

          <Section number="2" title="Description, Scope, and Nature of the Service">
            <p>
              PlanIt is a web-based collaborative event planning and management platform providing tools for Event workspace creation, real-time team communication, task management, polling and voting, note-taking, announcement broadcasting, expense tracking, file storage and sharing, countdown functionality, analytics, and — in Enterprise Mode — guest invitation management, QR-code-based entry validation, anti-fraud detection, and real-time check-in administration.
            </p>
            <p>
              The Service is provided free of charge as of the Effective Date. PlanIt expressly reserves the right, in its sole and absolute discretion, to introduce tiered pricing, premium features, paid subscription plans, or other monetisation mechanisms at any future time. PlanIt shall endeavour to provide reasonable advance notice of any material introduction of charges for features currently provided without charge; however, the provision of such notice shall not constitute a binding obligation, and failure to provide advance notice shall not give rise to any claim against PlanIt.
            </p>
            <p>
              PlanIt makes no representation that the Service, or any feature thereof, shall remain available, shall be maintained in its current form, or shall continue to be offered at any particular price point or at all. The Service is provided on a best-efforts basis without any guarantee of continuity, longevity, or feature preservation.
            </p>
          </Section>

          <Section number="3" title="Acceptance, Modifications, and Supplemental Policies">
            <Sub number="3.1" title="Acceptance by Conduct">
              <p>
                Your access to, use of, or interaction with the Service in any manner constitutes your full, unconditional, and irrevocable acceptance of and agreement to be legally bound by this Agreement. Acceptance is effective as of your first moment of access and shall remain in continuous effect, notwithstanding any subsequent amendment of these Terms.
              </p>
            </Sub>
            <Sub number="3.2" title="Modifications to the Agreement">
              <p>
                PlanIt reserves the right to modify, amend, supplement, or replace any provision of these Terms at any time and in its sole and absolute discretion, without prior consent from Users. Modifications shall become effective immediately upon publication of the revised Terms on the Service or notification by any means PlanIt deems appropriate. The "Last updated" date shall be revised to reflect material modifications. Your continued access to or use of the Service following publication of any modifications constitutes your binding acceptance of the modified Terms. If you do not agree with any modification, your sole and exclusive remedy is to immediately and permanently cease all use of the Service.
              </p>
            </Sub>
            <Sub number="3.3" title="Incorporation by Reference">
              <p>
                The Privacy Policy is hereby incorporated into and forms an integral part of this Agreement by reference. In the event of any inconsistency between these Terms and the Privacy Policy with respect to the processing of Personal Data, the Privacy Policy shall prevail to the extent of such inconsistency.
              </p>
            </Sub>
          </Section>

          <Section number="4" title="Eligibility, Capacity, and Representations">
            <Sub number="4.1" title="Minimum Age Requirement">
              <p>
                Access to and use of the Service is strictly limited to individuals who are at least thirteen (13) years of age. By accessing or using the Service, you represent and warrant that you are at least 13 years of age. If you are between the ages of 13 and 18, or between 13 and the age of majority in your jurisdiction of residence, you represent and warrant that you have obtained the explicit, informed consent of your parent or legal guardian to access and use the Service and to agree to these Terms on your behalf, and that such parent or guardian has reviewed and agreed to these Terms. PlanIt reserves the right to request verifiable proof of age or parental consent and to terminate access where such proof cannot be provided.
              </p>
            </Sub>
            <Sub number="4.2" title="Legal Capacity">
              <p>
                You represent and warrant that you have the full legal capacity, right, power, and authority to enter into, execute, and perform your obligations under this Agreement, and that doing so does not violate any applicable law, regulation, or agreement to which you are a party.
              </p>
            </Sub>
            <Sub number="4.3" title="Organisational Use">
              <p>
                If you access or use the Service on behalf of any corporation, partnership, organisation, or other legal entity, you represent and warrant that you are duly authorised to accept these Terms on behalf of such entity, and that such entity shall be jointly and severally liable with you for all obligations arising under this Agreement.
              </p>
            </Sub>
            <Sub number="4.4" title="Geographic Compliance">
              <p>
                PlanIt makes no representation that the Service is appropriate for, legal in, or compliant with the laws of any particular jurisdiction. You are solely responsible for ensuring that your access to and use of the Service complies with all applicable local, state, national, and international laws. If access to or use of the Service is prohibited or restricted in your jurisdiction, you must immediately cease all access and use.
              </p>
            </Sub>
          </Section>

          <Section number="5" title="Event Creation, Organizer Obligations, and Access Credentials">
            <Sub number="5.1" title="No Persistent Account Model">
              <p>
                The Service does not employ a conventional persistent user account system. Organizers create discrete Event instances independently secured. Participants access workspaces via display names and, where applicable, passwords or invite credentials. Your participation in one Event does not confer any right of access to any other Event or any other User's Content.
              </p>
            </Sub>
            <Sub number="5.2" title="Organizer Responsibilities">
              <p>By assuming the role of Organizer, you accept sole and full responsibility for:</p>
              <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
                <li>The accuracy, completeness, and lawfulness of all information provided in connection with the Event;</li>
                <li>Safeguarding the confidentiality of your organizer account password and any event-level access password;</li>
                <li>All activities occurring within your Event workspace, including Content posted by Participants;</li>
                <li>Ensuring that all Participants and Guests you invite have agreed to these Terms and the Privacy Policy;</li>
                <li>Ensuring that your use of Enterprise Mode Guest management features complies with all applicable data protection laws in every relevant jurisdiction;</li>
                <li>Exporting or preserving any Event data you require prior to automatic deletion.</li>
              </ul>
            </Sub>
            <Sub number="5.3" title="Credential Security and Non-Recoverability">
              <p>
                Account and event passwords are cryptographically hashed upon creation and are not stored in recoverable form. PlanIt has no technical capability to retrieve, reset, or regenerate lost passwords. You acknowledge and accept that credential loss may result in permanent loss of Organizer access to your Event, and that PlanIt bears no liability therefor.
              </p>
            </Sub>
            <Sub number="5.4" title="Session Tokens">
              <p>
                Upon successful authentication, the Service issues a JWT stored in your browser's local storage, tied to your browser session on your device, and not synchronised across devices. You are solely responsible for your device and browser security. PlanIt bears no liability for unauthorised access arising from your failure to secure your device or token.
              </p>
            </Sub>
          </Section>

          <Section number="6" title="Acceptable Use, Prohibited Conduct, and Content Standards">
            <Sub number="6.1" title="Limited Licence for Permitted Uses">
              <p>
                Subject to and conditioned upon your full compliance with these Terms, PlanIt grants you a limited, non-exclusive, non-transferable, non-sublicensable, revocable licence to access and use the Service solely for lawful personal, social, professional, or organisational event planning and collaboration purposes, strictly within the scope of features made available through the Service's standard user interface. This licence does not permit any use of the Service except as expressly stated herein.
              </p>
            </Sub>
            <Sub number="6.2" title="Prohibited Content">
              <p>You shall not upload, submit, post, transmit, distribute, or otherwise make available through the Service any Content that:</p>
              <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
                <li>Is unlawful, tortious, fraudulent, defamatory, harassing, abusive, threatening, obscene, sexually explicit, or otherwise objectionable under applicable law;</li>
                <li>Infringes, misappropriates, or violates any third party's Intellectual Property Rights or other proprietary rights;</li>
                <li>Contains Personal Data of third parties without their express, informed, and documented consent;</li>
                <li>Constitutes, facilitates, encourages, promotes, or incites criminal or tortious activity, including fraud, identity theft, terrorism, or violence;</li>
                <li>Contains malware, viruses, logic bombs, or any harmful or malicious code;</li>
                <li>Constitutes unsolicited commercial communications, spam, or pyramid schemes;</li>
                <li>Is designed to deceive, impersonate, or misrepresent your identity or affiliation;</li>
                <li>Violates any applicable law, regulation, or treaty.</li>
              </ul>
            </Sub>
            <Sub number="6.3" title="Prohibited Conduct">
              <p>You shall not, directly or indirectly:</p>
              <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
                <li>Attempt to gain unauthorised access to the Service, the Platform, or any system, network, or data associated therewith, through brute force, credential stuffing, or any other means;</li>
                <li>Probe, scan, or test the vulnerability of any system underlying the Service, or circumvent any security, authentication, or rate-limiting mechanism;</li>
                <li>Reverse engineer, decompile, disassemble, or derive the source code, algorithms, or architecture of the Service;</li>
                <li>Scrape, crawl, or harvest data from the Service using automated means;</li>
                <li>Introduce any harmful code, denial-of-service attack, or other interference with the Service's proper operation;</li>
                <li>Engage in any activity placing an unreasonable burden on PlanIt's infrastructure;</li>
                <li>Use the Service to collect Personal Data of other Users without their knowledge and consent;</li>
                <li>Circumvent or interfere with the Service's anti-fraud middleware, rate limiting systems, or technical protection measures;</li>
                <li>Assign, transfer, or sell your access rights to any third party.</li>
              </ul>
            </Sub>
            <Sub number="6.4" title="Enforcement Rights">
              <p>
                In the event of any actual, suspected, or alleged violation of this Section or any other provision of these Terms, PlanIt reserves the right, in its sole discretion and without prior notice, to remove or disable access to Content, suspend or terminate your access, take any technical or legal measures it deems appropriate, and report conduct it believes unlawful to appropriate authorities. PlanIt's failure to enforce any provision shall not constitute a waiver of its right to enforce such provision at any subsequent time.
              </p>
            </Sub>
          </Section>

          <Section number="7" title="User Content: Ownership, Licences, and Warranties">
            <Sub number="7.1" title="Ownership">
              <p>As between you and PlanIt, you retain all right, title, and interest in and to your User Content, subject to the licence granted in Section 7.2 and the data retention policy in Section 9.</p>
            </Sub>
            <Sub number="7.2" title="Licence Grant to PlanIt">
              <p>
                By making any User Content available through the Service, you grant PlanIt a worldwide, non-exclusive, royalty-free, sublicensable, transferable licence to host, store, reproduce, modify (for formatting and technical compatibility purposes only), process, transmit, and display such Content solely to the extent necessary to provide, operate, maintain, and improve the Service. This licence terminates upon the permanent deletion of your User Content from PlanIt's servers.
              </p>
            </Sub>
            <Sub number="7.3" title="Representations and Warranties">
              <p>With respect to each item of User Content, you represent and warrant that:</p>
              <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
                <li>You own or have obtained all necessary rights and permissions to upload such Content and grant PlanIt the licence described herein;</li>
                <li>Such Content does not infringe any third party's Intellectual Property Rights or other rights;</li>
                <li>Such Content does not violate any applicable law or contain any Prohibited Content;</li>
                <li>You have obtained all required consents from individuals whose Personal Data is included in such Content.</li>
              </ul>
            </Sub>
            <Sub number="7.4" title="No Monitoring Obligation">
              <p>
                PlanIt undertakes no obligation to pre-screen, review, or moderate User Content. PlanIt reserves the right but not the obligation to review, remove, or refuse any User Content that it determines, in its sole discretion, violates these Terms or is otherwise objectionable. PlanIt shall not be liable for any failure to remove violating Content or for any delay in doing so.
              </p>
            </Sub>
          </Section>

          <Section number="8" title="Intellectual Property Rights, Proprietary Technology, and Restrictions">
            <Sub number="8.1" title="PlanIt's Proprietary Rights">
              <p>
                The Service, the Platform, and all components thereof — including the software, source code, object code, application architecture, design, visual assets, user interface elements, database schemas, API structures, security systems, anti-fraud middleware, load balancing algorithms, monitoring infrastructure, documentation, trademarks, logos, and trade names — are and shall remain the exclusive proprietary property of the Operator, protected by applicable copyright, trademark, patent, trade secret, and other Intellectual Property Rights laws and international conventions.
              </p>
            </Sub>
            <Sub number="8.2" title="No Open Source Licence">
              <p>
                PlanIt is not, and shall not be construed as, open source software. Any reference to PlanIt in any public code repository does not constitute a grant of any licence, permission, or authorisation to use, reproduce, fork, clone, download, modify, distribute, sublicence, sell, or otherwise exploit the source code or any component thereof. Code visibility does not confer any rights beyond the right to view it in its published location for personal educational reference only.
              </p>
            </Sub>
            <Sub number="8.3" title="Limited Licence to Use">
              <p>
                Subject to your compliance with these Terms, PlanIt grants you a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable licence to access and use the Service for its intended purposes through the standard user interface. No licence, right, or interest beyond this is granted, whether by implication, estoppel, or otherwise.
              </p>
            </Sub>
            <Sub number="8.4" title="Restrictions">
              <p>You shall not:</p>
              <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
                <li>Copy, reproduce, modify, create derivative works from, or adapt any part of the Service;</li>
                <li>Distribute, sublicence, transfer, assign, sell, or commercialise the Service or any component thereof;</li>
                <li>Use PlanIt's name, logo, or trademarks in any manner likely to cause confusion as to any affiliation;</li>
                <li>Remove, alter, or obscure any copyright, trademark, or proprietary marking;</li>
                <li>Use the Service's architecture or design as a basis for any competing or derivative product.</li>
              </ul>
            </Sub>
            <Sub number="8.5" title="Technical Licence Enforcement">
              <p>
                The Platform incorporates a cryptographic licence integrity verification system operating at backend server initialisation and at periodic intervals thereafter, utilising HMAC-SHA256 proof chains derived from a deployment-specific licence key to verify authorised deployment. Deployments failing verification will refuse to initialise. This constitutes a technical enforcement mechanism and is not subject to circumvention or challenge.
              </p>
            </Sub>
          </Section>

          <Section number="9" title="Data Retention, Automated Deletion, and Recovery">
            <Sub number="9.1" title="Automatic Seven-Day Deletion Policy">
              <p>
                All Event data — including the Event record, all messages, tasks, polls, notes, announcements, expenses, uploaded files, Participant records, Guest invitation records, check-in logs, and analytics — is subject to permanent, irreversible automated deletion seven (7) calendar days following the Event's scheduled date. This policy applies universally to all Events and cannot be waived, extended, or suspended except as otherwise expressly stated by PlanIt in writing.
              </p>
            </Sub>
            <Sub number="9.2" title="Irrecoverability">
              <p>
                Following execution of the automated deletion process, all deleted data is permanently and irrecoverably removed. PlanIt has no capability to restore, recover, or reconstitute deleted data. You acknowledge that PlanIt bears no liability for any loss or consequence resulting from deletion pursuant to this policy.
              </p>
            </Sub>
            <Sub number="9.3" title="Organizer Export Obligation">
              <p>
                It is the sole responsibility of the Organizer to export or preserve any Event data required for any purpose prior to expiration of the retention window. PlanIt's provision of export functionality does not impose any obligation to preserve data beyond the window and shall not be construed as a warranty that data will be available for export at any particular time.
              </p>
            </Sub>
            <Sub number="9.4" title="Early Deletion Requests">
              <p>
                Organizers may request early deletion of Event data by contacting PlanIt via the details in Section 17. PlanIt will endeavour to action such requests within a reasonable timeframe but makes no binding commitment. PlanIt may decline requests where doing so would conflict with applicable legal obligations.
              </p>
            </Sub>
          </Section>

          <Section number="10" title="Third-Party Services and External Links">
            <p>
              The Service integrates with third-party services including Cloudinary, Upstash Redis, MongoDB Atlas, Render, and Socket.IO. Your use of such services may be subject to their own terms and policies. PlanIt makes no warranty regarding any third-party service's availability, reliability, or security, and expressly disclaims all liability arising from your use of or reliance on any third-party service or external link provided through or accessed via the Service.
            </p>
          </Section>

          <Section number="11" title="Privacy and Data Protection">
            <p>
              Your privacy and Personal Data are governed exclusively by the PlanIt Privacy Policy, incorporated herein by reference. By using the Service you acknowledge that you have read and agree to the Privacy Policy. Organizers who collect Personal Data of Guests or Participants through the Service act as independent data controllers and are solely responsible for ensuring that such collection and processing complies with all applicable data protection laws.
            </p>
          </Section>

          <Section number="12" title="Disclaimers and Exclusions of Warranties">
            <LegalCallout>
              THE FOLLOWING DISCLAIMERS APPLY TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW.
            </LegalCallout>
            <Sub number="12.1" title="As-Is Basis">
              <p>
                THE SERVICE IS PROVIDED ON AN "AS IS," "AS AVAILABLE," AND "WITH ALL FAULTS" BASIS WITHOUT ANY REPRESENTATION, WARRANTY, GUARANTEE, OR CONDITION OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. PLANIT EXPRESSLY DISCLAIMS ALL WARRANTIES INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, ACCURACY, AND NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.
              </p>
            </Sub>
            <Sub number="12.2" title="No Warranty of Availability">
              <p>
                PLANIT MAKES NO WARRANTY THAT: (A) THE SERVICE WILL BE AVAILABLE ON A CONTINUOUS, UNINTERRUPTED, OR ERROR-FREE BASIS; (B) DEFECTS WILL BE CORRECTED; (C) THE SERVICE WILL MEET YOUR REQUIREMENTS; (D) THE SERVICE OR ITS SERVERS ARE FREE FROM VIRUSES OR HARMFUL ELEMENTS; (E) ANY DATA OBTAINED THROUGH THE SERVICE WILL BE ACCURATE OR RELIABLE.
              </p>
            </Sub>
            <Sub number="12.3" title="Right to Modify and Discontinue">
              <p>
                PlanIt reserves the absolute right to modify, suspend, interrupt, or discontinue the Service or any feature thereof at any time without notice and without liability. PlanIt shall not be liable for any loss resulting from any such action.
              </p>
            </Sub>
          </Section>

          <Section number="13" title="Limitation of Liability">
            <LegalCallout>
              THE FOLLOWING LIMITATIONS APPLY TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW.
            </LegalCallout>
            <Sub number="13.1" title="Exclusion of Indirect Damages">
              <p>
                TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT SHALL PLANIT, ITS OPERATOR, OR THEIR RESPECTIVE AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS INTERRUPTION, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICE, REGARDLESS OF THE THEORY OF LIABILITY, EVEN IF PLANIT HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
            </Sub>
            <Sub number="13.2" title="Aggregate Cap">
              <p>
                PLANIT'S TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING UNDER THIS AGREEMENT SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL AMOUNTS YOU HAVE PAID PLANIT IN THE TWELVE MONTHS PRECEDING THE CLAIM; OR (B) ZERO UNITED STATES DOLLARS (USD $0.00). AS PLANIT IS A FREE SERVICE, THIS MEANS AGGREGATE LIABILITY IS EFFECTIVELY ZERO.
              </p>
            </Sub>
            <Sub number="13.3" title="Essential Basis">
              <p>
                You acknowledge that the disclaimers and limitations of liability in Sections 12 and 13 reflect a reasonable and fair allocation of risk and are an essential element of the basis of the bargain between you and PlanIt.
              </p>
            </Sub>
          </Section>

          <Section number="14" title="Indemnification">
            <p>
              To the fullest extent permitted by law, you shall indemnify, defend, and hold harmless PlanIt, its Operator, and their respective agents from and against all claims, liabilities, damages, costs, and expenses — including reasonable legal fees — arising out of or relating to: (a) your access to or use of the Service; (b) your User Content; (c) your breach of any representation, warranty, or obligation herein; (d) your violation of any applicable law or third party's rights; (e) any dispute between you and any other User or third party; or (f) your operation of an Event.
            </p>
          </Section>

          <Section number="15" title="Termination and Effect">
            <Sub number="15.1" title="Termination by PlanIt">
              <p>
                PlanIt reserves the right to immediately suspend or permanently terminate your access to the Service at any time, without notice or liability, including but not limited to your breach of these Terms, conduct harmful to other Users or the Service, or any legal, regulatory, or business reason PlanIt deems sufficient.
              </p>
            </Sub>
            <Sub number="15.2" title="Termination by You">
              <p>
                You may terminate use of the Service at any time by ceasing access. All Event data remains subject to the seven-day deletion policy in Section 9.
              </p>
            </Sub>
            <Sub number="15.3" title="Survival">
              <p>
                Sections 1, 7, 8, 9, 11, 12, 13, 14, 15.3, 16, 17, 18, and 19 survive termination of this Agreement for any reason.
              </p>
            </Sub>
          </Section>

          <Section number="16" title="Governing Law and Dispute Resolution">
            <Sub number="16.1" title="Governing Law">
              <p>
                These Terms and all disputes arising hereunder shall be governed by and construed in accordance with applicable law, without regard to conflict of law principles.
              </p>
            </Sub>
            <Sub number="16.2" title="Informal Resolution">
              <p>
                Prior to initiating any formal proceeding, you agree to contact PlanIt at the address in Section 17 and make a good-faith effort to resolve the dispute informally. PlanIt will endeavour to respond within thirty (30) days. This process is a condition precedent to initiating any formal proceeding.
              </p>
            </Sub>
            <Sub number="16.3" title="Limitation Period">
              <p>
                Any cause of action arising out of or related to these Terms or the Service must be commenced within one (1) year after it accrues; otherwise it is permanently barred to the fullest extent permitted by law.
              </p>
            </Sub>
          </Section>

          <Section number="17" title="Miscellaneous Provisions">
            <Sub number="17.1" title="Entire Agreement">
              <p>These Terms and incorporated policies constitute the entire agreement between you and PlanIt and supersede all prior negotiations, representations, and agreements relating to the subject matter hereof.</p>
            </Sub>
            <Sub number="17.2" title="Waiver">
              <p>No failure by PlanIt to exercise any right or remedy shall constitute a waiver thereof. No waiver is effective unless in writing and signed by an authorised representative of PlanIt.</p>
            </Sub>
            <Sub number="17.3" title="Severability">
              <p>If any provision is held invalid or unenforceable, it shall be severed and the remaining provisions shall continue in full force and effect.</p>
            </Sub>
            <Sub number="17.4" title="Assignment">
              <p>You may not assign any rights or obligations hereunder without PlanIt's prior written consent. PlanIt may freely assign this Agreement in connection with a merger, acquisition, or sale of assets.</p>
            </Sub>
            <Sub number="17.5" title="Force Majeure">
              <p>PlanIt shall not be liable for failure or delay in performance arising from circumstances beyond its reasonable control, including acts of God, pandemic, war, cyberattacks, infrastructure failures, or internet service provider outages.</p>
            </Sub>
            <Sub number="17.6" title="No Third-Party Beneficiaries">
              <p>These Terms are for the sole benefit of the parties hereto. Nothing herein confers any right or benefit on any other person or entity.</p>
            </Sub>
          </Section>

          <Section number="18" title="Changes to the Service and These Terms">
            <p>
              PlanIt reserves the right at any time to modify, restrict, suspend, or discontinue any aspect of the Service and to amend these Terms in its sole discretion. The most current version governs your use. Continued use following posting of revised Terms constitutes binding acceptance thereof.
            </p>
          </Section>

          <Section number="19" title="DMCA Copyright Policy and Notice-and-Takedown Procedures">
            <p>
              PlanIt respects the intellectual property rights of others and expects all Users to do the same. PlanIt complies with the Digital Millennium Copyright Act of 1998 (17 U.S.C. § 512) ("DMCA") and will respond to notices of alleged copyright infringement that comply with the DMCA and other applicable intellectual property laws.
            </p>
            <Sub number="19.1" title="Designation of Copyright Agent">
              <p>
                PlanIt's designated agent for receiving notifications of claimed copyright infringement is:
              </p>
              <div className="mt-3 p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1 text-sm">
                <p><strong className="text-neutral-900">Designated Agent:</strong> Aakshat Hariharan</p>
                <p><strong className="text-neutral-900">Email:</strong> <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 underline underline-offset-2">planit.userhelp@gmail.com</a></p>
                <p><strong className="text-neutral-900">Subject line:</strong> DMCA Copyright Notice</p>
              </div>
            </Sub>
            <Sub number="19.2" title="Filing a DMCA Takedown Notice">
              <p>
                If you believe that Content available on or through the Service infringes a copyright you own or control, you may submit a written notice of claimed infringement to the designated agent above. To be valid under the DMCA, your notice must include ALL of the following:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
                <li>A physical or electronic signature of a person authorised to act on behalf of the copyright owner;</li>
                <li>Identification of the copyrighted work(s) claimed to have been infringed, or, if multiple works at a single site are covered by a single notification, a representative list of such works;</li>
                <li>Identification of the material claimed to be infringing, with sufficient specificity to permit PlanIt to locate the material on the Service (including the event URL, feature, and description of the Content);</li>
                <li>Adequate information by which PlanIt may contact you (name, address, telephone number, and email address);</li>
                <li>A statement by you that you have a good-faith belief that the disputed use is not authorised by the copyright owner, its agent, or the law;</li>
                <li>A statement by you, made under penalty of perjury, that the information in the notification is accurate and that you are authorised to act on behalf of the copyright owner.</li>
              </ul>
              <p className="mt-3">
                Incomplete or deficient notices will not be actioned. Submitting a knowingly false or misleading DMCA notice may expose you to civil liability and criminal prosecution.
              </p>
            </Sub>
            <Sub number="19.3" title="Counter-Notice Procedures">
              <p>
                If you believe that Content you submitted was removed or disabled as a result of a mistake or misidentification, you may submit a counter-notice to the designated agent. To be valid, your counter-notice must include:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-3 mt-2">
                <li>Your physical or electronic signature;</li>
                <li>Identification of the Content that has been removed and the location at which it appeared before removal;</li>
                <li>A statement under penalty of perjury that you have a good-faith belief that the Content was removed as a result of a mistake or misidentification;</li>
                <li>Your name, address, telephone number, and a statement that you consent to the jurisdiction of the federal district court in which your address is located (or the Northern District of California if your address is outside the United States), and that you will accept service of process from the person who submitted the original notice.</li>
              </ul>
              <p className="mt-3">
                Upon receipt of a valid counter-notice, PlanIt will notify the original complainant. PlanIt may, in its sole and absolute discretion, restore the removed Content no sooner than ten (10) and no later than fourteen (14) business days after receiving a valid counter-notice, unless the copyright owner files an action seeking a court order against the User before that time.
              </p>
            </Sub>
            <Sub number="19.4" title="Repeat Infringer Policy">
              <p>
                In accordance with the DMCA and other applicable laws, PlanIt maintains a policy of terminating, in appropriate circumstances and in its sole and absolute discretion, the access rights of Users who are deemed to be repeat infringers. PlanIt reserves the right to determine, in its sole discretion, whether a User is a repeat infringer. A User may be designated a repeat infringer upon receiving two or more substantiated DMCA notices involving Content within that User's events, without prejudice to PlanIt's right to act on the first valid notice where circumstances warrant.
              </p>
            </Sub>
          </Section>

          <Section number="20" title="Dispute Resolution, Arbitration, Class Action Waiver, and Jury Trial Waiver">
            <LegalCallout>
              PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT, YOUR RIGHT TO A JURY TRIAL, AND YOUR RIGHT TO PARTICIPATE IN A CLASS ACTION.
            </LegalCallout>
            <Sub number="19.1" title="Informal Resolution as Condition Precedent">
              <p>
                Before initiating any formal legal proceeding of any kind against PlanIt, you agree to first contact PlanIt at planit.userhelp@gmail.com and provide a written description of the dispute, the relief sought, and your contact information. The parties shall negotiate in good faith for a period of not less than thirty (30) days following notice. Satisfaction of this informal resolution process is a mandatory condition precedent to initiating any arbitration or litigation, and any proceeding commenced without satisfaction of this condition shall be subject to dismissal.
              </p>
            </Sub>
            <Sub number="19.2" title="Binding Arbitration">
              <p>
                To the maximum extent permitted by applicable law, any dispute, controversy, or claim arising out of or relating to these Terms, your use of the Service, or any relationship between you and PlanIt — whether based in contract, tort, statute, fraud, misrepresentation, or any other legal theory — shall be submitted to and finally resolved by binding individual arbitration rather than in court. The arbitration shall be conducted on a confidential basis. This agreement to arbitrate is intended to be broadly interpreted, including without limitation disputes about the interpretation, scope, validity, or enforceability of these Terms. Any arbitral award shall be in writing and shall be final and binding on both parties.
              </p>
            </Sub>
            <Sub number="19.3" title="Class Action and Representative Action Waiver">
              <p>
                YOU AND PLANIT EACH EXPRESSLY AND IRREVOCABLY WAIVE ANY RIGHT TO PURSUE OR PARTICIPATE IN ANY CLASS ACTION, COLLECTIVE ACTION, CONSOLIDATED ACTION, PRIVATE ATTORNEY GENERAL ACTION, OR REPRESENTATIVE ACTION IN CONNECTION WITH ANY DISPUTE ARISING UNDER THESE TERMS OR YOUR USE OF THE SERVICE. All disputes shall be resolved solely on an individual basis. You may not bring a claim as a plaintiff or class member in any class or representative proceeding. The arbitrator shall have no authority to consolidate more than one person's claims, conduct any class or representative proceeding, or award any relief to any person other than you individually. This waiver is an essential element of the agreement to arbitrate in Section 21.2.
              </p>
            </Sub>
            <Sub number="19.4" title="Jury Trial Waiver">
              <p>
                TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, EACH PARTY HEREBY IRREVOCABLY AND UNCONDITIONALLY WAIVES ANY AND ALL RIGHTS TO A JURY TRIAL IN CONNECTION WITH ANY ACTION, PROCEEDING, CLAIM, OR COUNTERCLAIM ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE. Either party may enforce this waiver to the maximum extent permitted by law.
              </p>
            </Sub>
            <Sub number="20.5" title="Injunctive Relief Exception">
              <p>
                Notwithstanding any provision of this Section to the contrary, each party retains the right to seek and obtain emergency injunctive or other equitable relief from any court of competent jurisdiction, without bond, without notice, and without awaiting the conclusion of informal resolution or arbitration proceedings, where such relief is necessary to prevent irreparable harm. Seeking such relief shall not waive the right to arbitrate other disputes.
              </p>
            </Sub>
            <Sub number="20.6" title="Severability of Arbitration Provisions">
              <p>
                If any part of the arbitration agreement in this Section is found to be invalid or unenforceable, the remainder shall continue in full force and effect, except that if the class action waiver in Section 21.3 is found invalid, the entire arbitration agreement shall be null and void as to that dispute only, and such dispute shall proceed in a court of competent jurisdiction.
              </p>
            </Sub>
          </Section>

          <Section number="21" title="Security, Infrastructure, and Technical Disclaimers">
            <Sub number="19.1" title="Third-Party Infrastructure Dependency">
              <p>
                The Service is hosted on and depends entirely upon third-party infrastructure providers, including without limitation Render (application hosting), MongoDB Atlas (database services), Cloudinary (media storage and delivery), and Upstash Redis (caching and rate-limiting). PlanIt has no control over the operations, uptime, data practices, security posture, or terms of service of any such provider. Any disruption, failure, breach, or change to any third-party provider may directly affect the availability, performance, or security of the Service. PlanIt expressly disclaims all liability arising from the acts, omissions, security failures, or service interruptions of any third-party infrastructure provider.
              </p>
            </Sub>
            <Sub number="19.2" title="No Guarantee of Availability">
              <p>
                THE SERVICE IS PROVIDED ON A BEST-EFFORTS BASIS ONLY. PLANIT MAKES NO REPRESENTATION, WARRANTY, OR GUARANTEE THAT THE SERVICE WILL BE AVAILABLE ON A CONTINUOUS, UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE BASIS. The Service may be unavailable due to, without limitation: scheduled or unscheduled maintenance; provider outages; network failures; infrastructure upgrades; cyberattacks; software bugs; capacity constraints; or any other technical or non-technical cause. PlanIt shall not be liable for any damages, losses, or costs arising from any period of unavailability, however caused.
              </p>
            </Sub>
            <Sub number="19.3" title="Denial-of-Service and Cyberattack Disclaimer">
              <p>
                PlanIt implements commercially reasonable technical safeguards against distributed denial-of-service attacks, credential stuffing, and other malicious network activity; however, PlanIt makes no guarantee that such safeguards will be effective against all attacks. PlanIt expressly disclaims all liability for any loss of data, service outage, data exposure, or other harm arising from any cyberattack, including without limitation denial-of-service attacks, brute force attacks, man-in-the-middle attacks, or any other form of malicious interference with the Service or its underlying infrastructure.
              </p>
            </Sub>
            <Sub number="19.4" title="Technical Vulnerabilities">
              <p>
                No software system is free from technical vulnerabilities. PlanIt uses commercially reasonable practices to identify and remediate known vulnerabilities but makes no warranty that the Service is free from all vulnerabilities at any given time. You acknowledge and agree that PlanIt shall not be liable for any harm arising from technical vulnerabilities in the Service or in any third-party dependency. You are prohibited from testing or probing for vulnerabilities without express written authorisation from PlanIt. Any discovered vulnerability must be reported immediately and exclusively to planit.userhelp@gmail.com and must not be publicly disclosed or exploited.
              </p>
            </Sub>
            <Sub number="20.5" title="Data Loss Risk">
              <p>
                You acknowledge that all data stored in connection with the Service is subject to loss, corruption, or unavailability for reasons including without limitation hardware failure, software error, network disruption, Automatic Deletion pursuant to Section 9, third-party provider failure, and malicious activity. You are solely responsible for maintaining independent backups of any Content or data you require. PlanIt shall have no liability whatsoever for any loss of data, whether arising from Automatic Deletion, accidental loss, technical failure, or any other cause.
              </p>
            </Sub>
          </Section>

          <Section number="22" title="Beta Features, Experimental Functionality, and Feature Modifications">
            <Sub number="19.1" title="Beta and Experimental Features">
              <p>
                PlanIt may, from time to time, make available features, modules, or functionality that are in beta, pre-release, experimental, or preview stage ("Beta Features"). Beta Features are provided strictly "as is" and "as available" without any warranty of any kind. Beta Features may be incomplete, subject to change, contain errors, behave unexpectedly, or be discontinued entirely without notice. Your use of any Beta Feature constitutes your express acknowledgement and acceptance of the elevated risk and instability associated with such features. PlanIt shall bear no liability for any damages, data loss, or adverse outcomes arising from your use of Beta Features.
              </p>
            </Sub>
            <Sub number="19.2" title="Feature Modification and Removal">
              <p>
                PlanIt reserves the right, in its sole and absolute discretion and without prior notice or liability, to modify, redesign, replace, restrict, suspend, or permanently remove any feature or aspect of the Service at any time. This includes without limitation features that you currently use and rely upon. PlanIt's obligation is to provide access to the Service as it exists at any given time, not to preserve any particular feature set. You have no vested right in the continuity of any feature.
              </p>
            </Sub>
            <Sub number="19.3" title="No Reliance on Feature Continuity">
              <p>
                You represent, warrant, and covenant that you shall not make any business, financial, operational, or personal decision based on reliance upon the continued availability, pricing, performance, or form of any specific feature of the Service. PlanIt shall bear no liability for any damages arising from the modification, removal, or discontinuation of any feature.
              </p>
            </Sub>
          </Section>

          <Section number="23" title="No Reliance; No Third-Party Representations; Reservation of Rights">
            <Sub number="19.1" title="No Reliance">
              <p>
                You acknowledge and agree that you have not relied upon any statement, representation, warranty, promise, assurance, or undertaking made or given by or on behalf of PlanIt, whether orally or in writing, other than as expressly set out in these Terms, in deciding to access or use the Service. No marketing materials, sales communications, website copy, blog posts, documentation, or verbal statements shall constitute representations or warranties by PlanIt and shall not give rise to any cause of action unless expressly incorporated in writing into these Terms by a duly authorised representative of PlanIt.
              </p>
            </Sub>
            <Sub number="19.2" title="Reservation of Rights">
              <p>
                All rights not expressly granted in these Terms are reserved by PlanIt. Nothing in these Terms shall be construed as granting by implication, estoppel, laches, or otherwise any licence, right, or permission to use any of PlanIt's Intellectual Property Rights or proprietary assets, other than as expressly stated herein. The exercise of PlanIt's rights under these Terms shall not constitute a waiver of any other rights available at law or in equity, all of which are expressly reserved.
              </p>
            </Sub>
            <Sub number="19.3" title="No Agency or Partnership">
              <p>
                Nothing in these Terms shall be construed to create any agency, partnership, joint venture, employment relationship, or franchise between you and PlanIt. You have no authority to bind PlanIt in any manner whatsoever, and you shall not represent to any third party that any such relationship exists.
              </p>
            </Sub>
          </Section>

          <Section number="24" title="Contact Information and Notices">
            <p>All inquiries, reports, legal notices, and correspondence should be directed to:</p>
            <div className="mt-4 p-5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2 text-sm">
              <p><strong className="text-neutral-900">Operator:</strong> Aakshat Hariharan</p>
              <p><strong className="text-neutral-900">Operating name:</strong> PlanIt</p>
              <p><strong className="text-neutral-900">Email:</strong>{' '}
                <a href="mailto:planit.userhelp@gmail.com" className="text-neutral-900 font-medium underline underline-offset-2">planit.userhelp@gmail.com</a>
              </p>
              <p><strong className="text-neutral-900">Support page:</strong>{' '}
                <a href="/support" className="text-neutral-900 font-medium underline underline-offset-2">planitapp.onrender.com/support</a>
              </p>
              <p><strong className="text-neutral-900">Response time:</strong> PlanIt endeavours to respond within 48 business hours. Complex legal or technical matters may take longer.</p>
              <p><strong className="text-neutral-900">Scope:</strong> Legal notices, Terms inquiries, privacy requests, DMCA notices, bug reports, early deletion requests, abuse reports.</p>
            </div>
          </Section>

          <div className="mt-10 p-6 bg-neutral-900 rounded-xl">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Plain-Language Summary (non-binding)</p>
            <p className="text-sm text-neutral-300 leading-relaxed">
              By using PlanIt you agree to use it lawfully, to own what you submit, and to understand that all event data is permanently deleted seven days after the event — so export anything you need first. PlanIt is free, provided as-is, with no guarantees of uptime or fitness for any purpose. We can remove your access for any reason at any time. Disputes come to us directly first. All rights to PlanIt's software, design, and architecture are reserved. If something is unclear, contact us.
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
