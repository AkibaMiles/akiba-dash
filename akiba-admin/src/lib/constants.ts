export const QUEST_IDS = {
  BALANCE_STREAK_10:  'feb6e5ef-7d9c-4ca6-a042-e2b692a6b00f',
  BALANCE_STREAK_30:  'a1ac5914-20d4-4436-bf02-29563938fe9d',
  BALANCE_STREAK_100: 'b5c7e1d2-6f8a-4b0c-9d2e-3a1f7c5b8e4d',
  DAILY_CHECKIN:      'a9c68150-7db8-4555-b87f-5e9117b43a08',
} as const

export const AKIBA_MINIPOINTS =
  process.env.NEXT_PUBLIC_AKIBA_MINIPOINTS ||
  '0xab93400000751fc17918940C202A66066885d628'

/** All quests that require on-chain verification (excludes check-in & referral) */
export const ONCHAIN_QUEST_IDS = [
  'feb6e5ef-7d9c-4ca6-a042-e2b692a6b00f', // Save $10
  'a1ac5914-20d4-4436-bf02-29563938fe9d', // Save $30
  'b5c7e1d2-6f8a-4b0c-9d2e-3a1f7c5b8e4d', // Save $100
  '9ca81915-8707-43c9-9472-9faed0c7cc58', // Hold $10 in Kiln Finance
  '383eaa90-75aa-4592-a783-ad9126e8f04d', // Transact
  'f6d027d2-bf52-4768-a87f-2be00a5b03a0', // Make 5 transactions
  'ea001296-2405-451b-a590-941af22a8df1', // 10 Transactions
  '60320fa4-1681-4795-8818-429f11afe784', // 20 Transactions
  'c6b14ae1-66e9-4777-9c9f-65e57b091b16', // Topup Minipay
  '96009afb-0762-4399-adb3-ced421d73072', // Weekly Top-Up
  '6ddc811a-1a4d-4e57-871d-836f07486531', // 7 day streak
] as const

export const SAVINGS_QUEST_IDS = [
  QUEST_IDS.BALANCE_STREAK_10,
  QUEST_IDS.BALANCE_STREAK_30,
  QUEST_IDS.BALANCE_STREAK_100,
] as const

export const AKIBA_TEAL = '#238D9D'
export const AKIBA_TEAL_20 = 'rgba(35,141,157,0.2)'
