import { useMemo } from "react";

export default function Contact() {
  const calendlyUrl = useMemo(() => import.meta.env?.VITE_CALENDLY_URL || "", []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Contact</h1>
        <p className="page-sub">Questions, onboarding, or automation setup — schedule a call.</p>
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card-qe border border-outline-variant/10 lg:col-span-1">
          <h2 className="font-headline text-sm font-semibold text-on-surface">Get in touch</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            For support, partnerships, or setting up Chartink/TradingView automation.
          </p>

          <div className="mt-5 space-y-3 text-sm">
            <div className="rounded-lg border border-outline-variant/15 bg-surface-container-high/50 p-4">
              <p className="text-xs font-semibold text-on-surface">Email</p>
              <a className="mt-1 block font-medium text-primary hover:underline" href="mailto:support@protrades.in">
                support@protrades.in
              </a>
            </div>

            <div className="rounded-lg border border-outline-variant/15 bg-surface-container-high/50 p-4">
              <p className="text-xs font-semibold text-on-surface">WhatsApp</p>
              <a
                className="mt-1 block font-medium text-primary hover:underline"
                href="https://wa.me/919999999999"
                target="_blank"
                rel="noreferrer"
              >
                +91 99999 99999
              </a>
              <p className="mt-2 text-xs text-on-surface-variant">Replace with your real number.</p>
            </div>
          </div>
        </div>

        <div className="card-qe border border-outline-variant/10 lg:col-span-2">
          <h2 className="font-headline text-sm font-semibold text-on-surface">Schedule a meeting</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Book a slot for onboarding, strategy automation, webhook testing, or trade workflow setup.
          </p>

          {calendlyUrl ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-outline-variant/15 bg-surface-container-high/30">
              <iframe
                title="Schedule meeting"
                src={calendlyUrl}
                className="h-[70vh] w-full"
                frameBorder="0"
              />
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-outline-variant/15 bg-surface-container-high/30 p-6 text-sm text-on-surface-variant">
              Add <code className="text-primary">VITE_CALENDLY_URL</code> in your frontend environment to embed a scheduler.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

