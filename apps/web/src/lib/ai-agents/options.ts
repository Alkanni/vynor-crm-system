import type { AiModelTier, AiTemperatureLevel, KnowledgeProduct } from '@vynor/contracts';

export const MODEL_TIER_OPTIONS: Record<
  AiModelTier,
  { label: string; credits: number; description: string }
> = {
  BASIC: { label: 'Basic', credits: 8, description: 'Fast answers for simple FAQs.' },
  STANDARD: { label: 'Standard', credits: 15, description: 'Good quality for most businesses.' },
  STANDARD_PLUS: {
    label: 'Standard+',
    credits: 27,
    description: 'Better reasoning for longer conversations.',
  },
  PREMIUM: {
    label: 'Premium',
    credits: 60,
    description: 'Best quality for complex sales and support.',
  },
};

export const TEMPERATURE_OPTIONS: Record<AiTemperatureLevel, { label: string; hint: string }> = {
  PRECISE: { label: 'Precise', hint: 'Short, factual replies.' },
  BALANCED: { label: 'Balanced', hint: 'Friendly replies that stay on topic.' },
  CREATIVE: { label: 'Creative', hint: 'Warmer, more expressive replies.' },
};

/** Standard offsets; zones with daylight saving shift by an hour part of the year. */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Pacific/Honolulu', label: '(GMT-10:00) Hawaii' },
  { value: 'America/Los_Angeles', label: '(GMT-8:00) Pacific Time (US & Canada)' },
  { value: 'America/Denver', label: '(GMT-7:00) Mountain Time (US & Canada)' },
  { value: 'America/Chicago', label: '(GMT-6:00) Central Time (US & Canada)' },
  { value: 'America/New_York', label: '(GMT-5:00) Eastern Time (US & Canada)' },
  { value: 'America/Sao_Paulo', label: '(GMT-3:00) Brasilia' },
  { value: 'UTC', label: '(GMT+0:00) UTC' },
  { value: 'Europe/London', label: '(GMT+0:00) London' },
  { value: 'Europe/Paris', label: '(GMT+1:00) Paris, Berlin, Amsterdam' },
  { value: 'Europe/Istanbul', label: '(GMT+3:00) Istanbul' },
  { value: 'Asia/Riyadh', label: '(GMT+3:00) Riyadh' },
  { value: 'Asia/Dubai', label: '(GMT+4:00) Abu Dhabi, Dubai' },
  { value: 'Asia/Karachi', label: '(GMT+5:00) Karachi' },
  { value: 'Asia/Kolkata', label: '(GMT+5:30) Mumbai, New Delhi' },
  { value: 'Asia/Dhaka', label: '(GMT+6:00) Dhaka' },
  { value: 'Asia/Jakarta', label: '(GMT+7:00) Bangkok, Hanoi, Jakarta' },
  { value: 'Asia/Makassar', label: '(GMT+8:00) Makassar, Denpasar (WITA)' },
  { value: 'Asia/Singapore', label: '(GMT+8:00) Singapore, Kuala Lumpur' },
  { value: 'Asia/Shanghai', label: '(GMT+8:00) Beijing, Hong Kong' },
  { value: 'Asia/Manila', label: '(GMT+8:00) Manila' },
  { value: 'Asia/Jayapura', label: '(GMT+9:00) Jayapura (WIT)' },
  { value: 'Asia/Tokyo', label: '(GMT+9:00) Tokyo, Seoul' },
  { value: 'Australia/Sydney', label: '(GMT+10:00) Sydney, Melbourne' },
  { value: 'Pacific/Auckland', label: '(GMT+12:00) Auckland' },
];

/** Workspace conversation labels the AI may be allowed to apply. */
export const CONVERSATION_LABELS = [
  'Booking',
  'Purchased',
  'Complaint',
  'VIP',
  'Follow Up',
  'Refund Request',
];

/** Workspace pipeline, in order. The AI may only move a conversation forward. */
export const PIPELINE_STATUSES: { name: string; dotClassName: string }[] = [
  { name: 'New Leads', dotClassName: 'bg-sky-500' },
  { name: 'Hot Leads', dotClassName: 'bg-red-500' },
  { name: 'Payment', dotClassName: 'bg-amber-500' },
  { name: 'Customer', dotClassName: 'bg-emerald-500' },
];

/** Workspace product catalog that can be imported into an agent's knowledge. */
export const PRODUCT_CATALOG: KnowledgeProduct[] = [
  {
    id: 'prd_01',
    name: 'Sprei Katun Jepang 180x200',
    description: 'Sprei katun Jepang lembut dan adem, lengkap dengan 2 sarung bantal.',
    weightGrams: 1200,
    stock: 48,
    price: 289000,
  },
  {
    id: 'prd_02',
    name: 'Bantal Memory Foam',
    description: 'Bantal memory foam ergonomis untuk leher, sarung bisa dilepas dan dicuci.',
    weightGrams: 900,
    stock: 35,
    price: 245000,
  },
  {
    id: 'prd_03',
    name: 'Diffuser Aromaterapi 300ml',
    description: 'Diffuser ultrasonik dengan lampu 7 warna dan timer otomatis.',
    weightGrams: 650,
    stock: 20,
    price: 179000,
  },
  {
    id: 'prd_04',
    name: 'Set Handuk Mandi Premium',
    description: 'Set 2 handuk mandi katun 70x140 yang menyerap air dengan cepat.',
    weightGrams: 1000,
    stock: 60,
    price: 159000,
  },
  {
    id: 'prd_05',
    name: 'Lampu Tidur LED Sensor',
    description: 'Lampu tidur otomatis menyala saat gelap, isi ulang lewat USB-C.',
    weightGrams: 200,
    stock: 0,
    price: 89000,
  },
  {
    id: 'prd_06',
    name: 'Rak Sepatu Bambu 4 Susun',
    description: 'Rak sepatu dari bambu alami, muat 12 pasang sepatu, mudah dirakit.',
    weightGrams: 3500,
    stock: 15,
    price: 215000,
  },
];
