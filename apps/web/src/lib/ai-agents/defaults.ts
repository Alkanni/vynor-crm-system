import type { AiAgent, AiAgentGeneralSettings, AiAgentKnowledge } from '@vynor/contracts';
import { PRODUCT_CATALOG } from './options';

/** `crypto.randomUUID` needs a secure context, so fall back on plain http. */
export function createId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}_${random}`;
}

export function defaultGeneralSettings(): AiAgentGeneralSettings {
  return {
    behavior: '',
    welcomeMessage: '',
    welcomeImage: null,
    // One line per language the team serves; the preview matches each line's keywords.
    transferConditions: [
      'Customer asks to talk to a human agent or admin.',
      'Customer minta bicara dengan admin atau CS manusia.',
    ].join('\n'),
    stopAfterHandoff: true,
    silentHandoff: false,
    pendingAssignedMessage: '',
    pendingUnassignedMessage: '',
    allowedLabels: [],
    labelConditions: '',
    allowedPipelineStatuses: [],
    pipelineConditions: '',
    model: 'STANDARD',
    historyLimit: 30,
    readFileLimit: 3,
    contextLimit: 40,
    temperature: 'BALANCED',
    messageAwaitSeconds: 10,
    messageLimit: 10,
    watcherEnabled: false,
    timezone: 'Asia/Jakarta',
    sessionOnlyMemory: false,
  };
}

export function emptyKnowledge(): AiAgentKnowledge {
  return {
    texts: [{ id: createId('txt'), title: 'Default', content: '' }],
    links: [],
    files: [],
    qna: [],
    products: [],
  };
}

export function newAgentRecord(name: string, now = new Date()): AiAgent {
  const timestamp = now.toISOString();
  return {
    id: createId('ai'),
    name: name.trim(),
    status: 'ACTIVE',
    general: defaultGeneralSettings(),
    knowledge: emptyKnowledge(),
    lastTrainedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const SUPPORT_TEXT = [
  '<div><b>TENTANG TOKO VYNOR</b></div>',
  '<div>Toko VYNOR menjual perlengkapan rumah dan gaya hidup secara online sejak 2019.</div>',
  '<div><br></div>',
  '<div>###Jam Operasional</div>',
  '<div>Senin sampai Sabtu pukul 08.00–21.00 WIB. Minggu dan hari libur nasional tutup.</div>',
  '<div><br></div>',
  '<div>###Alamat Gudang</div>',
  '<div>Jl. Gatot Subroto No. 12, Jakarta Selatan. Pengambilan langsung bisa di jam operasional.</div>',
  '<div><br></div>',
  '<div>###Pengiriman</div>',
  '<div>Pesanan yang dibayar sebelum pukul 15.00 WIB dikirim di hari yang sama. Estimasi pengiriman 1–3 hari kerja untuk Jabodetabek dan 2–5 hari kerja untuk luar Jawa.</div>',
  '<div><br></div>',
  '<div>###Pembayaran</div>',
  '<div>Pembayaran bisa lewat transfer bank BCA, Mandiri, BNI, QRIS, atau kartu kredit. Nomor rekening BCA 123-456-7890 a.n. PT Vynor Niaga Indonesia.</div>',
].join('');

/** Demo agents so the page is useful on first visit. Ids match the Channels mock data. */
export function seedAgents(now = new Date()): AiAgent[] {
  const timestamp = now.toISOString();
  return [
    {
      id: 'ai_support',
      name: 'VYNOR Support AI',
      status: 'ACTIVE',
      general: {
        ...defaultGeneralSettings(),
        behavior: [
          'Kamu adalah Vina, customer service Toko VYNOR yang menjual perlengkapan rumah secara online.',
          'Gaya bicaramu singkat, ramah, non-formal, dan boleh memakai emoji. Panggil customer dengan sebutan "kak".',
          'Jawab hanya berdasarkan knowledge sources. Jika tidak tahu, katakan dengan jujur dan tawarkan bantuan tim CS.',
          'PENTING! Jangan memberikan daftar harga seluruh produk sekaligus.',
        ].join('\n'),
        welcomeMessage:
          'Halo kak 👋 aku Vina, asisten virtual Toko VYNOR. Aku bisa bantu info produk, pengiriman, dan pembayaran. Ada yang bisa aku bantu?',
        transferConditions: [
          'Customer meminta berbicara dengan admin atau CS manusia.',
          'Customer komplain barang rusak atau salah kirim.',
        ].join('\n'),
        pendingUnassignedMessage:
          'Pesan kakak sudah kami terima. Tim CS kami akan segera membalas ya 🙏',
        pendingAssignedMessage:
          'CS kami sedang meninjau percakapan ini. Mohon ditunggu sebentar ya.',
        allowedLabels: ['Purchased', 'Complaint'],
        labelConditions: [
          'Label Purchased ketika customer mengirim bukti transfer.',
          'Label Complaint ketika customer komplain barang rusak.',
        ].join('\n'),
        allowedPipelineStatuses: ['Hot Leads', 'Payment'],
        pipelineConditions: [
          'Pindahkan ke Hot Leads ketika customer menanyakan harga atau stok produk.',
          'Pindahkan ke Payment ketika customer menanyakan nomor rekening pembayaran.',
        ].join('\n'),
        model: 'STANDARD_PLUS',
        messageAwaitSeconds: 3,
      },
      knowledge: {
        texts: [{ id: 'txt_support_default', title: 'Default', content: SUPPORT_TEXT }],
        links: [],
        files: [],
        qna: [
          {
            id: 'qna_support_01',
            question: 'Bagaimana cara retur barang?',
            answer:
              'Retur bisa diajukan maksimal 7 hari setelah barang diterima. Kirim foto barang dan nomor pesanan ke WhatsApp kami, lalu tim akan mengirimkan label retur.',
          },
          {
            id: 'qna_support_02',
            question: 'Apakah bisa bayar di tempat (COD)?',
            answer:
              'Saat ini kami belum melayani COD. Pembayaran bisa lewat transfer bank, QRIS, atau kartu kredit.',
          },
          {
            id: 'qna_support_03',
            question: 'Berapa ongkos kirim?',
            answer:
              'Ongkos kirim dihitung otomatis saat checkout sesuai berat dan alamat. Gratis ongkir untuk belanja di atas Rp300.000 di Jabodetabek.',
          },
        ],
        products: PRODUCT_CATALOG.slice(0, 3),
      },
      lastTrainedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'ai_sales',
      name: 'VYNOR Sales AI',
      status: 'ACTIVE',
      general: {
        ...defaultGeneralSettings(),
        behavior:
          'Kamu adalah asisten penjualan Toko VYNOR. Bantu customer memilih produk yang cocok dan arahkan ke pembelian.',
        welcomeMessage: 'Hai kak! Lagi cari perlengkapan rumah apa hari ini? 😊',
        temperature: 'CREATIVE',
        messageAwaitSeconds: 3,
      },
      knowledge: {
        ...emptyKnowledge(),
        products: PRODUCT_CATALOG,
      },
      lastTrainedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}
