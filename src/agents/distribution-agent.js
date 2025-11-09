// Distribution Strategy Agent
// Helps configure distribution channels, pricing, and release strategy across platforms

import {
  callClaudeWithCostTracking,
  validateRequiredFields,
  storeAsset,
  AGENT_CONFIG
} from '../utils/agent-utils.js';

export class DistributionAgent {
  constructor(env) {
    this.env = env;
    this.claudeApiKey = env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate comprehensive distribution strategy
   * @param {Object} bookMetadata - Book metadata (genre, target audience, etc.)
   * @param {Object} authorGoals - Author's goals and preferences
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Object} Distribution strategy recommendations
   */
  async generateStrategy(bookMetadata, authorGoals, userId, manuscriptId) {
    console.log(`Generating distribution strategy for ${bookMetadata.title}`);

    if (!this.claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    const {
      title,
      genre,
      targetAudience,
      wordCount,
      seriesInfo,
      previousBooks
    } = bookMetadata;

    const {
      primaryGoal = 'income', // income, exposure, hybrid
      experienceLevel = 'debut', // debut, established, bestseller
      budgetAvailable = 'modest', // bootstrap, modest, substantial
      timeCommitment = 'part-time', // part-time, full-time
      internationalAudience = false,
      exclusivityPreference = 'undecided' // kdp_select, wide, undecided
    } = authorGoals;

    const prompt = `You are an expert independent publishing strategist with deep knowledge of distribution channels, pricing strategies, and launch tactics.

BOOK INFORMATION:
Title: ${title}
Genre: ${genre}
Target Audience: ${targetAudience}
Word Count: ${wordCount}
Series: ${seriesInfo?.isPartOfSeries ? `Yes (${seriesInfo.seriesName} #${seriesInfo.seriesNumber})` : 'No'}
Previous Books: ${previousBooks ? previousBooks.length : 0}

AUTHOR PROFILE:
Primary Goal: ${primaryGoal}
Experience Level: ${experienceLevel}
Budget: ${budgetAvailable}
Time Commitment: ${timeCommitment}
International Audience: ${internationalAudience ? 'Yes' : 'No'}
Exclusivity Preference: ${exclusivityPreference}

TASK: Create a comprehensive distribution strategy tailored to this author's situation and goals.

ANALYZE AND RECOMMEND:

1. **DISTRIBUTION APPROACH**
   - KDP Select (Amazon exclusive) vs Wide distribution
   - Pros and cons for THIS specific situation
   - Concrete recommendation with rationale
   - Timeline considerations

2. **PLATFORM STRATEGY**
   For each major platform, recommend:
   - Should author use this platform?
   - Priority level (essential, recommended, optional, skip)
   - Specific tactics for this platform
   - Expected ROI

   Platforms to cover:
   - Amazon KDP (must include)
   - Draft2Digital (aggregator for wide)
   - IngramSpark (print + wholesale)
   - Google Play Books
   - Apple Books
   - Kobo Writing Life
   - Direct-to-library (Overdrive, cloudLibrary)
   - Author's own website (direct sales)

3. **PRICING STRATEGY**
   - Launch pricing
   - Long-term pricing
   - Platform-specific pricing considerations
   - Promotional pricing calendar (first 90 days)
   - International pricing recommendations

4. **RELEASE STRATEGY**
   - Pre-order strategy (yes/no, duration)
   - Launch day tactics
   - Post-launch momentum plan
   - Series-specific strategies if applicable

5. **TERRITORY AND RIGHTS**
   - Worldwide rights approach
   - Regional restrictions if any
   - Translation considerations
   - Audio rights strategy

6. **PROMOTIONAL CALENDAR**
   - Pre-launch (4 weeks before)
   - Launch week
   - Weeks 2-4
   - Months 2-3
   - Platform-specific promotions

7. **REVENUE PROJECTIONS**
   - Conservative scenario
   - Moderate scenario
   - Optimistic scenario
   - Factors that influence outcomes

8. **ACTION PLAN**
   - Step-by-step launch checklist
   - Timeline with specific dates
   - Resource requirements
   - Tools/services needed

Provide response as JSON:
{
  "distributionApproach": {
    "recommendation": "wide|kdp_select|hybrid",
    "rationale": "Detailed explanation for THIS author",
    "exclusivityDuration": "3 months then re-evaluate",
    "prosForAuthor": [],
    "consForAuthor": [],
    "reEvaluationTriggers": ["After 90 days", "If not in top 50k rank"]
  },

  "platformStrategy": [
    {
      "platform": "Amazon KDP",
      "priority": "essential",
      "shouldUse": true,
      "expectedRevenue": "60-70% of total",
      "tactics": [
        "Enroll in KDP Select for 90-day trial",
        "Run Kindle Countdown Deal in week 4",
        "Utilize Amazon Ads with $10/day budget"
      ],
      "setup": {
        "accountRequired": true,
        "taxForms": ["W-9 or W-8BEN"],
        "timeToSetup": "1-2 hours",
        "recurringCosts": "None (ad spend optional)"
      },
      "rationale": "Primary income source for debut thriller authors"
    },
    {
      "platform": "Draft2Digital",
      "priority": "recommended",
      "shouldUse": true,
      "expectedRevenue": "20-30% of total",
      "tactics": [
        "Distribute to all D2D partners",
        "Use Universal Book Links",
        "Enable Print on Demand"
      ],
      "setup": {
        "accountRequired": true,
        "taxForms": ["W-9"],
        "timeToSetup": "30 minutes",
        "recurringCosts": "None (D2D takes small %)"
      },
      "rationale": "Easy wide distribution without managing multiple accounts"
    },
    {
      "platform": "IngramSpark",
      "priority": "optional",
      "shouldUse": false,
      "expectedRevenue": "5-10% of total",
      "tactics": [],
      "setup": {
        "accountRequired": true,
        "taxForms": ["W-9"],
        "timeToSetup": "2-3 hours",
        "recurringCosts": "$49 setup fee, $25 per title per year"
      },
      "rationale": "Wait until book 2-3 to add IngramSpark print distribution"
    }
  ],

  "pricingStrategy": {
    "ebook": {
      "launch": "$0.99",
      "launchDuration": "7 days",
      "week2to4": "$2.99",
      "longTerm": "$4.99",
      "rationale": "Standard thriller pricing funnel",
      "royaltyImpact": {
        "at099": "35% royalty = $0.35 per sale",
        "at299": "70% royalty = $2.09 per sale",
        "at499": "70% royalty = $3.49 per sale"
      }
    },
    "print": {
      "recommended": "$16.99",
      "printCost": "$4.50",
      "royaltyPerSale": "$4.00",
      "rationale": "Competitive for 350-page thriller"
    },
    "audiobook": {
      "recommended": "$19.95",
      "acxRoyalty": "40%",
      "rationale": "Standard ACX pricing for 8-hour audiobook"
    },
    "bundling": {
      "recommendations": [
        "Offer box set after 3+ books at 40% discount",
        "Bundle ebook + audiobook on author site"
      ]
    }
  },

  "releaseStrategy": {
    "preOrder": {
      "recommended": true,
      "duration": "2 weeks",
      "platforms": ["Amazon", "Apple Books", "Kobo"],
      "rationale": "Builds anticipation without long wait",
      "preOrderPrice": "$0.99 to encourage pre-orders"
    },
    "launchDay": {
      "date": "Tuesday (mid-week launch)",
      "activities": [
        "Email newsletter with launch announcement",
        "Social media posts across all channels",
        "Activate Amazon ads",
        "Send to ARC review team",
        "Post in relevant Facebook groups"
      ]
    },
    "postLaunch": {
      "week1": "Monitor reviews, respond to early readers, adjust ads",
      "week2to4": "Run Kindle Countdown Deal or BookBub Feature Deal",
      "month2": "Increase price to $2.99, continue ads",
      "month3": "Evaluate KDP Select vs wide, adjust strategy"
    }
  },

  "territoryRights": {
    "approach": "worldwide_rights",
    "exclusions": [],
    "translations": {
      "recommended": false,
      "rationale": "Wait for book 3-5 before investing in translations",
      "futureLanguages": ["Spanish", "German", "Portuguese"]
    },
    "audioRights": {
      "strategy": "retain_all_rights",
      "platforms": ["ACX/Audible", "Findaway Voices"],
      "exclusivity": "Audible exclusive for debut book (40% royalty)"
    }
  },

  "promotionalCalendar": {
    "preLaunch": {
      "week-4": ["Set up ARC review team", "Create social media graphics"],
      "week-3": ["Send ARCs", "Schedule newsletter", "Set up ads"],
      "week-2": ["Pre-order live", "Start countdown posts"],
      "week-1": ["Final checklist", "Confirm all links work", "Schedule launch day posts"]
    },
    "launch": {
      "day1": ["Send launch email", "Post on social media", "Activate ads"],
      "week1": ["Daily social media", "Respond to reviews", "Monitor ad performance"]
    },
    "postLaunch": {
      "week2to4": ["Run promotion (Kindle Countdown)", "Request reviews", "Continue ads"],
      "month2": ["Analyze results", "Adjust pricing", "Plan next book marketing"],
      "month3": ["Evaluate wide distribution", "Plan series marketing", "Launch book 2 planning"]
    }
  },

  "revenueProjections": {
    "conservative": {
      "copies": 500,
      "avgPrice": "$3.99",
      "royaltyRate": 0.65,
      "revenue": "$1297",
      "assumptions": "Minimal marketing, slow organic growth"
    },
    "moderate": {
      "copies": 2000,
      "avgPrice": "$3.99",
      "royaltyRate": 0.65,
      "revenue": "$5187",
      "assumptions": "Active marketing, steady review growth, ads working"
    },
    "optimistic": {
      "copies": 5000,
      "avgPrice": "$3.99",
      "royaltyRate": 0.65,
      "revenue": "$12968",
      "assumptions": "Strong launch, good reviews, viral momentum, BookBub feature"
    },
    "factors": [
      "Review quality and quantity",
      "Amazon algorithm placement",
      "Ad campaign effectiveness",
      "Email list size",
      "Genre competitiveness",
      "Cover quality",
      "Blurb effectiveness"
    ]
  },

  "actionPlan": {
    "immediate": [
      "Create accounts on essential platforms",
      "Complete tax forms",
      "Finalize cover design",
      "Complete manuscript formatting"
    ],
    "twoWeeksBefore": [
      "Upload to all platforms",
      "Set pre-order dates",
      "Send ARCs",
      "Set up Amazon ads account"
    ],
    "oneWeekBefore": [
      "Verify all links work",
      "Schedule social media posts",
      "Prepare launch email",
      "Final metadata checks"
    ],
    "launchWeek": [
      "Send launch email",
      "Activate ads",
      "Monitor closely",
      "Respond to early feedback"
    ]
  },

  "toolsAndServices": {
    "essential": [
      "Amazon KDP account",
      "Draft2Digital account",
      "Email service provider (Mailchimp/ConvertKit)",
      "Formatting tool (Vellum/Atticus)"
    ],
    "recommended": [
      "BookFunnel (for ARCs)",
      "Publisher Rocket (keyword research)",
      "Canva Pro (graphics)",
      "AMS ads course"
    ],
    "optional": [
      "VA for ad management",
      "Publicist (if budget $2000+)",
      "BookBub ads"
    ],
    "estimatedCost": {
      "essential": "$0-100",
      "recommended": "$200-400",
      "optional": "$500-3000"
    }
  }
}`;

    const strategy = await callClaudeWithCostTracking(
      this.claudeApiKey,
      prompt,
      AGENT_CONFIG.TEMPERATURE.BALANCED,
      'DistributionAgent',
      this.env,
      userId,
      manuscriptId,
      'publishing',
      'generate_distribution_strategy'
    );

    validateRequiredFields(strategy, ['distributionApproach', 'platformStrategy'], 'Distribution Strategy');

    // Store strategy
    const storageKey = `distribution-strategy-${manuscriptId}-${Date.now()}`;
    await storeAsset(
      this.env.R2.getBucket('manuscripts_processed'),
      storageKey,
      'distribution-strategy',
      strategy
    );

    return strategy;
  }
}
