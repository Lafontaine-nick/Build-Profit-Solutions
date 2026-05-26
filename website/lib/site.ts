export const siteConfig = {
  name: "Build Profit Solutions",
  shortName: "BPS",
  description:
    "AI-powered construction estimating, project management, job costing, and profit tracking tools for contractors.",
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
    "Help contractors estimate with more confidence, track costs from bid to closeout, and protect project profit with clearer numbers.",
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
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: siteLinks.contact },
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
    title: "Estimate & Bid",
    description:
      "Create cleaner estimates, organize direct costs, apply markup, review profitability, and generate professional proposal PDFs.",
    bullets: [
      "AI estimate assistant",
      "Labor, material, equipment, and overhead tracking",
      "Markup and profit visibility",
      "Branded proposal and estimate PDFs",
    ],
  },
  {
    title: "Manage Active Jobs",
    description:
      "Turn awarded bids into active projects and keep budgets, schedules, purchase orders, change orders, and payments organized in one place.",
    bullets: [
      "Project budgets and actual costs",
      "Purchase orders and change orders",
      "Progress billing and payment schedules",
      "Project timeline and team tracking",
    ],
  },
  {
    title: "Protect Profit",
    description:
      "See where profit is being protected or lost before the job is over. Track current margin, projected margin, budget usage, and job health.",
    bullets: [
      "Live job costing",
      "Budget vs. actual tracking",
      "Profitability forecasting",
      "AI project manager insights",
    ],
  },
  {
    title: "Closeout & Tax Prep",
    description:
      "Keep receipts, vendors, project costs, and CPA-ready summaries organized so closeout and tax preparation are less painful.",
    bullets: [
      "Tax center",
      "Receipt and vendor organization",
      "CPA summary exports",
      "Project financial history",
    ],
  },
];

export const aiFeatures = [
  {
    title: "AI Estimate Assistant",
    description:
      "Helps organize estimate inputs, review missing costs, and explain how labor, materials, overhead, markup, and profit affect the final bid.",
  },
  {
    title: "AI Project Manager",
    description:
      "Watches active project data and helps surface budget risk, margin pressure, missing costs, payment issues, and project health insights.",
  },
  {
    title: "Profit Forecasting",
    description:
      "Helps compare actual costs, committed costs, progress, and projected final cost so contractors can make better decisions before profit disappears.",
  },
  {
    title: "Smart Project Guidance",
    description:
      "Gives project-specific guidance based on the current job, not generic advice.",
  },
];

export const trustCards = [
  {
    title: "Missed Costs",
    description:
      "Track materials, labor, equipment, permits, overhead, and other project costs before they disappear from the budget.",
  },
  {
    title: "Change Orders",
    description:
      "Keep added work connected to the active project so extra costs and revenue do not get lost.",
  },
  {
    title: "Payment Tracking",
    description:
      "Organize deposits, progress payments, milestone payments, weekly billing, and holdbacks.",
  },
  {
    title: "Profit Visibility",
    description:
      "Compare bid numbers, actual costs, committed costs, and projected job performance.",
  },
  {
    title: "Closeout Records",
    description:
      "Keep receipts, vendors, and project financial records easier to review when the job is done.",
  },
  {
    title: "AI Guidance",
    description:
      "Use AI to help flag risks, explain numbers, and guide better project decisions.",
  },
];

export const taxDisclaimer =
  "Build Profit Solutions helps organize project costs, receipts, vendors, and CPA-ready summaries. It does not replace a licensed CPA, tax professional, attorney, or financial advisor.";

export const primaryScreenshots = [
  {
    title: "Dashboard Overview",
    eyebrow: "Command Center",
    description:
      "Live project metrics, AI insights, and profit signals at a glance.",
    image: "/screenshots/dashboard-overview.png",
    secondaryImage: "/screenshots/dashboard-calendar.png",
    orientation: "mobile",
  },
  {
    title: "Bid Pricing Tools",
    eyebrow: "Bid Builder",
    description:
      "Review bid totals, profit margin, markup, and scenario changes before submitting.",
    image: "/screenshots/bid-pricing-summary.png",
    secondaryImage: "/screenshots/scenario-tuning.png",
    orientation: "mobile",
  },
  {
    title: "Project Profit Tracking",
    eyebrow: "Job Costing",
    description:
      "Project-level budget and profit views help contractors protect margin.",
    image: "/screenshots/project-profit.png",
    secondaryImage: "/screenshots/project-budget.png",
    orientation: "mobile",
  },
  {
    title: "Product Scanner",
    eyebrow: "Materials",
    description:
      "Scan barcodes, find supplier products, and add priced materials directly to an estimate.",
    image: "/screenshots/product-scanner.png",
    secondaryImage: "/screenshots/product-found-modal.png",
    orientation: "mobile",
  },
  {
    title: "Contract PDF & CPA Summary",
    eyebrow: "Documents",
    description:
      "Generate polished contract exports and CPA-ready financial summaries from the same project data.",
    image: "/screenshots/generate-contract-pdf.png?v=5",
    secondaryImage: "/screenshots/cpa-summary-pdf.png?v=5",
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
    image: "/screenshots/ai-assistant-command-center.png",
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
    bestFor: "Best for solo contractors getting organized.",
    cta: "Request Early Access",
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
    bestFor:
      "Best for contractors who want estimating, job costing, AI tools, and profit tracking.",
    cta: "Request Early Access",
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
    bestFor:
      "Best for teams that need permissions, forecasting, analytics, and advanced workflows.",
    cta: "Contact for Team Access",
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
      "Build Profit Solutions is currently in pre-launch testing. Contractors can request early access or join launch updates while iOS, Android, and web access are finalized.",
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
      "Pricing is shown for launch planning and may be finalized before subscriptions open. Contractors can request early access before public release.",
  },
];
