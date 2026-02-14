import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Shield, Lock, Eye, Database, UserCheck } from 'lucide-react';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50 to-accent-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="btn btn-secondary p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-primary-500 to-accent-500 p-2 rounded-xl">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-display font-bold text-neutral-900">Privacy Policy</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 p-8 md:p-12">
          <div className="mb-8">
            <h1 className="text-4xl font-display font-bold text-neutral-900 mb-4">
              Privacy Policy
            </h1>
            <p className="text-neutral-600">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div className="prose prose-neutral max-w-none">
            {/* Introduction */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">1. Introduction</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                At Plan It, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, 
                and safeguard your information when you use our event planning service.
              </p>
              <p className="text-neutral-700 leading-relaxed">
                Please read this Privacy Policy carefully. By using Plan It, you agree to the collection and use of 
                information in accordance with this policy.
              </p>
            </section>

            {/* Information We Collect */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">2. Information We Collect</h2>
              
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Database className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">2.1 Information You Provide</h3>
                      <p className="text-sm text-blue-800 mb-3">
                        We collect information that you voluntarily provide when using our Service:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 ml-4">
                        <li><strong>Account Information:</strong> Name, email address when creating events</li>
                        <li><strong>Event Information:</strong> Event title, description, date, location, passwords</li>
                        <li><strong>Chat Messages:</strong> Messages sent in event chats</li>
                        <li><strong>Poll Responses:</strong> Your votes in event polls</li>
                        <li><strong>File Uploads:</strong> Documents and media you share</li>
                        <li><strong>Participant Information:</strong> Usernames chosen when joining events</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Eye className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-semibold text-green-900 mb-2">2.2 Automatically Collected Information</h3>
                      <p className="text-sm text-green-800 mb-3">
                        When you access our Service, we automatically collect certain information:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-green-800 ml-4">
                        <li><strong>Usage Data:</strong> Pages visited, features used, time spent</li>
                        <li><strong>Device Information:</strong> Browser type, operating system, device identifiers</li>
                        <li><strong>IP Address:</strong> For security and analytics purposes</li>
                        <li><strong>Cookies:</strong> Session cookies for authentication and preferences</li>
                        <li><strong>Log Data:</strong> Error logs and performance metrics</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* How We Use Information */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                We use the collected information for various purposes:
              </p>
              <ul className="space-y-3 text-neutral-700">
                <li className="flex gap-3">
                  <span className="text-primary-600 font-bold">•</span>
                  <span><strong>Provide Services:</strong> To operate and maintain Plan It's features</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary-600 font-bold">•</span>
                  <span><strong>Communication:</strong> To send event notifications and service updates</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary-600 font-bold">•</span>
                  <span><strong>Improve Service:</strong> To analyze usage and enhance user experience</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary-600 font-bold">•</span>
                  <span><strong>Security:</strong> To detect, prevent, and address technical issues and fraud</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary-600 font-bold">•</span>
                  <span><strong>Compliance:</strong> To comply with legal obligations</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary-600 font-bold">•</span>
                  <span><strong>Analytics:</strong> To understand how users interact with our Service</span>
                </li>
              </ul>
            </section>

            {/* Data Sharing */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">4. Information Sharing and Disclosure</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800 mb-2">4.1 Event Participants</h3>
                  <p className="text-neutral-700 leading-relaxed">
                    Information you share within an event (messages, poll votes, files) is visible to other participants 
                    of that event. Event organizers have access to all event data.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800 mb-2">4.2 Service Providers</h3>
                  <p className="text-neutral-700 leading-relaxed">
                    We may share your information with third-party service providers who assist us in operating the Service, 
                    such as hosting providers and analytics services. These providers are bound by confidentiality agreements.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800 mb-2">4.3 Legal Requirements</h3>
                  <p className="text-neutral-700 leading-relaxed">
                    We may disclose your information if required by law or in response to valid legal requests by public 
                    authorities.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800 mb-2">4.4 Business Transfers</h3>
                  <p className="text-neutral-700 leading-relaxed">
                    In the event of a merger, acquisition, or sale of assets, your information may be transferred. 
                    We will notify you of any such change.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800 mb-2">4.5 What We Don't Share</h3>
                  <p className="text-neutral-700 leading-relaxed font-semibold text-green-700">
                    We do not sell, rent, or trade your personal information to third parties for marketing purposes.
                  </p>
                </div>
              </div>
            </section>

            {/* Data Security */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">5. Data Security</h2>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <div className="flex gap-3">
                  <Lock className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-semibold text-purple-900 mb-2">Our Security Measures</h3>
                    <p className="text-sm text-purple-800 mb-3">
                      We implement industry-standard security measures to protect your information:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-purple-800 ml-4">
                      <li>Encryption in transit (HTTPS/TLS)</li>
                      <li>Secure password hashing (bcrypt)</li>
                      <li>JWT-based authentication</li>
                      <li>Input validation and sanitization</li>
                      <li>Regular security audits</li>
                      <li>Access controls and monitoring</li>
                    </ul>
                  </div>
                </div>
              </div>
              <p className="text-neutral-700 leading-relaxed">
                However, no method of transmission over the internet or electronic storage is 100% secure. While we strive 
                to protect your information, we cannot guarantee absolute security.
              </p>
            </section>

            {/* Data Retention */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">6. Data Retention</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                We retain your information for as long as necessary to provide our Service and fulfill the purposes 
                outlined in this Privacy Policy:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                <li><strong>Active Events:</strong> Data is retained for the duration of the event and a reasonable 
                period after completion</li>
                <li><strong>Deleted Events:</strong> May be retained for up to 30 days for recovery purposes</li>
                <li><strong>Account Data:</strong> Retained while your account is active</li>
                <li><strong>Legal Compliance:</strong> Some data may be retained longer to comply with legal obligations</li>
              </ul>
            </section>

            {/* Your Rights */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">7. Your Privacy Rights</h2>
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
                <div className="flex gap-3">
                  <UserCheck className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-semibold text-primary-900 mb-2">You Have the Right To:</h3>
                    <ul className="list-disc list-inside space-y-2 text-sm text-primary-800 ml-4">
                      <li><strong>Access:</strong> Request a copy of the information we hold about you</li>
                      <li><strong>Correction:</strong> Request correction of inaccurate information</li>
                      <li><strong>Deletion:</strong> Request deletion of your information (subject to legal requirements)</li>
                      <li><strong>Data Portability:</strong> Request export of your data in a machine-readable format</li>
                      <li><strong>Withdraw Consent:</strong> Withdraw consent for data processing at any time</li>
                      <li><strong>Object:</strong> Object to certain types of processing</li>
                    </ul>
                  </div>
                </div>
              </div>
              <p className="text-neutral-700 leading-relaxed">
                To exercise these rights, please contact us at privacy@planit.example.com. We will respond to your request 
                within 30 days.
              </p>
            </section>

            {/* Cookies */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">8. Cookies and Tracking</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                We use cookies and similar tracking technologies to track activity on our Service and hold certain information:
              </p>
              <ul className="space-y-3 text-neutral-700">
                <li><strong>Essential Cookies:</strong> Required for authentication and basic functionality</li>
                <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how you use the Service</li>
              </ul>
              <p className="text-neutral-700 leading-relaxed mt-4">
                You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, 
                if you do not accept cookies, you may not be able to use some portions of our Service.
              </p>
            </section>

            {/* Children's Privacy */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">9. Children's Privacy</h2>
              <p className="text-neutral-700 leading-relaxed">
                Our Service is not intended for children under the age of 13. We do not knowingly collect personal 
                information from children under 13. If you become aware that a child has provided us with personal 
                information, please contact us, and we will take steps to delete such information.
              </p>
            </section>

            {/* International Users */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">10. International Data Transfers</h2>
              <p className="text-neutral-700 leading-relaxed">
                Your information may be transferred to and maintained on servers located outside of your state, province, 
                country, or other governmental jurisdiction where data protection laws may differ. By using Plan It, you 
                consent to such transfers.
              </p>
            </section>

            {/* Third-Party Links */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">11. Third-Party Links</h2>
              <p className="text-neutral-700 leading-relaxed">
                Our Service may contain links to third-party websites. We are not responsible for the privacy practices 
                of these external sites. We encourage you to review the privacy policies of any third-party sites you visit.
              </p>
            </section>

            {/* Changes */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">12. Changes to This Privacy Policy</h2>
              <p className="text-neutral-700 leading-relaxed">
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new 
                Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy 
                Policy periodically for any changes.
              </p>
            </section>

            {/* Contact */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">13. Contact Us</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <p className="text-neutral-700 mb-2">
                  <strong>Email:</strong> privacy@planit.example.com
                </p>
                <p className="text-neutral-700 mb-2">
                  <strong>Address:</strong> Plan It Privacy Team, [Your Address]
                </p>
                <p className="text-neutral-700">
                  <strong>Response Time:</strong> We aim to respond within 48 hours
                </p>
              </div>
            </section>

            {/* GDPR Compliance */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">14. GDPR Compliance (EU Users)</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                If you are in the European Economic Area (EEA), you have additional rights under GDPR:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                <li>Right to access your personal data</li>
                <li>Right to rectification of inaccurate data</li>
                <li>Right to erasure ("right to be forgotten")</li>
                <li>Right to restrict processing</li>
                <li>Right to data portability</li>
                <li>Right to object to processing</li>
                <li>Right to lodge a complaint with a supervisory authority</li>
              </ul>
            </section>

            {/* Commitment */}
            <section>
              <div className="bg-primary-50 border-2 border-primary-300 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-primary-900 mb-3">Our Privacy Commitment</h3>
                <p className="text-primary-800 mb-3">
                  At Plan It, we are committed to protecting your privacy and being transparent about our data practices. 
                  We will:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-primary-800 ml-4">
                  <li>Only collect data necessary to provide our Service</li>
                  <li>Never sell your personal information</li>
                  <li>Keep your data secure with industry-standard practices</li>
                  <li>Be transparent about what data we collect and why</li>
                  <li>Respect your privacy rights and respond promptly to requests</li>
                </ul>
              </div>
            </section>
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="btn btn-secondary inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
