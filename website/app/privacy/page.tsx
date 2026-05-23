import type { Metadata } from "next";
import { LegalPageBody, LegalSection } from "@/components/legal-prose";
import { PageShell, SectionHeading } from "@/components/marketing";
import { siteConfig, siteLinks } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Build Profit Solutions.",
};

export default function PrivacyPage() {
  return (
    <PageShell>
      <section className="px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeading eyebrow="Legal" title="Privacy Policy" compact>
          Last updated: May 23, 2026
        </SectionHeading>
        <LegalPageBody>
          <p>
            {siteConfig.name} (&quot;BPS,&quot; &quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;) respects your privacy. This Privacy Policy explains
            how we collect, use, and protect information when you visit our website
            or use our mobile and web applications.
          </p>

          <LegalSection title="Information we collect">
            <p>We may collect the following types of information:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Account information such as name, email address, and login details</li>
              <li>Business and project information you enter, including estimates, budgets, expenses, receipts, and client/project records</li>
              <li>Payment and subscription information processed through our payment provider</li>
              <li>Usage data such as app interactions, device type, and general analytics</li>
              <li>Support communications when you contact us</li>
            </ul>
          </LegalSection>

          <LegalSection title="How we use information">
            <p>We use information to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Provide, maintain, and improve the Build Profit Solutions platform</li>
              <li>Process subscriptions and account access</li>
              <li>Support estimating, job costing, project tracking, and related features</li>
              <li>Respond to support requests and product communications</li>
              <li>Monitor security, prevent abuse, and improve reliability</li>
            </ul>
          </LegalSection>

          <LegalSection title="AI, OCR, and product lookup features">
            <p>
              Some features may process project details, receipt images, product
              searches, or barcode lookups to help you organize job costs and
              project data. You should avoid uploading sensitive information you
              do not want stored or processed as part of your account workflow.
            </p>
          </LegalSection>

          <LegalSection title="Tax Center and financial records">
            <p>
              Build Profit Solutions includes organization tools such as the Tax
              Center to help users stay organized and tax-ready. We do not provide
              tax, legal, or financial advice, and we do not file taxes on your
              behalf.
            </p>
          </LegalSection>

          <LegalSection title="How we share information">
            <p>
              We do not sell your personal information. We may share information
              with service providers that help us operate the platform, such as
              authentication, hosting, analytics, and payment processing providers.
              These providers are permitted to use information only as needed to
              perform services for us.
            </p>
            <p>
              We may also disclose information if required by law, to protect rights
              and safety, or in connection with a business transaction such as a
              merger or acquisition.
            </p>
          </LegalSection>

          <LegalSection title="Data retention and security">
            <p>
              We retain account and project information while your account is active
              and as needed to provide the service, comply with legal obligations,
              resolve disputes, and enforce agreements. We use reasonable technical
              and organizational measures to protect information, but no system is
              completely secure.
            </p>
          </LegalSection>

          <LegalSection title="Your choices">
            <p>
              You may update account information within the app where available.
              You may contact us to request access, correction, or deletion of
              certain account information, subject to legal and operational
              requirements.
            </p>
          </LegalSection>

          <LegalSection title="Children">
            <p>
              Build Profit Solutions is intended for business and professional use
              and is not directed to children under 13.
            </p>
          </LegalSection>

          <LegalSection title="Contact us">
            <p>
              Questions about this Privacy Policy can be sent to{" "}
              <a href={siteLinks.contact} className="text-emerald-300 hover:text-emerald-200">
                {siteConfig.contactEmail}
              </a>
              .
            </p>
          </LegalSection>
        </LegalPageBody>
      </section>
    </PageShell>
  );
}
