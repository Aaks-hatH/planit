import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Shield, AlertCircle } from 'lucide-react';

export default function Terms() {
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
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-display font-bold text-neutral-900">Terms of Service</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 p-8 md:p-12">
          <div className="mb-8">
            <h1 className="text-4xl font-display font-bold text-neutral-900 mb-4">
              Terms of Service
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
                Welcome to Plan It. These Terms of Service ("Terms") govern your access to and use of Plan It's services, 
                including our website, applications, and any related services (collectively, the "Service").
              </p>
              <p className="text-neutral-700 leading-relaxed">
                By accessing or using our Service, you agree to be bound by these Terms. If you do not agree to these Terms, 
                please do not use the Service.
              </p>
            </section>

            {/* Acceptance */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">2. Acceptance of Terms</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                By creating an event or participating in an event on Plan It, you acknowledge that you have read, understood, 
                and agree to be bound by these Terms and our Privacy Policy.
              </p>
              <p className="text-neutral-700 leading-relaxed">
                We reserve the right to modify these Terms at any time. Continued use of the Service after changes are posted 
                constitutes acceptance of the modified Terms.
              </p>
            </section>

            {/* User Accounts */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">3. User Accounts and Responsibilities</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800 mb-2">3.1 Account Creation</h3>
                  <p className="text-neutral-700 leading-relaxed">
                    When creating an event, you must provide accurate and complete information. You are responsible for 
                    maintaining the confidentiality of your event password and for all activities that occur under your event.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800 mb-2">3.2 User Conduct</h3>
                  <p className="text-neutral-700 leading-relaxed mb-3">You agree not to:</p>
                  <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                    <li>Use the Service for any illegal or unauthorized purpose</li>
                    <li>Violate any laws in your jurisdiction</li>
                    <li>Transmit any harmful code, viruses, or malicious software</li>
                    <li>Harass, abuse, or harm other users</li>
                    <li>Impersonate any person or entity</li>
                    <li>Collect or store personal data about other users without permission</li>
                    <li>Interfere with or disrupt the Service or servers</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Content */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">4. Content and Intellectual Property</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800 mb-2">4.1 User Content</h3>
                  <p className="text-neutral-700 leading-relaxed">
                    You retain ownership of any content you create or upload to the Service ("User Content"). By uploading 
                    User Content, you grant Plan It a non-exclusive, worldwide, royalty-free license to use, store, and 
                    display that content solely for the purpose of providing and improving the Service.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800 mb-2">4.2 Content Responsibility</h3>
                  <p className="text-neutral-700 leading-relaxed">
                    You are solely responsible for all User Content you post. Plan It does not endorse and is not responsible 
                    for User Content. We reserve the right to remove any content that violates these Terms or is otherwise 
                    objectionable.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800 mb-2">4.3 Plan It's Intellectual Property</h3>
                  <p className="text-neutral-700 leading-relaxed">
                    The Service and its original content, features, and functionality are owned by Plan It and are protected 
                    by international copyright, trademark, and other intellectual property laws.
                  </p>
                </div>
              </div>
            </section>

            {/* Privacy */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">5. Privacy and Data Protection</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your information. 
                By using the Service, you consent to our collection and use of information as described in the Privacy Policy.
              </p>
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <Shield className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-primary-900 mb-1">Data Security</p>
                    <p className="text-sm text-primary-800">
                      We implement appropriate security measures to protect your data. However, no method of transmission 
                      over the internet is 100% secure.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Service Availability */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">6. Service Availability</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                We strive to provide reliable service, but we do not guarantee that the Service will always be available, 
                uninterrupted, or error-free. We reserve the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                <li>Modify or discontinue the Service (or any part thereof) at any time</li>
                <li>Perform scheduled or emergency maintenance</li>
                <li>Impose limits on certain features or restrict access to parts of the Service</li>
              </ul>
            </section>

            {/* Termination */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">7. Termination</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any 
                reason, including breach of these Terms.
              </p>
              <p className="text-neutral-700 leading-relaxed">
                Upon termination, your right to use the Service will immediately cease. All provisions of these Terms that 
                by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, 
                and limitations of liability.
              </p>
            </section>

            {/* Disclaimers */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">8. Disclaimers and Limitations</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-yellow-900 mb-1">Important Notice</p>
                    <p className="text-sm text-yellow-800">
                      The Service is provided "as is" without warranties of any kind, either express or implied.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-neutral-700 leading-relaxed mb-4">
                Plan It disclaims all warranties, including but not limited to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4 mb-4">
                <li>Merchantability and fitness for a particular purpose</li>
                <li>Non-infringement</li>
                <li>Accuracy, reliability, or availability of the Service</li>
                <li>That the Service will meet your requirements or be error-free</li>
              </ul>
              <p className="text-neutral-700 leading-relaxed">
                In no event shall Plan It be liable for any indirect, incidental, special, consequential, or punitive damages, 
                including loss of profits, data, or goodwill.
              </p>
            </section>

            {/* Indemnification */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">9. Indemnification</h2>
              <p className="text-neutral-700 leading-relaxed">
                You agree to indemnify and hold harmless Plan It and its officers, directors, employees, and agents from any 
                claims, damages, losses, liabilities, and expenses (including legal fees) arising out of your use of the Service, 
                your User Content, or your violation of these Terms.
              </p>
            </section>

            {/* Governing Law */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">10. Governing Law</h2>
              <p className="text-neutral-700 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which 
                Plan It operates, without regard to its conflict of law provisions.
              </p>
            </section>

            {/* Changes */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">11. Changes to Terms</h2>
              <p className="text-neutral-700 leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify users of any material changes by 
                posting the new Terms on this page and updating the "Last updated" date. Your continued use of the Service 
                after such modifications constitutes acceptance of the updated Terms.
              </p>
            </section>

            {/* Contact */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">12. Contact Information</h2>
              <p className="text-neutral-700 leading-relaxed mb-4">
                If you have any questions about these Terms, please contact us:
              </p>
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <p className="text-neutral-700 mb-2">
                  <strong>Email:</strong> planit.userhelp@gmail.com
                </p>
                <p className="text-neutral-700">
                  <strong>Subject:</strong> Plan It Legal Department, [Your Subject]
                </p>
              </div>
            </section>

            {/* Acceptance */}
            <section>
              <div className="bg-primary-50 border-2 border-primary-300 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-primary-900 mb-3">Acceptance of Terms</h3>
                <p className="text-primary-800">
                  By using Plan It, you acknowledge that you have read, understood, and agree to be bound by these Terms of 
                  Service and our Privacy Policy. If you do not agree, please do not use our Service.
                </p>
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
