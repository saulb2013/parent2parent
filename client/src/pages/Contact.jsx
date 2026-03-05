import { useState } from 'react';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: 'General Enquiry', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary-dark to-primary py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">
            We're Here for You
          </h1>
          <p className="mt-4 text-lg text-green-100 max-w-2xl mx-auto">
            Got a question, a concern, or just want to say hello? We're a small, parent-run team and we read every message. Reach out — we typically respond within 24 hours.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        {submitted ? (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-badge rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              {'\u2705'}
            </div>
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">Message Sent!</h2>
            <p className="text-gray-600">Thanks for reaching out. We'll get back to you within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 md:p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <select
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
                className="w-full border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
              >
                <option>General Enquiry</option>
                <option>Report a Listing</option>
                <option>Safety Concern</option>
                <option>Partnerships</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                className="w-full border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
            </div>
            <button type="submit" className="btn-accent w-full text-lg">
              Send Message
            </button>
          </form>
        )}

        <div className="mt-8 text-center text-gray-500 text-sm space-y-1">
          <p>{'\uD83D\uDCE7'} hello@parent2parent.co.za</p>
          <p>{'\uD83D\uDCCD'} Built in South Africa, for South African families.</p>
        </div>
      </section>
    </div>
  );
}
