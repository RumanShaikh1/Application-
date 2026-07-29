// Content for "The Absolute Beginner's Map of the Stock Market" - the
// first-run curriculum (see LearnPage). Static and client-only: this is a
// comprehension check on concepts already explained on the same page, not a
// scored assessment, so there's no need to hide `correct` behind a server
// round-trip the way placement/scenario answer keys are (see
// server/src/placement/placementGating.ts for that pattern, which doesn't
// apply here).
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Building2,
  Calculator,
  Compass,
  CreditCard,
  Flame,
  Gauge,
  Gift,
  Hourglass,
  Landmark,
  LayoutGrid,
  PiggyBank,
  PieChart,
  Receipt,
  RefreshCw,
  Scale,
  ShieldCheck,
  Store,
  Tag,
  Target,
  TreeDeciduous,
  TrendingUp,
  Umbrella,
  type LucideIcon
} from 'lucide-react'

export type BasicsAccent = 'cobalt' | 'vermilion' | 'lime'

export interface BasicsTerm {
  term: string
  icon: LucideIcon
  definition: string
  example?: string
}

export interface BasicsCheckOption {
  id: string
  label: string
  correct: boolean
}

export interface BasicsCheckQuestion {
  id: string
  prompt: string
  multiSelect: boolean
  options: BasicsCheckOption[]
  explanation: string
}

export interface BasicsPart {
  id: string
  title: string
  icon: LucideIcon
  accent: BasicsAccent
  lead: string
  terms: BasicsTerm[]
  takeaway?: string
  checks: BasicsCheckQuestion[]
}

export const BASICS_PARTS: BasicsPart[] = [
  {
    id: 'part-1-what-it-is',
    title: 'What the market actually is',
    icon: Landmark,
    accent: 'cobalt',
    lead: 'Understand what you’re doing and what can go wrong before you think about making money. A beginner who learns to pick "winners" first becomes a gambler. A beginner who learns what a share is and how much they can lose first becomes an investor.',
    terms: [
      {
        term: 'A share (or stock)',
        icon: PieChart,
        definition:
          'A share is a tiny slice of ownership in a company. If a company is a giant pizza cut into a crore of slices, one share is one slice. Own it, and you own that fraction of the company - its profits, and its problems.',
        example:
          'Your school runs a canteen. It needs ₹1,00,000 to start, so 100 students each put in ₹1,000 and get one "share" each. If the canteen does well and is later worth ₹2,00,000, each share is now worth ₹2,000. If it flops and is worth ₹50,000, each share is worth ₹500. You didn’t lend money - you own a piece.'
      },
      {
        term: 'The stock market',
        icon: Store,
        definition:
          'A marketplace where people buy and sell these ownership slices from each other. You’re almost never buying from the company itself; you’re buying from another person who wants to sell.',
        example:
          'Think of a giant second-hand marketplace, but instead of used phones, people are trading slices of companies. The "price" of a slice is just whatever a buyer and a seller last agreed on.'
      },
      {
        term: 'Stock exchange (NSE / BSE in India)',
        icon: Landmark,
        definition:
          'The official, regulated place where this trading happens. In India the two big ones are the NSE (National Stock Exchange) and BSE (Bombay Stock Exchange). They make sure trades are fair and actually get completed.',
        example: 'Like an official school sports league with referees and rules, instead of kids playing random matches in a park. The exchange is the league that keeps it honest.'
      },
      {
        term: 'SEBI',
        icon: ShieldCheck,
        definition:
          'The referee for the whole market. SEBI (Securities and Exchange Board of India) is the government body that makes the rules and punishes cheating, to protect ordinary investors.',
        example: 'The principal’s office of the stock market. If someone cheats, SEBI is who comes down on them.'
      },
      {
        term: 'Index (Nifty 50 / Sensex)',
        icon: Gauge,
        definition:
          'A single number that summarises how a big group of important companies is doing overall, so you can tell "is the market up or down today?" without checking hundreds of stocks. The Nifty 50 tracks 50 large companies; the Sensex tracks 30.',
        example:
          'Your class doesn’t report every student’s marks to the principal - it reports the class average. The index is the market’s "class average." If the Nifty is up 1%, big Indian companies rose about 1% on average today.'
      }
    ],
    takeaway:
      'You buy slices of real companies, from other people, in a refereed marketplace, and an index tells you the overall mood. Nothing here is magic or random - it’s ownership.',
    checks: [
      {
        id: 'check-1-ownership',
        prompt: 'A company you own one share of just became worth twice as much overall. What happens to your share, and why?',
        multiSelect: false,
        options: [
          {
            id: 'a',
            label: 'It becomes worth about twice as much too - a share is a proportional slice of the company, not a separate object.',
            correct: true
          },
          { id: 'b', label: 'Nothing changes for existing shareholders - only new buyers benefit from the higher value.', correct: false },
          { id: 'c', label: 'It depends only on how many people happen to be talking about the stock that day.', correct: false }
        ],
        explanation:
          'A share is literally a fraction of the company. If the whole pizza is worth more, every slice is worth more, in the same proportion - that’s what ownership means.'
      }
    ]
  },
  {
    id: 'part-2-why-prices-move',
    title: 'Why prices move',
    icon: Activity,
    accent: 'vermilion',
    lead: 'The part beginners get most wrong.',
    terms: [
      {
        term: 'Price',
        icon: Tag,
        definition: 'What one share costs right now: simply the last price a buyer and seller agreed on.'
      },
      {
        term: 'Supply and demand',
        icon: Scale,
        definition:
          'Prices move because of how many people want to buy versus sell. More eager buyers than sellers → price rises. More eager sellers → price falls. That’s the whole engine.',
        example:
          'Limited-edition sneakers. If 500 people want a pair and only 100 exist, the price shoots up. If nobody wants them, the shop slashes the price. Shares work the same way.'
      },
      {
        term: 'Price vs. what’s actually true',
        icon: Flame,
        definition:
          'A price going up doesn’t mean it’s "good," and going down doesn’t mean it’s "bad." Price reflects what people feel and expect, which can be wrong. A price can rise on hype and fall on panic, with nothing about the actual company having changed.',
        example:
          'A rumour spreads that a certain chocolate will be discontinued. Everyone rushes to buy it, the shop price triples - even though the chocolate tastes exactly the same as yesterday. The price changed; the thing itself didn’t. Stocks do this constantly.'
      },
      {
        term: 'Volatility',
        icon: Activity,
        definition: 'How much and how fast a price jumps around. High volatility = big, scary swings; low volatility = calm and steady.',
        example:
          'One friend’s mood is totally predictable day to day (low volatility). Another is ecstatic one day and furious the next (high volatility). Some stocks are the calm friend; some are the moody one.'
      }
    ],
    takeaway:
      'Prices move on what people expect, not just on facts. Learning to tell "the company actually changed" from "people are just excited or scared" is the single most valuable skill in investing.',
    checks: [
      {
        id: 'check-2-price-vs-fact',
        prompt:
          'A company’s actual business - sales, staff, products - hasn’t changed at all today, but a rumor makes people suddenly want to buy its stock. What does that tell you about price?',
        multiSelect: false,
        options: [
          {
            id: 'a',
            label: 'The price will likely rise on demand alone - price can move on expectation or emotion, separately from what the company is actually worth.',
            correct: true
          },
          { id: 'b', label: 'The price can’t move unless the company’s real profits change first.', correct: false },
          { id: 'c', label: 'The price will fall, because rumors always turn out to be false eventually.', correct: false }
        ],
        explanation: 'Like the chocolate rumor: the price can triple while the product itself is unchanged. Price reflects what people feel and expect, which can be wrong.'
      }
    ]
  },
  {
    id: 'part-3-reading-a-company',
    title: 'Reading a company',
    icon: Calculator,
    accent: 'lime',
    lead: 'The numbers, in plain words - you don’t need maths, just what each one means.',
    terms: [
      {
        term: 'Market capitalisation (market cap)',
        icon: Building2,
        definition: 'The total value of the whole company: share price × number of shares. It’s how you tell a giant company from a tiny one.',
        example:
          'One share of a company at ₹100 tells you nothing about its size. But if there are 10 crore shares, the whole company is worth ₹1,000 crore. Market cap is the size of the whole pizza, not one slice. Big companies (large-cap) are usually steadier; tiny ones (small-cap) are riskier and swingier.'
      },
      {
        term: 'Revenue',
        icon: TrendingUp,
        definition: 'The total money a company brings in from sales, before costs. Also called "the top line."',
        example: 'Your canteen sold ₹5,00,000 of food this year. That’s revenue - before you subtract what the ingredients and staff cost.'
      },
      {
        term: 'Profit',
        icon: PiggyBank,
        definition: 'What’s left after all costs are paid. This is what actually matters - a company can have huge revenue and still lose money.',
        example:
          'The canteen made ₹5,00,000 in sales but spent ₹4,80,000 on ingredients, salaries and rent. Profit is ₹20,000. If it had spent ₹5,20,000, it made a loss despite big sales.'
      },
      {
        term: 'P/E ratio (price-to-earnings)',
        icon: Calculator,
        definition:
          'How expensive a stock is relative to the profit it makes. It answers: "how many rupees am I paying for each ₹1 of yearly profit?" A high P/E means investors are paying a lot, usually because they expect big future growth - which may or may not happen.',
        example:
          'Two juice stalls each make ₹1,000 profit a year. One is on sale for ₹10,000 (P/E of 10), the other for ₹40,000 (P/E of 40). The second isn’t automatically worse - maybe it’s growing fast - but you’re paying four times as much for the same profit today, so you’re betting harder on its future.'
      },
      {
        term: 'Dividend',
        icon: Gift,
        definition:
          'A share of profit the company pays out to owners, usually as cash. Not all companies pay them; growing ones often reinvest instead.',
        example: 'The canteen made ₹20,000 profit and decides to hand ₹5,000 of it back to its 100 student-owners - ₹50 each. That’s a dividend: a reward just for owning it, separate from the share price.'
      },
      {
        term: 'Debt',
        icon: CreditCard,
        definition:
          'Money the company has borrowed and must repay. A little is normal and useful; too much is dangerous, because the loan must be repaid even in a bad year.',
        example:
          'Two students start food stalls. One used ₹10,000 of savings. The other borrowed ₹90,000. If sales are great, the borrower grows faster. If sales dry up for a month, the borrower still owes the repayment and can go broke - while the saver just waits it out. Debt magnifies both directions.'
      }
    ],
    takeaway:
      'A company isn’t a squiggly price line - it’s a business. Revenue is what comes in, profit is what’s kept, P/E is how much you’re paying for that profit, and debt is how fragile it is if things go wrong. Read the business, not just the price.',
    checks: [
      {
        id: 'check-3-pe-ratio',
        prompt: 'Two companies make the same yearly profit, but Company A’s stock costs 4x more than Company B’s. What does Company A’s higher P/E most likely mean?',
        multiSelect: false,
        options: [
          {
            id: 'a',
            label: 'Investors are paying more for the same profit today, usually because they expect faster future growth - a bigger bet, not automatically a mistake.',
            correct: true
          },
          { id: 'b', label: 'Company A is scientifically proven to be the better business.', correct: false },
          { id: 'c', label: 'Company A must be committing fraud.', correct: false }
        ],
        explanation: 'Like the two juice stalls: paying 4x for the same ₹1,000 profit means betting harder on future growth, not evidence of a better or worse business today.'
      },
      {
        id: 'check-3-revenue-vs-profit',
        prompt: 'A company reports ₹10 crore in revenue this year. Which of these could still be true? Select all that apply.',
        multiSelect: true,
        options: [
          { id: 'a', label: 'It could have made an overall loss, if its costs were higher than ₹10 crore.', correct: true },
          { id: 'b', label: 'It could have taken on debt to fund the sales that produced that revenue.', correct: true },
          { id: 'c', label: 'Revenue guarantees the company kept at least half of it as profit.', correct: false }
        ],
        explanation: 'Revenue is the top line, before costs. Profit is only what’s left after every cost is paid, and debt is separate borrowed money that must be repaid regardless of how sales went.'
      }
    ]
  },
  {
    id: 'part-4-thinking-about-risk',
    title: 'Thinking about risk',
    icon: Umbrella,
    accent: 'vermilion',
    lead: 'The survival skills - this is the part that keeps beginners from blowing up. Learn it before you learn "how to win."',
    terms: [
      {
        term: 'Risk',
        icon: AlertTriangle,
        definition:
          'The chance, and the size, of losing money. Every investment has some. The goal is never to eliminate risk - it’s to take risks you understand and can survive.',
        example: 'Crossing a quiet street is low risk; crossing a highway blindfolded is high risk. Both are "crossing a road." Investing is the same - it’s about which risk you’re taking, not whether you take any.'
      },
      {
        term: 'Diversification',
        icon: LayoutGrid,
        definition: 'Not putting all your money in one place, so a single failure can’t wipe you out. The most important protective habit there is.',
        example:
          'You have ₹1,000 to bet on your school’s exam toppers. Put it all on one friend and if they have a bad day, you lose everything. Spread it across five likely toppers and one bad day barely dents you. Owning many different stocks works the same way.'
      },
      {
        term: 'Concentration risk',
        icon: Target,
        definition: 'The danger of having too much riding on one stock - even a great one. A good company can still sink you if it’s most of what you own.',
        example:
          'Even if your smartest friend is usually the topper, betting your entire ₹1,000 on them alone is reckless - anyone can have one bad exam. The problem isn’t that they’re a bad bet; it’s that you have no cushion if the one bet fails.'
      },
      {
        term: 'Long-term vs short-term',
        icon: TreeDeciduous,
        definition:
          'Holding for years lets a good company grow and lets you ride out the scary dips; trading in and out over days is mostly reacting to noise, and costs and taxes eat you alive.',
        example: 'A mango tree pays off if you water it for years. Digging it up every week to check the roots just kills it. Most beginners "dig up the roots" constantly and wonder why nothing grows.'
      },
      {
        term: 'Costs (brokerage, taxes, fees)',
        icon: Receipt,
        definition: 'Every time you buy or sell, small charges and taxes are taken. They feel tiny per trade but destroy returns if you trade a lot.',
        example:
          'A game arcade takes ₹5 every time you swap tokens. Swap once, you barely notice. Swap 200 times and you’ve handed over ₹1,000 without playing a single extra game. Frequent trading does exactly this to your money.'
      }
    ],
    takeaway: 'Don’t put it all on one bet, give good decisions time to work, and remember that every trade costs you something. Surviving is the prerequisite to winning.',
    checks: [
      {
        id: 'check-4-concentration',
        prompt: 'You have ₹10,000 to invest and are extremely confident in one company. What does "concentration risk" suggest?',
        multiSelect: false,
        options: [
          {
            id: 'a',
            label: 'Even a great company can hurt you badly if it’s most of what you own - spreading money across several reduces how much any single surprise costs you.',
            correct: true
          },
          { id: 'b', label: 'You should always put everything into your single best idea, since spreading money out just waters down your best returns.', correct: false },
          { id: 'c', label: 'Concentration risk only applies to companies you don’t understand.', correct: false }
        ],
        explanation: 'Like betting your entire ₹1,000 on one topper: the company doesn’t have to be a bad bet for a bad day in it to wipe you out if it’s all you own.'
      },
      {
        id: 'check-4-cost-and-horizon',
        prompt: 'Which of these are true about frequent short-term trading? Select all that apply.',
        multiSelect: true,
        options: [
          { id: 'a', label: 'Small brokerage and tax charges on each trade add up and erode returns over many trades.', correct: true },
          { id: 'b', label: 'Constantly buying and selling makes it harder for a good decision to actually play out.', correct: true },
          { id: 'c', label: 'Trading often is the only reliable way to make a good return in the stock market.', correct: false }
        ],
        explanation: 'Like the arcade-token example: each swap looks tiny, but 200 of them quietly hand over real money. And a mango tree dug up weekly never gets the years it needs to grow.'
      }
    ]
  },
  {
    id: 'part-5-mindset',
    title: 'The mindset takeaways',
    icon: Compass,
    accent: 'cobalt',
    lead: 'Not terms - the attitudes that separate an investor from a gambler. What a beginner should actually walk away believing.',
    terms: [
      {
        term: 'You’re buying businesses, not lottery tickets',
        icon: Building2,
        definition: 'Behind every ticker is a real company that makes real things. If you wouldn’t want to own the business, don’t buy the share.'
      },
      {
        term: 'Judge the decision, not the outcome',
        icon: Scale,
        definition:
          'A good decision can lose money, and a bad decision can make money. Over short stretches, luck dominates. Judge your decisions by whether they were sensible with the information you had - not by whether they happened to pay off. This is the heart of it: the crowd that got rich on one reckless bet got lucky, not smart.'
      },
      {
        term: 'If you don’t understand it, you don’t own it',
        icon: BookOpen,
        definition: 'You’re just hoping. Never buy something because someone on the internet was excited about it. Excitement is not a reason.'
      },
      {
        term: 'The market rewards patience and punishes panic',
        icon: Hourglass,
        definition:
          'The biggest, most permanent losses come from selling in fear at the bottom and buying in greed at the top. Doing nothing is often the hardest and best move.'
      },
      {
        term: 'Protect the downside first',
        icon: ShieldCheck,
        definition: 'Amateurs ask "how much could I make?" Professionals ask "how much could I lose, and can I survive it?" Ask the second question first, every time.'
      },
      {
        term: 'You will be wrong often, and that’s fine',
        icon: RefreshCw,
        definition:
          'Even great investors are wrong a lot. The goal isn’t to never lose - it’s to lose small when wrong and win bigger when right, and to never bet so much on one thing that being wrong ends the game.'
      }
    ],
    checks: [
      {
        id: 'check-5-process-over-outcome',
        prompt: 'An investor made a well-reasoned, carefully-sized decision that still lost money because of bad luck. How should that decision be judged?',
        multiSelect: false,
        options: [
          {
            id: 'a',
            label: 'As a good decision - it was sound given the information available at the time, even though the outcome was bad.',
            correct: true
          },
          { id: 'b', label: 'As a bad decision, since the money was lost either way.', correct: false },
          { id: 'c', label: 'It can’t be judged without knowing what happened to competitors.', correct: false }
        ],
        explanation:
          'This is the idea every part of this app is built on: a sound call that loses money is still a sound call, and a reckless one that happens to pay off is still reckless.'
      }
    ]
  }
]
