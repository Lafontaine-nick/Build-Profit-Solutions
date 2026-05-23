export const siteConfig = {
  name: "Build Profit Solutions",
  shortName: "BPS",
  description:
    "AI-powered estimating, job costing, and project insights built for contractors.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildprofitsolutions.com",
  webAppUrl:
    process.env.NEXT_PUBLIC_WEB_APP_URL ?? "https://app.buildprofitsolutions.com",
  iosAppUrl: process.env.NEXT_PUBLIC_IOS_APP_URL ?? "#download",
  androidAppUrl: process.env.NEXT_PUBLIC_ANDROID_APP_URL ?? "#download",
  contactEmail:
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@buildprofitsolutions.com",
  founderName: "Nicholas LaFontaine",
  founderTitle: "Founder, Build Profit Solutions",
  mission:
    "Help construction professionals estimate smarter, track every dollar, stay organized, and protect profit on every job.",
  location:
    "Built for contractors and construction businesses nationwide — wherever you estimate, build, and track jobs.",
};

function trimTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

const webAppBase = trimTrailingSlash(siteConfig.webAppUrl);

/** Set NEXT_PUBLIC_PRELAUNCH=false in Vercel when sign-up and billing are ready. */
export const siteLaunch = {
  isPrelaunch: process.env.NEXT_PUBLIC_PRELAUNCH !== "false",
};

/** Centralized outbound links for CTAs across the marketing site. */
export const siteLinks = {
  signUp: `${webAppBase}/auth?mode=signup`,
  webApp: webAppBase,
  download: "/#download",
  iosApp: siteConfig.iosAppUrl,
  androidApp: siteConfig.androidAppUrl,
  contact: `mailto:${siteConfig.contactEmail}`,
};

export const heroScreenshot = {
  src: "/screenshots/performance-snapshot.png?v=3",
  alt: "Build Profit Solutions performance snapshot showing bids, projects, and profit metrics",
};

export const navItems = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "Who It Helps", href: "/#audiences" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
];

export const audiences = [
  {
    title: "General Contractors",
    description:
      "Manage estimates, job costs, subs, and project progress from one profit-focused workspace.",
  },
  {
    title: "Remodelers",
    description:
      "Quote faster, track change orders, and keep client-facing proposals clean and professional.",
  },
  {
    title: "Subcontractors",
    description:
      "Control labor, materials, and margins without juggling spreadsheets between jobs.",
  },
  {
    title: "Developers",
    description:
      "Track project financials and decision points across builds, teams, and vendors.",
  },
  {
    title: "Owner-Builders",
    description:
      "Plan budgets, compare real costs, and understand where every dollar is going.",
  },
];

export const features = [
  {
    title: "AI Estimate Assistant",
    description:
      "Build bids from project details, labor, materials, markup, and local cost assumptions.",
  },
  {
    title: "Live Job Costing",
    description:
      "Compare budget versus actuals as work happens so margin issues show up early.",
  },
  {
    title: "Project Tracking",
    description:
      "Keep timelines, scope, budgets, invoices, and project notes connected.",
  },
  {
    title: "Lead Management",
    description:
      "Capture opportunities, score leads, and move prospects through a simple pipeline.",
  },
  {
    title: "Materials & Pricing",
    description:
      "Search materials, monitor pricing, and keep bids grounded in current costs.",
  },
  {
    title: "Proposals & Invoices",
    description:
      "Generate polished estimates, proposals, and invoices without rebuilding templates.",
  },
];

export const primaryScreenshots = [
  {
    title: "Dashboard Overview",
    eyebrow: "Command Center",
    description:
      "Live project metrics, AI insights, and profit signals at a glance.",
    image: "/screenshots/dashboard-overview.png",
    secondaryImage: "/screenshots/ai-assistant.png",
    orientation: "mobile",
  },
  {
    title: "Estimate Summary",
    eyebrow: "Bid Builder",
    description:
      "Cost breakdowns, bid totals, markup, and margin checks in one workflow.",
    image: "/screenshots/estimate-summary.png",
    secondaryImage: "/screenshots/payment-schedule.png",
    orientation: "mobile",
  },
  {
    title: "Project Profit Tracking",
    eyebrow: "Job Costing",
    description:
      "Project-level budget and profit views help contractors protect margin.",
    image: "/screenshots/project-profit.png",
    secondaryImage: "/screenshots/tax-center.png",
    orientation: "mobile",
  },
  {
    title: "Receipt OCR",
    eyebrow: "Automation",
    description:
      "Scan receipts and auto-fill vendor, amount, and confidence details.",
    image: "/screenshots/ocr-receipt.png",
    secondaryImage: "/screenshots/materials-equipment.png",
    orientation: "mobile",
  },
  {
    title: "Find Subcontractors",
    eyebrow: "Directory",
    description:
      "Search nearby contractors and verified BPS subcontractors by trade.",
    image: "/screenshots/find-subcontractors.png",
    secondaryImage: "/screenshots/team-management.png",
    orientation: "mobile",
  },
  {
    title: "Proposals & CPA Reports",
    eyebrow: "Documents",
    description:
      "Generate client-facing proposal PDFs and CPA-ready tax summaries from the same project data.",
    image: "/screenshots/proposal-pdf.png",
    secondaryImage: "/screenshots/tax-ready-report.png",
    orientation: "desktop",
  },
];

export const secondaryScreenshots = [
  {
    title: "Payment Schedules",
    description:
      "Build deposit, weekly progress payment, and holdback schedules.",
    image: "/screenshots/payment-schedule.png",
  },
  {
    title: "Tax Center",
    description:
      "Prepare CPA-ready summaries, receipt backup, and vendor review exports.",
    image: "/screenshots/tax-center.png",
  },
  {
    title: "Team Management",
    description:
      "Track active team members, roles, trades, and assignments.",
    image: "/screenshots/team-management.png",
  },
  {
    title: "Materials & Equipment",
    description:
      "Monitor transactions, invoices, receipts, and category spending.",
    image: "/screenshots/materials-equipment.png",
  },
  {
    title: "AI Project Manager",
    description:
      "Ask project-specific questions, review health, and forecast profit.",
    image: "/screenshots/ai-assistant.png",
  },
  {
    title: "Product Search",
    description:
      "Search suppliers, compare material prices, and add products to bids.",
    image: "/screenshots/product-search.png",
  },
];

export const pricingPlans = [
  {
    id: "basic",
    name: "Basic",
    price: 45,
    tag: "Starter",
    description: "Essential tools for solo contractors getting organized.",
    cta: "Start with Basic",
    features: [
      "3-5 active projects",
      "Basic project dashboard",
      "Material and labor costing",
      "AI Estimate Assistant lite usage",
      "Save and export estimates",
      "Simple customer CRM",
      "Email support",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: 89,
    tag: "Most Popular",
    recommended: true,
    description: "Built to protect margins and scale profitably.",
    cta: "Start Professional",
    features: [
      "Unlimited projects",
      "Full AI Estimator",
      "Custom branded estimate PDFs",
      "Live job costing and profitability tracking",
      "Overhead and markup automation",
      "Lead filters and management",
      "Price spike alerts",
      "Priority support",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 179,
    tag: "Teams",
    description: "For teams that need forecasting, optimization, and integrations.",
    cta: "Scale with Business",
    features: [
      "Everything in Professional",
      "5-10 team members",
      "Role-based permissions",
      "Advanced analytics and forecasting",
      "Profit simulation tools",
      "AI bid optimization",
      "Invoice generation and payment tracking",
      "Dedicated account support",
    ],
  },
];

export const faqs = [
  {
    question: "Is Build Profit Solutions available to sign up for yet?",
    answer:
      "Not yet. The product is in pre-launch while we finish the mobile apps, billing, and onboarding. This site is a preview of what is coming. Contact us if you want updates.",
  },
  {
    question: "Is Build Profit Solutions only for general contractors?",
    answer:
      "No. The product is built for general contractors, remodelers, subcontractors, developers, and owner-builders who need clearer estimates and project financials.",
  },
  {
    question: "Can I use it from a phone and a computer?",
    answer:
      "Yes. The app is being built for mobile-first job-site workflows, with a web version planned for desktop access when public launch opens.",
  },
  {
    question: "Are the prices on this site final?",
    answer:
      "Pricing shown here is a preview for planning purposes. Subscriptions are not available yet and may change before public launch.",
  },
];
