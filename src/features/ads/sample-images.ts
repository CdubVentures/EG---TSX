import {
  SAMPLE_AD_MODE,
  SAMPLE_AD_NETWORK,
  sampleAdModeSchema,
  sampleAdNetworkSchema,
  type SampleAdMode,
  type SampleAdNetwork,
} from './config';
import { readSampleSvg, resolveSampleVideoSource } from './sample-assets';

/**
 * Sample ad lookup — maps display sizes to realistic SVG/video creative decks.
 * Used when loadSampleAds is true (dev/layout verification mode).
 */

const svg970x250_0 = '970x250-0.svg';
const svg970x250_1 = '970x250-1.svg';
const svg970x250_2 = '970x250-2.svg';
const svg970x250_3 = '970x250-3.svg';
const svg970x250_4 = '970x250-4.svg';
const svg970x250_5 = '970x250-5.svg';
const svg970x250_6 = '970x250-6.svg';
const svg970x250_7 = '970x250-7.svg';

const svg336x280_0 = '336x280-0.svg';
const svg336x280_1 = '336x280-1.svg';
const svg336x280_2 = '336x280-2.svg';
const svg336x280_3 = '336x280-3.svg';
const svg336x280_4 = '336x280-4.svg';
const svg336x280_5 = '336x280-5.svg';
const svg336x280_6 = '336x280-6.svg';

const svg300x600_0 = '300x600-0.svg';
const svg300x600_1 = '300x600-1.svg';
const svg300x600_2 = '300x600-2.svg';
const svg300x600_3 = '300x600-3.svg';

const svg300x450_0 = '300x450-0.svg';
const svg300x450_1 = '300x450-1.svg';
const svg300x450_2 = '300x450-2.svg';
const svg300x450_3 = '300x450-3.svg';

const svg300x400_0 = '300x400-0.svg';
const svg300x400_1 = '300x400-1.svg';
const svg300x400_2 = '300x400-2.svg';
const svg300x400_3 = '300x400-3.svg';

const svg300x300_0 = '300x300-0.svg';
const svg300x300_1 = '300x300-1.svg';
const svg300x300_2 = '300x300-2.svg';
const svg300x300_3 = '300x300-3.svg';

const svg728x90_0 = '728x90-0.svg';
const svg728x90_1 = '728x90-1.svg';
const svg728x90_2 = '728x90-2.svg';
const svg728x90_3 = '728x90-3.svg';
const svg728x90_4 = '728x90-4.svg';
const svg728x90_5 = '728x90-5.svg';
const svg728x90_6 = '728x90-6.svg';

const svg300x250_0 = '300x250-0.svg';
const svg300x250_1 = '300x250-1.svg';
const svg300x250_2 = '300x250-2.svg';
const svg300x250_3 = '300x250-3.svg';
const svg300x250_4 = '300x250-4.svg';
const svg300x250_5 = '300x250-5.svg';
const svg300x250_6 = '300x250-6.svg';

const sampleAdVideoBeautyInfluencer = 'sample-ad-video-beauty-influencer.mp4';
const sampleAdVideoFashionModel = 'sample-ad-video-fashion-model.mp4';
const sampleAdVideoFashionRetail = 'sample-ad-video-fashion-retail.mp4';
const sampleAdVideoGroceryShelf = 'sample-ad-video-grocery-shelf.mp4';
const sampleAdVideoLaptopWorkspace = 'sample-ad-video-laptop-workspace.mp4';
const sampleAdVideoLuxuryCar = 'sample-ad-video-luxury-car.mp4';
const sampleAdVideoSkincareCream = 'sample-ad-video-skincare-cream.mp4';
const sampleAdVideoSkincareDemo = 'sample-ad-video-skincare-demo.mp4';
const sampleAdVideoSmartphoneSkincare = 'sample-ad-video-smartphone-skincare.mp4';
const sampleAdVideoSportsCarRoad = 'sample-ad-video-sports-car-road.mp4';

type SampleAdCreativeKind = 'svg' | 'video';
type ConcreteSampleAdNetwork = Exclude<SampleAdNetwork, 'mixed'>;

interface SampleCampaign {
  campaign: string;
  brand: string;
  headline: string;
  cta: string;
  audience: string;
  offer: string;
  disclaimer: string;
  duration?: string;
}

interface SampleVideoCreative extends SampleCampaign {
  source: string;
}

interface SampleAdProfile {
  id: ConcreteSampleAdNetwork;
  headlinePool: string[];
  brandPool: string[];
  ctaPool: string[];
  campaignPool: string[];
  audiencePool: string[];
  offerPool: string[];
  disclaimerPool: string[];
  fillRate: number;
  videoWeight: number;
}

const sampleAdProfiles: Record<ConcreteSampleAdNetwork, SampleAdProfile> = {
  adsense: {
    id: 'adsense',
    headlinePool: [
      'Compare in seconds',
      'Build your next setup',
      'Weekend essentials are live',
      'Reviews that convert',
      'Tools with higher trust score',
      'Skip the noise, shop intent-driven',
    ],
    brandPool: [
      'Harbor Kitchen',
      'Atlas Commerce',
      'Summit Studio',
      'Pulse Audio',
      'Orbit Pet',
      'Northline Tech',
    ],
    ctaPool: [
      'Learn more',
      'Shop now',
      'View prices',
      'Open offer',
      'Start trial',
      'Compare options',
    ],
    campaignPool: [
      'Search retarget',
      'Merchandise recapture',
      'Top-of-funnel traffic',
      'Reader intent feed',
      'Back-end upsell',
      'Review stack experiment',
    ],
    audiencePool: [
      'Returning readers',
      'Price shoppers',
      'Travel and lifestyle',
      'New visitors',
      'Product comparers',
      'High-intent search traffic',
    ],
    offerPool: [
      'Free shipping on qualifying carts',
      'New customer first-purchase discount',
      'Limited-time savings for this week',
      'Bundle bonus included',
      'Priority shipping upgrade',
      'Member checkout support',
    ],
    disclaimerPool: [
      'Offers vary by market.',
      'Subject to supplier availability.',
      'Some terms and exclusions apply.',
      'Based on regional availability.',
      'Valid for new users only.',
      'No additional subscription required.',
    ],
    fillRate: 0.92,
    videoWeight: 0.35,
  },
  raptive: {
    id: 'raptive',
    headlinePool: [
      'Premium yield for premium pages',
      'Protecting premium inventory',
      'Publisher-first revenue lifts',
      'Higher floor + smarter mix',
      'Editorial-safe placements',
      'High quality long-session growth',
    ],
    brandPool: [
      'Raptive Studio',
      'Signal Network',
      'Audience Engine',
      'Vantage Layer',
      'Northline Signal',
      'Editorial Growth Lab',
    ],
    ctaPool: ['Request rates', 'View placement plan', 'Optimize now', 'Start managed review'],
    campaignPool: [
      'Managed premium stack',
      'Long-form page placements',
      'Enterprise quality floor test',
      'RPM-first allocation',
      'High-intent vertical split',
      'Partner-ready experimentation',
    ],
    audiencePool: [
      'Established publishers',
      'Creator-driven lifestyle readers',
      'High-time-on-page cohorts',
      'Returning members',
      'Long-tail traffic',
      'Audience expansion cohorts',
    ],
    offerPool: [
      'Premium onboarding support',
      'Quarterly yield audit',
      'Priority floor adjustment',
      'Inventory quality review',
      'Direct relationship support',
      'Zero-config optimization kickoff',
    ],
    disclaimerPool: [
      'Campaign availability varies by page quality.',
      'Rates may vary by geography.',
      'Minimum quality threshold applies.',
      'Subject to weekly optimization cycle.',
      'Not financial advice.',
      'Inventory mix varies by week.',
    ],
    fillRate: 0.98,
    videoWeight: 0.55,
  },
  mediavine: {
    id: 'mediavine',
    headlinePool: [
      'Creator-first moments',
      'Beauty and wellness stories',
      'Lifestyle brand storytelling',
      'Trust signals that convert',
      'Journey format native fit',
      'Community-first placements',
    ],
    brandPool: [
      'Bright Pantry',
      'Home + Body',
      'Wander Trail',
      'Glow Studio',
      'Taste Circle',
      'City Kitchen',
    ],
    ctaPool: ['See how it works', 'Browse placements', 'Read case study', 'Start trial'],
    campaignPool: [
      'Lifestyle creator campaign',
      'Journey format pilot',
      'Food and wellness stack',
      'Community trust test',
      'Editorial context experiment',
      'Short-form social uplift',
    ],
    audiencePool: [
      'Lifestyle and food readers',
      'Beauty and wellness audiences',
      'Travel planners',
      'Family and parent cohorts',
      'Creator communities',
      'Brand-loyal repeat readers',
    ],
    offerPool: [
      'Creator-fit brand partnerships',
      'Community placement package',
      'Seasonal campaign support',
      'Contextual pacing dashboard',
      'Higher trust-score creatives',
      'Priority campaign support',
    ],
    disclaimerPool: [
      'Availability depends on audience mix.',
      'Brand partnerships reviewed by editorial policy.',
      'Rates shared with managed teams.',
      'Results vary by content quality.',
      'Creative standards apply.',
      'Placement mix changes during optimization.',
    ],
    fillRate: 0.95,
    videoWeight: 0.42,
  },
  ezoic: {
    id: 'ezoic',
    headlinePool: [
      'AI placement testing',
      'Auto-optimized layout tests',
      'Revenue-first experiment lab',
      'Dynamic pricing simulation',
      'Variant scoring made simple',
      'Traffic to layout match',
    ],
    brandPool: ['Ezoic Core', 'Signal Grid', 'Layout Engine', 'AI Yield Lab', 'Adaptive CPM'],
    ctaPool: ['Run experiment', 'Compare settings', 'Open dashboard', 'Start test'],
    campaignPool: [
      'High-frequency placement test',
      'Dynamic pricing',
      'Layout variant',
      'AI CTR optimizer',
      'Growth pacing test',
      'New domain qualification',
    ],
    audiencePool: [
      'Growing traffic sites',
      'Mixed-content publishers',
      'New monetization cohorts',
      'Mid-size lifestyle audiences',
      'Technology readers',
      'Performance-focused owners',
    ],
    offerPool: [
      'Auto-optimized layout guidance',
      'No-code control room',
      'Quarterly review template',
      'Instant experiment insights',
      'CPM-focused test stack',
      'Traffic-tier starter program',
    ],
    disclaimerPool: [
      'Results depend on bid competition.',
      'Optimization is automatic and iterative.',
      'Some pages may test slower.',
      'Traffic split may affect short-term output.',
      'Inventory and bids are dynamic.',
      'Performance varies by week.',
    ],
    fillRate: 0.88,
    videoWeight: 0.48,
  },
};

const sampleCampaignDecks: Record<ConcreteSampleAdNetwork, SampleCampaign[]> = {
  adsense: [
    {
      campaign: 'Performance campaign',
      brand: 'Luma Studio',
      headline: 'Buy the travel kit top picks, reviewed',
      cta: 'Shop now',
      audience: 'High intent search traffic',
      offer: 'Weekend starter pack on sale this month',
      disclaimer: 'Offer ends when inventory sells out.',
    },
    {
      campaign: 'Search campaign',
      brand: 'Maple Tools',
      headline: 'Upgrade your setup with trusted essentials',
      cta: 'Explore options',
      audience: 'Returning users',
      offer: 'Bundle discount on complete setups',
      disclaimer: 'Bundle pricing excludes tax and freight.',
    },
    {
      campaign: 'Retarget audience',
      brand: 'Harbor Kitchen',
      headline: 'Weekend essentials that convert faster',
      cta: 'Open offer',
      audience: 'Product page visitors',
      offer: '15% off with code WEEKEND15',
      disclaimer: 'Offer valid through Sunday 11:59pm local time.',
    },
    {
      campaign: 'Brand funnel',
      brand: 'Summit Studio',
      headline: 'Tough gear for short weekend trips',
      cta: 'Check stock',
      audience: 'Weekend adventure readers',
      offer: 'Flash 48-hour bundle',
      disclaimer: 'Valid for select SKUs only.',
    },
    {
      campaign: 'Home upgrade',
      brand: 'Northline Tech',
      headline: 'Refresh your workspace in under 10 minutes',
      cta: 'Get started',
      audience: 'Remote professionals',
      offer: 'Free monitor cable included',
      disclaimer: 'One-time promotional item per order.',
    },
    {
      campaign: 'Creator essentials',
      brand: 'Atlas Commerce',
      headline: 'Tools creators buy after each review',
      cta: 'Find my setup',
      audience: 'Creator followers',
      offer: 'Starter credit for new account',
      disclaimer: 'Credit availability varies by region.',
    },
  ],
  raptive: [
    {
      campaign: 'Premium yield stream',
      brand: 'Northline Ventures',
      headline: 'Premium ad slots with managed optimization',
      cta: 'See rates',
      audience: 'Established publishers',
      offer: 'Dedicated account review first week',
      disclaimer: 'Pricing shared based on qualification.',
    },
    {
      campaign: 'Creator monetization',
      brand: 'Signal Network',
      headline: 'Higher CPM windows with editorial context',
      cta: 'Request access',
      audience: 'Lifestyle and culture publishers',
      offer: 'Priority account support included',
      disclaimer: 'Campaigns require traffic and page-speed checks.',
    },
    {
      campaign: 'Programmatic growth',
      brand: 'Audience Engine',
      headline: 'Higher fill and consistent page coverage',
      cta: 'Book a review',
      audience: 'High-traffic blogs',
      offer: 'Guaranteed fill pacing for launch',
      disclaimer: 'Pacing and caps vary by traffic mix.',
    },
    {
      campaign: 'Quality-first launch',
      brand: 'Editorial Growth Lab',
      headline: 'Higher RPM from page-quality cohorts',
      cta: 'Schedule a call',
      audience: 'Editorial-first publishers',
      offer: 'Onboarding workshop included',
      disclaimer: 'Workshop availability by region.',
    },
    {
      campaign: 'Yield reserve',
      brand: 'Vantage Layer',
      headline: 'Protect premium inventory with managed floors',
      cta: 'Optimize now',
      audience: 'Premium audience pages',
      offer: 'Reserve-based margin review',
      disclaimer: 'Review frequency is weekly.',
    },
    {
      campaign: 'Long-form expansion',
      brand: 'Northline Signal',
      headline: 'Monetize long reads without clutter',
      cta: 'Get a placement map',
      audience: 'Long-form readers',
      offer: 'Placement stress test included',
      disclaimer: 'A/B tests require minimum sample size.',
    },
  ],
  mediavine: [
    {
      campaign: 'Creator-first launch',
      brand: 'Home + Body',
      headline: 'Products your audience already follows',
      cta: 'Browse catalog',
      audience: 'Beauty, travel, and food readers',
      offer: 'Community placement package',
      disclaimer: 'Campaign length depends on editorial cycle.',
    },
    {
      campaign: 'Journey format',
      brand: 'Bright Pantry',
      headline: 'Build content adjacency without noise',
      cta: 'View journey',
      audience: 'Creator communities',
      offer: 'Priority journey review',
      disclaimer: 'Creative policy reviewed before launch.',
    },
    {
      campaign: 'Lifestyle premium',
      brand: 'Wander Trail',
      headline: 'Travel moments with higher CTR performance',
      cta: 'Discover brands',
      audience: 'Mid-funnel shoppers',
      offer: 'Campaign boost for weekend traffic',
      disclaimer: 'CTR uplift varies by placement type.',
    },
    {
      campaign: 'Food first campaign',
      brand: 'Taste Circle',
      headline: 'Trusted daily-use products from community lists',
      cta: 'See recipes',
      audience: 'Food and home readers',
      offer: 'Editorial-safe ad sequencing',
      disclaimer: 'Sequencing can change after optimization.',
    },
    {
      campaign: 'Creator brand moments',
      brand: 'Glow Studio',
      headline: 'Authentic brand stories around your content',
      cta: 'Watch placements',
      audience: 'Lifestyle followers',
      offer: 'Creator partner badge enabled',
      disclaimer: 'Audience feedback may alter cadence.',
    },
    {
      campaign: 'Community engagement',
      brand: 'City Kitchen',
      headline: 'Monetize without harming trust score',
      cta: 'Start journey',
      audience: 'Family and wellness audiences',
      offer: 'Trust-safe sponsor format',
      disclaimer: 'Trust score changes are reviewed monthly.',
    },
  ],
  ezoic: [
    {
      campaign: 'AI placement test',
      brand: 'Growth Loop',
      headline: 'Auto-testing that adapts every 30 seconds',
      cta: 'Run trial layout',
      audience: 'Growing sites',
      offer: 'Free 30-day optimization cycle',
      disclaimer: 'Cycle settings are adaptive and ongoing.',
    },
    {
      campaign: 'Dynamic pricing',
      brand: 'Flux Commerce',
      headline: 'Inventory-aware campaign pacing',
      cta: 'Try layout control',
      audience: 'Content + commerce stacks',
      offer: 'Dynamic pacing with floor controls',
      disclaimer: 'Pacing adjusts with market demand.',
    },
    {
      campaign: 'RPM optimization',
      brand: 'Signal Grid',
      headline: 'More opportunities from every page view',
      cta: 'Optimize now',
      audience: 'Tech and gaming properties',
      offer: 'Priority layout diagnostics',
      disclaimer: 'Optimization requires stable pageview volume.',
    },
    {
      campaign: 'Layout adaptation',
      brand: 'AI Yield Lab',
      headline: 'Machine-optimized layouts by intent signal',
      cta: 'Open dashboard',
      audience: 'Mid-funnel and bottom-funnel mix',
      offer: 'Adaptive controls unlocked',
      disclaimer: 'Signal quality shifts by segment.',
    },
    {
      campaign: 'Variant pressure test',
      brand: 'Adaptive CPM',
      headline: 'Find best-performing variants faster',
      cta: 'Run experiment',
      audience: 'New content channels',
      offer: 'Multi-variant test bundle',
      disclaimer: 'Variance settles after enough volume.',
    },
    {
      campaign: 'Growth qualification',
      brand: 'Ezoic Core',
      headline: 'From baseline to paid-ready page performance',
      cta: 'Get qualification',
      audience: 'New monetization cohorts',
      offer: 'Starter account optimization playbook',
      disclaimer: 'Qualification duration depends on traffic.',
    },
  ],
};

const sampleAdVariants: Record<string, string[]> = {
  '970x250': [
    svg970x250_0,
    svg970x250_1,
    svg970x250_2,
    svg970x250_3,
    svg970x250_4,
    svg970x250_5,
    svg970x250_6,
    svg970x250_7,
  ],
  '728x90': [
    svg728x90_0,
    svg728x90_1,
    svg728x90_2,
    svg728x90_3,
    svg728x90_4,
    svg728x90_5,
    svg728x90_6,
  ],
  '336x280': [
    svg336x280_0,
    svg336x280_1,
    svg336x280_2,
    svg336x280_3,
    svg336x280_4,
    svg336x280_5,
    svg336x280_6,
  ],
  '300x600': [svg300x600_0, svg300x600_1, svg300x600_2, svg300x600_3],
  '300x450': [svg300x450_0, svg300x450_1, svg300x450_2, svg300x450_3],
  '300x400': [svg300x400_0, svg300x400_1, svg300x400_2, svg300x400_3],
  '300x300': [svg300x300_0, svg300x300_1, svg300x300_2, svg300x300_3],
  '300x250': [
    svg300x250_0,
    svg300x250_1,
    svg300x250_2,
    svg300x250_3,
    svg300x250_4,
    svg300x250_5,
    svg300x250_6,
  ],
};

const sampleAdVideos: Record<string, SampleVideoCreative[]> = {
  '970x250': [
    {
      source: sampleAdVideoLuxuryCar,
      campaign: 'Launch film',
      brand: 'Apex Drive',
      headline: 'Meet the GT line in motion before local release',
      cta: 'Watch the spot',
      audience: 'Luxury and performance shoppers',
      offer: 'Reserve a private test drive this week',
      disclaimer: 'Availability varies by market and dealer inventory.',
      duration: '00:13',
    },
    {
      source: sampleAdVideoLaptopWorkspace,
      campaign: 'Workspace rollout',
      brand: 'SignalOS',
      headline: 'Plan, publish, and ship from one clean workspace',
      cta: 'Start free',
      audience: 'Remote professionals and creator teams',
      offer: 'Team setup templates included for new accounts',
      disclaimer: 'Template access varies by plan tier.',
      duration: '00:13',
    },
    {
      source: sampleAdVideoFashionModel,
      campaign: 'Season launch',
      brand: 'Maison Slate',
      headline: 'The new evening collection is live for early access',
      cta: 'Shop the drop',
      audience: 'Fashion and lifestyle readers',
      offer: 'Priority shipping on launch-day orders',
      disclaimer: 'Selected styles may sell out quickly.',
      duration: '00:17',
    },
    {
      source: sampleAdVideoGroceryShelf,
      campaign: 'Weekly staples',
      brand: 'Fresh Pantry',
      headline: 'Fill the cart with household basics in one order',
      cta: 'Shop essentials',
      audience: 'Family and home readers',
      offer: 'Free same-day delivery on first grocery basket',
      disclaimer: 'Delivery windows depend on ZIP code coverage.',
      duration: '00:10',
    },
  ],
  '728x90': [
    {
      source: sampleAdVideoSmartphoneSkincare,
      campaign: 'Creator routine',
      brand: 'LumaSkin',
      headline: 'See the routine beauty creators keep rebuying',
      cta: 'Watch now',
      audience: 'Beauty and wellness readers',
      offer: 'Starter duo ships free today',
      disclaimer: 'Free shipping applies to qualifying first orders.',
      duration: '00:12',
    },
    {
      source: sampleAdVideoSportsCarRoad,
      campaign: 'Performance preview',
      brand: 'Apex Drive',
      headline: 'Book a weekend test drive for the new RS coupe',
      cta: 'Reserve now',
      audience: 'Auto and tech enthusiasts',
      offer: 'Priority dealer access this month',
      disclaimer: 'Reservation requests are subject to dealer approval.',
      duration: '00:07',
    },
    {
      source: sampleAdVideoBeautyInfluencer,
      campaign: 'Social launch',
      brand: 'Glow Ritual',
      headline: 'Watch the 2-step morning reset in under ten seconds',
      cta: 'See routine',
      audience: 'Short-form social audiences',
      offer: 'Intro bundle available while inventory lasts',
      disclaimer: 'Bundle contents may vary by region.',
      duration: '00:07',
    },
    {
      source: sampleAdVideoLaptopWorkspace,
      campaign: 'Desk upgrade',
      brand: 'Northline Desk',
      headline: 'A cleaner remote setup starts with one dashboard',
      cta: 'See demo',
      audience: 'Remote workers and startup teams',
      offer: 'Free workspace starter kit for annual plans',
      disclaimer: 'Starter kit is limited to eligible new teams.',
      duration: '00:13',
    },
  ],
  '336x280': [
    {
      source: sampleAdVideoFashionRetail,
      campaign: 'Retail drop',
      brand: 'Atelier Lane',
      headline: 'New in-store looks now available online',
      cta: 'Shop collection',
      audience: 'Style-focused shoppers',
      offer: 'Members get early-access pricing today',
      disclaimer: 'Selected styles are excluded from promotion.',
      duration: '00:16',
    },
    {
      source: sampleAdVideoSkincareDemo,
      campaign: 'How-to spot',
      brand: 'Derma Daily',
      headline: 'See exactly how to apply the new moisture serum',
      cta: 'Watch tutorial',
      audience: 'Beauty tutorial viewers',
      offer: 'Save 15% on the featured set',
      disclaimer: 'Discount expires at midnight local time.',
      duration: '00:09',
    },
    {
      source: sampleAdVideoGroceryShelf,
      campaign: 'Household restock',
      brand: 'Fresh Pantry',
      headline: 'Your weekly staples are one tap away',
      cta: 'Build cart',
      audience: 'Home and food readers',
      offer: 'Free bag fee on the first delivery',
      disclaimer: 'Service availability depends on local coverage.',
      duration: '00:10',
    },
    {
      source: sampleAdVideoFashionModel,
      campaign: 'Studio campaign',
      brand: 'Maison Slate',
      headline: 'Tailored looks built for evening and event season',
      cta: 'Explore looks',
      audience: 'Premium fashion readers',
      offer: 'Complimentary shipping on featured pieces',
      disclaimer: 'Offer applies to featured styles only.',
      duration: '00:17',
    },
  ],
  '300x600': [
    {
      source: sampleAdVideoLuxuryCar,
      campaign: 'Premium launch',
      brand: 'Apex Drive',
      headline: 'A full-frame look at the new performance flagship',
      cta: 'Watch reveal',
      audience: 'Premium auto shoppers',
      offer: 'Request a local test-drive invitation',
      disclaimer: 'Invitations are limited by participating dealers.',
      duration: '00:13',
    },
    {
      source: sampleAdVideoSmartphoneSkincare,
      campaign: 'Influencer ad',
      brand: 'LumaSkin',
      headline: 'Follow the creator routine behind the new launch',
      cta: 'Shop set',
      audience: 'Beauty and skincare audiences',
      offer: 'Routine bundle ships free this week',
      disclaimer: 'Shipping offer ends while stock lasts.',
      duration: '00:12',
    },
    {
      source: sampleAdVideoLaptopWorkspace,
      campaign: 'SaaS launch',
      brand: 'SignalOS',
      headline: 'Run your entire publishing workflow from one tab',
      cta: 'Try platform',
      audience: 'Operators, founders, and creators',
      offer: 'Migration support for new teams',
      disclaimer: 'Migration support is subject to onboarding capacity.',
      duration: '00:13',
    },
    {
      source: sampleAdVideoSkincareCream,
      campaign: 'Product close-up',
      brand: 'Derma Daily',
      headline: 'The hydration cream readers keep adding to cart',
      cta: 'Buy now',
      audience: 'Beauty shoppers',
      offer: 'Free mini cleanser with first order',
      disclaimer: 'Gift item is available while supplies last.',
      duration: '00:18',
    },
  ],
  '300x450': [
    {
      source: sampleAdVideoSportsCarRoad,
      campaign: 'Road film',
      brand: 'Vertex Auto',
      headline: 'See how the new coupe handles every corner',
      cta: 'Play video',
      audience: 'Performance car shoppers',
      offer: 'Dealer preview access for registered viewers',
      disclaimer: 'Dealer events vary by region.',
      duration: '00:07',
    },
    {
      source: sampleAdVideoBeautyInfluencer,
      campaign: 'Creator partnership',
      brand: 'Glow Ritual',
      headline: 'A quick creator demo for the new glow serum',
      cta: 'Watch now',
      audience: 'Beauty-conscious audiences',
      offer: 'Limited launch pricing live today',
      disclaimer: 'Pricing may change after the launch window.',
      duration: '00:07',
    },
    {
      source: sampleAdVideoFashionRetail,
      campaign: 'Retail campaign',
      brand: 'Atelier Lane',
      headline: 'Shop the new capsule collection before it sells out',
      cta: 'Browse styles',
      audience: 'Retail-intent readers',
      offer: 'Extra 10% off first order',
      disclaimer: 'Discount excludes final-sale products.',
      duration: '00:16',
    },
    {
      source: sampleAdVideoSkincareDemo,
      campaign: 'Tutorial spot',
      brand: 'LumaSkin',
      headline: 'See the moisturizer application step by step',
      cta: 'Watch tutorial',
      audience: 'Skincare-first readers',
      offer: 'Two-piece starter set now discounted',
      disclaimer: 'Offer valid for first-time customers only.',
      duration: '00:09',
    },
  ],
  '300x400': [
    {
      source: sampleAdVideoFashionModel,
      campaign: 'Editorial fashion',
      brand: 'Maison Slate',
      headline: 'A studio-led campaign for the latest formalwear drop',
      cta: 'View collection',
      audience: 'Style and luxury readers',
      offer: 'Priority checkout unlocked today',
      disclaimer: 'Priority access is limited to eligible shoppers.',
      duration: '00:17',
    },
    {
      source: sampleAdVideoLaptopWorkspace,
      campaign: 'Ops software',
      brand: 'Northline Desk',
      headline: 'Everything your remote team needs in one workspace',
      cta: 'Open demo',
      audience: 'Workflow and productivity readers',
      offer: '14-day premium access for new teams',
      disclaimer: 'Trial converts unless canceled before renewal.',
      duration: '00:13',
    },
    {
      source: sampleAdVideoGroceryShelf,
      campaign: 'CPG push',
      brand: 'Fresh Pantry',
      headline: 'Popular pantry picks now on same-day delivery',
      cta: 'Add to cart',
      audience: 'Food and home readers',
      offer: 'Free delivery on qualifying orders',
      disclaimer: 'Delivery minimums and service fees may apply.',
      duration: '00:10',
    },
    {
      source: sampleAdVideoSmartphoneSkincare,
      campaign: 'Product demo',
      brand: 'Derma Daily',
      headline: 'The daily routine clip driving the latest launch',
      cta: 'Shop now',
      audience: 'Beauty and lifestyle audiences',
      offer: 'Launch-day bundle pricing available',
      disclaimer: 'Bundle inventory is limited by region.',
      duration: '00:12',
    },
  ],
  '300x300': [
    {
      source: sampleAdVideoSkincareCream,
      campaign: 'Routine launch',
      brand: 'LumaSkin',
      headline: 'A fast product spot for the new hydration cream',
      cta: 'Shop routine',
      audience: 'Skincare and wellness readers',
      offer: 'Mini routine kit included with purchase',
      disclaimer: 'Gift inventory is limited.',
      duration: '00:18',
    },
    {
      source: sampleAdVideoFashionModel,
      campaign: 'Brand story',
      brand: 'Atelier Lane',
      headline: 'A compact fashion creative built for mobile shoppers',
      cta: 'Shop now',
      audience: 'Scroll-heavy fashion traffic',
      offer: 'New-customer shipping upgrade',
      disclaimer: 'Shipping promotion may end without notice.',
      duration: '00:17',
    },
    {
      source: sampleAdVideoSportsCarRoad,
      campaign: 'Mobile teaser',
      brand: 'Apex Drive',
      headline: 'A short-form teaser for the new track-inspired coupe',
      cta: 'Play teaser',
      audience: 'Visual-first readers',
      offer: 'Early reservation waitlist now open',
      disclaimer: 'Waitlist placement does not guarantee purchase.',
      duration: '00:07',
    },
  ],
  '300x250': [
    {
      source: sampleAdVideoBeautyInfluencer,
      campaign: 'Creator reel',
      brand: 'Glow Ritual',
      headline: 'Short-form skincare creative built for in-content views',
      cta: 'Watch spot',
      audience: 'Beauty and lifestyle readers',
      offer: 'Intro pricing live for featured products',
      disclaimer: 'Featured products may vary by market.',
      duration: '00:07',
    },
    {
      source: sampleAdVideoLuxuryCar,
      campaign: 'Auto launch',
      brand: 'Vertex Auto',
      headline: 'See the latest road-ready performance model in action',
      cta: 'Explore model',
      audience: 'Car buyers and enthusiasts',
      offer: 'Book a dealer follow-up today',
      disclaimer: 'Dealer availability differs by location.',
      duration: '00:13',
    },
    {
      source: sampleAdVideoGroceryShelf,
      campaign: 'Cart builder',
      brand: 'Fresh Pantry',
      headline: 'Weekly grocery restocks without the store run',
      cta: 'Build basket',
      audience: 'Home and kitchen readers',
      offer: 'Free delivery on the first order',
      disclaimer: 'Minimum order totals may apply.',
      duration: '00:10',
    },
    {
      source: sampleAdVideoLaptopWorkspace,
      campaign: 'Productivity push',
      brand: 'SignalOS',
      headline: 'Move from draft to publish without changing tools',
      cta: 'Try demo',
      audience: 'Tech comparison readers',
      offer: 'New-team onboarding included',
      disclaimer: 'Onboarding timing varies by account volume.',
      duration: '00:13',
    },
  ],
  '320x100': [
    {
      source: sampleAdVideoSmartphoneSkincare,
      campaign: 'Mobile beauty spot',
      brand: 'LumaSkin',
      headline: 'A creator-led skincare spot sized for mobile',
      cta: 'Shop now',
      audience: 'Mobile beauty readers',
      offer: 'Featured bundle discounted today',
      disclaimer: 'Bundle pricing may change without notice.',
      duration: '00:12',
    },
    {
      source: sampleAdVideoSportsCarRoad,
      campaign: 'Mobile auto teaser',
      brand: 'Apex Drive',
      headline: 'A fast teaser for the latest coupe reveal',
      cta: 'Watch clip',
      audience: 'Mobile readers in transit',
      offer: 'Waitlist access available now',
      disclaimer: 'Waitlist access is non-transferable.',
      duration: '00:07',
    },
    {
      source: sampleAdVideoGroceryShelf,
      campaign: 'Quick cart',
      brand: 'Fresh Pantry',
      headline: 'Restock the kitchen in one quick order',
      cta: 'Open cart',
      audience: 'Short-session users',
      offer: 'Free same-day delivery on first basket',
      disclaimer: 'Service area restrictions apply.',
      duration: '00:10',
    },
  ],
  '320x50': [
    {
      source: sampleAdVideoBeautyInfluencer,
      campaign: 'Mini reel',
      brand: 'Glow Ritual',
      headline: 'A creator cut built for bottom-bar mobile inventory',
      cta: 'See more',
      audience: 'Fast-scroll mobile users',
      offer: 'Launch pricing on featured skincare',
      disclaimer: 'Launch pricing ends when inventory resets.',
      duration: '00:07',
    },
    {
      source: sampleAdVideoLaptopWorkspace,
      campaign: 'Mini SaaS spot',
      brand: 'Northline Desk',
      headline: 'A fast product spot for mobile productivity readers',
      cta: 'Open demo',
      audience: 'Scrolling mobile sessions',
      offer: 'Free starter workspace for new users',
      disclaimer: 'Offer limited to newly created accounts.',
      duration: '00:13',
    },
  ],
};

const mixedNetworkWeights: Array<{ network: ConcreteSampleAdNetwork; weight: number }> = [
  { network: 'adsense', weight: 0.35 },
  { network: 'mediavine', weight: 0.25 },
  { network: 'ezoic', weight: 0.2 },
  { network: 'raptive', weight: 0.2 },
];

const networkProfileLabels: Record<ConcreteSampleAdNetwork, string> = {
  adsense: 'Google AdSense',
  mediavine: 'Mediavine',
  ezoic: 'Ezoic',
  raptive: 'Raptive',
};

const shuffledDecks: Record<string, unknown[]> = {};
const deckIndex: Record<string, number> = {};

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = arr[i];
    const swap = arr[j];
    if (current === undefined || swap === undefined) continue;
    arr[i] = swap;
    arr[j] = current;
  }

  return arr;
}

function nextSampleAsset<T>(key: string, variants: T[]): T | undefined {
  if (!variants || variants.length === 0) return undefined;

  if (!shuffledDecks[key]) {
    shuffledDecks[key] = shuffle([...variants]);
    deckIndex[key] = 0;
  }

  let idx = deckIndex[key]!;
  if (idx >= shuffledDecks[key].length) {
    shuffledDecks[key] = shuffle([...variants]);
    idx = 0;
  }

  deckIndex[key] = idx + 1;
  return shuffledDecks[key][idx] as T;
}

function resolveMode(mode: SampleAdMode): SampleAdMode {
  return sampleAdModeSchema.safeParse(mode).success ? mode : SAMPLE_AD_MODE;
}

function resolveNetwork(network: SampleAdNetwork): SampleAdNetwork {
  const parsedNetwork = sampleAdNetworkSchema.safeParse(network);
  return parsedNetwork.success ? parsedNetwork.data : SAMPLE_AD_NETWORK;
}

function pickWeightedNetwork(): ConcreteSampleAdNetwork {
  const totalWeight = mixedNetworkWeights.reduce((sum, option) => sum + option.weight, 0);
  const random = Math.random() * totalWeight;

  let cumulativeWeight = 0;
  for (const option of mixedNetworkWeights) {
    cumulativeWeight += option.weight;
    if (random <= cumulativeWeight) return option.network;
  }

  const fallbackNetwork = mixedNetworkWeights[0];
  if (!fallbackNetwork) {
    throw new Error('mixedNetworkWeights must contain at least one network');
  }

  return fallbackNetwork.network;
}

function pickMixedProfileOrder(max = 4): ConcreteSampleAdNetwork[] {
  const orderedNetworks: ConcreteSampleAdNetwork[] = [];
  while (orderedNetworks.length < max) {
    const network = pickWeightedNetwork();
    if (!orderedNetworks.includes(network)) {
      orderedNetworks.push(network);
    }
  }
  return orderedNetworks;
}

function pickRandomText(items: string[]): string {
  return items[Math.floor(Math.random() * items.length)]!;
}

function createCampaignFallback(profile: SampleAdProfile): SampleCampaign {
  return {
    campaign: pickRandomText(profile.campaignPool),
    brand: pickRandomText(profile.brandPool),
    headline: pickRandomText(profile.headlinePool),
    cta: pickRandomText(profile.ctaPool),
    audience: pickRandomText(profile.audiencePool),
    offer: pickRandomText(profile.offerPool),
    disclaimer: pickRandomText(profile.disclaimerPool),
  };
}

function resolveSvgSource(fileName: string): string | undefined {
  return readSampleSvg(fileName);
}

function resolveVideoSource(fileName: string): string | undefined {
  return resolveSampleVideoSource(fileName);
}

function createCreative(
  network: ConcreteSampleAdNetwork,
  profile: SampleAdProfile,
  kind: SampleAdCreativeKind,
  source: string,
  campaignOverride?: Partial<SampleCampaign>,
): SampleAdCreative {
  const fallbackCampaign = createCampaignFallback(profile);
  const campaign = {
    ...fallbackCampaign,
    ...campaignOverride,
  };

  return {
    kind,
    source,
    network,
    networkLabel: networkProfileLabels[network],
    headline: campaign.headline,
    brand: campaign.brand,
    cta: campaign.cta,
    campaign: campaign.campaign,
    audience: campaign.audience,
    offer: campaign.offer,
    disclaimer: campaign.disclaimer,
    duration: campaign.duration,
  };
}

function pickCreativeForProfile(
  width: number,
  height: number,
  profile: SampleAdProfile,
  mode: SampleAdMode,
): SampleAdCreative | undefined {
  const key = `${width}x${height}`;
  if (Math.random() > profile.fillRate) return undefined;

  const svgs = sampleAdVariants[key];
  const videos = sampleAdVideos[key];
  const hasSvgs = !!svgs && svgs.length > 0;
  const hasVideos = !!videos && videos.length > 0;

  if (!hasSvgs && !hasVideos) return undefined;

  const normalizedMode = resolveMode(mode);
  const useVideo =
    normalizedMode === 'video' || (normalizedMode === 'mixed' && hasVideos && Math.random() < profile.videoWeight);

  if (useVideo) {
    const source = nextSampleAsset<SampleVideoCreative>(`video:${profile.id}:${key}`, videos || []);
    const resolvedVideoSource = source ? resolveVideoSource(source.source) : undefined;
    if (source && resolvedVideoSource) {
      return createCreative(profile.id, profile, 'video', resolvedVideoSource, source);
    }
  }

  const svgAsset = nextSampleAsset(`svg:${profile.id}:${key}`, svgs || []);
  const svgSource = svgAsset ? resolveSvgSource(svgAsset) : undefined;
  if (svgSource) {
    return createCreative(profile.id, profile, 'svg', svgSource);
  }

  const fallbackVideo = nextSampleAsset<SampleVideoCreative>(`video:${profile.id}:${key}`, videos || []);
  const fallbackVideoSource = fallbackVideo ? resolveVideoSource(fallbackVideo.source) : undefined;
  if (fallbackVideo && fallbackVideoSource) {
    return createCreative(profile.id, profile, 'video', fallbackVideoSource, fallbackVideo);
  }

  return undefined;
}

export interface SampleAdCreative {
  kind: SampleAdCreativeKind;
  source: string;
  network: ConcreteSampleAdNetwork;
  networkLabel: string;
  headline: string;
  brand: string;
  cta: string;
  campaign: string;
  audience: string;
  offer: string;
  disclaimer: string;
  duration?: string;
}

function resolveCandidateNetworks(network: SampleAdNetwork): ConcreteSampleAdNetwork[] {
  if (network === 'mixed') {
    return pickMixedProfileOrder();
  }

  return [network as ConcreteSampleAdNetwork];
}

export function getSampleAdCreative(
  width: number,
  height: number,
  mode: SampleAdMode = SAMPLE_AD_MODE,
  network: SampleAdNetwork = SAMPLE_AD_NETWORK,
): SampleAdCreative | undefined {
  const sequence = getSampleAdCreativeSequence(width, height, mode, network, 1);
  return sequence[0];
}

function pickCreativeAcrossNetworks(
  width: number,
  height: number,
  candidateNetworks: ConcreteSampleAdNetwork[],
  mode: SampleAdMode,
): SampleAdCreative | undefined {
  for (const candidateNetwork of candidateNetworks) {
    const profile = sampleAdProfiles[candidateNetwork];
    const creative = pickCreativeForProfile(width, height, profile, mode);
    if (creative) {
      return creative;
    }
  }

  const fallbackNetworks = Object.keys(sampleAdProfiles) as ConcreteSampleAdNetwork[];
  for (const fallbackNetwork of fallbackNetworks) {
    if (candidateNetworks.includes(fallbackNetwork)) continue;
    const profile = sampleAdProfiles[fallbackNetwork];
    const creative = pickCreativeForProfile(width, height, profile, mode);
    if (creative) {
      return creative;
    }
  }

  return undefined;
}

export function getSampleAdCreativeSequence(
  width: number,
  height: number,
  mode: SampleAdMode = SAMPLE_AD_MODE,
  network: SampleAdNetwork = SAMPLE_AD_NETWORK,
  length = 4,
): SampleAdCreative[] {
  const resolvedNetwork = resolveNetwork(network);
  const candidateNetworks = resolveCandidateNetworks(resolvedNetwork);
  const sequence: SampleAdCreative[] = [];
  const seenSources = new Set<string>();
  const maxAttempts = length * 10;
  const targetLength = Math.max(1, Math.min(length, 8));

  for (let attempts = 0; attempts < maxAttempts && sequence.length < targetLength; attempts += 1) {
    const nextCreative = pickCreativeAcrossNetworks(width, height, candidateNetworks, mode);
    if (!nextCreative) break;

    if (seenSources.has(nextCreative.source)) {
      continue;
    }

    seenSources.add(nextCreative.source);
    sequence.push(nextCreative);
  }

  return sequence;
}

/** Existing compatibility API for legacy call sites that only need SVG. */
export function getSampleAdSvg(
  width: number,
  height: number,
  mode: SampleAdMode = SAMPLE_AD_MODE,
  network: SampleAdNetwork = SAMPLE_AD_NETWORK,
): string | undefined {
  const creative = getSampleAdCreative(width, height, mode, network);
  return creative?.kind === 'svg' ? creative.source : undefined;
}



