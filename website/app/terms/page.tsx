import type { Metadata } from "next";
import { LegalPageBody, LegalSection } from "@/components/legal-prose";
import { PageShell, SectionHeading } from "@/components/marketing";
import { siteConfig, siteLinks } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Build Profit Solutions.",
};

export default function TermsPage() {
  return (
    <PageShell>
      <section className="px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeading eyebrow="Legal" title="Terms of Service" compact>
          Last updated: May 23, 2026
        </SectionHeading>
        <LegalPageBody>
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and
            use of {siteConfig.name}, including our website, mobile app, and web
            app (collectively, the &quot;Service&quot;). By creating an account or
            using the Service, you agree to these Terms.
          </p>

          <LegalSection title="Who the Service is for">
            <p>
              Build Profit Solutions is designed for contractors, builders,
              remodelers, subcontractors, developers, owner-builders, and related
              construction professionals who need tools for estimating, job costing,
              project tracking, and organization.
            </p>
          </LegalSection>

          <LegalSection title="Accounts and subscriptions">
            <p>
              You are responsible for maintaining the confidentiality of your account
              credentials and for activity under your account. Subscription plans,
              billing, renewals, and cancellations are handled according to the plan
              selected at checkout and the billing provider&apos;s process.
            </p>
            <p>
              You may upgrade, downgrade, or cancel according to the options
              available in the app unless otherwise stated at purchase.
            </p>
          </LegalSection>

          <LegalSection title="Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Use the Service for unlawful purposes</li>
              <li>Attempt to access accounts or data that do not belong to you</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Use automated scraping or abusive usage that exceeds normal job-site or business use</li>
              <li>Upload content you do not have the right to use</li>
            </ul>
          </LegalSection>

          <LegalSection title="Your data and project content">
            <p>
              You retain ownership of the business and project information you
              enter into the Service. You grant us the limited rights needed to
              host, process, display, and improve the Service on your behalf.
            </p>
          </LegalSection>

          <LegalSection title="No professional advice">
            <p>
              Build Profit Solutions provides software tools for estimating, job
              costing, organization, and project management. We do not provide tax,
              legal, accounting, or financial advice. Features such as the Tax
              Center are designed to help users stay organized and tax-ready, not
              to replace a CPA, attorney, or financial advisor.
            </p>
            <p>
              You are responsible for verifying estimates, contracts, tax records,
              and business decisions before relying on them.
            </p>
          </LegalSection>

          <LegalSection title="AI and automated features">
            <p>
              Some features use automation or AI to assist with estimates,
              insights, receipt processing, or project guidance. Outputs may be
              incomplete or inaccurate. You should review all AI-generated or
              automated results before using them in bids, contracts, tax records,
              or financial decisions.
            </p>
          </LegalSection>

          <LegalSection title="Availability and changes">
            <p>
              We may modify, suspend, or discontinue parts of the Service from
              time to time. We may update these Terms by posting a revised version
              on this page. Continued use of the Service after changes become
              effective constitutes acceptance of the updated Terms.
            </p>
          </LegalSection>

          <LegalSection title="Disclaimer">
            <p>
              The Service is provided on an &quot;as is&quot; and &quot;as
              available&quot; basis to the fullest extent permitted by law. We do
              not guarantee uninterrupted access, error-free operation, or that
              outputs will meet every business or regulatory requirement.
            </p>
          </LegalSection>

          <LegalSection title="Limitation of liability">
            <p>
              To the fullest extent permitted by law, Build Profit Solutions and
              its founder will not be liable for indirect, incidental, special,
              consequential, or punitive damages, or for lost profits, lost data,
              or business interruption arising from use of the Service.
            </p>
          </LegalSection>

          <LegalSection title="Contact">
            <p>
              Questions about these Terms can be sent to{" "}
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
