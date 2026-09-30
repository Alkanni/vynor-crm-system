import type { ChannelProviderType } from '@vynor/contracts';

/**
 * What the connect dialog asks for per platform: the credential fields, where to find them
 * and the official guide. Keys are dot paths into the provider's credential contract
 * (`packages/contracts/src/channels/connection.ts`).
 */

export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'url' | 'email' | 'toggle' | 'textarea' | 'color';
  placeholder?: string;
  help?: string;
  optional?: boolean;
  /** Secrets are never sent back by the API, so they must be re-entered to update. */
  secret?: boolean;
  defaultValue?: string | boolean;
  /** Render next to the following field on wide screens. */
  half?: boolean;
}

export interface CredentialSection {
  title?: string;
  fields: CredentialField[];
}

export interface EmailPreset {
  label: string;
  values: Record<string, string | boolean>;
}

export interface ConnectForm {
  /** One plain sentence about what connecting does. */
  intro: string;
  /** Where to find each value, in the order the admin will need them. */
  steps: string[];
  docsUrl?: string;
  docsLabel?: string;
  sections: CredentialSection[];
  presets?: EmailPreset[];
}

const META_APP_SECRET: CredentialField = {
  key: 'appSecret',
  label: 'App secret',
  type: 'password',
  secret: true,
  placeholder: '32-character value',
  help: 'App settings → Basic in your Meta app. Used to verify that webhooks really come from Meta.',
};

function mailServer(prefix: 'imap' | 'smtp', port: number): CredentialField[] {
  const name = prefix.toUpperCase();
  return [
    {
      key: `${prefix}.host`,
      label: `${name} server`,
      type: 'text',
      placeholder: prefix === 'imap' ? 'imap.example.com' : 'smtp.example.com',
      half: true,
    },
    {
      key: `${prefix}.port`,
      label: 'Port',
      type: 'number',
      defaultValue: String(port),
      half: true,
    },
    {
      key: `${prefix}.secure`,
      label: 'Use SSL/TLS',
      type: 'toggle',
      defaultValue: true,
      help:
        prefix === 'imap'
          ? 'On for port 993. Off for 143 (STARTTLS).'
          : 'On for port 465. Off for 587 (STARTTLS).',
    },
    {
      key: `${prefix}.username`,
      label: 'Username',
      type: 'text',
      placeholder: 'Usually the email address',
      half: true,
    },
    {
      key: `${prefix}.password`,
      label: 'Password',
      type: 'password',
      secret: true,
      placeholder: 'App password',
      half: true,
    },
  ];
}

export const CONNECT_FORMS: Record<ChannelProviderType, ConnectForm> = {
  WHATSAPP_CLOUD: {
    intro: 'Connect a WhatsApp Business number through the official Meta WhatsApp Cloud API.',
    steps: [
      'In Meta for Developers, open your app → WhatsApp → API Setup and copy the Phone number ID and the WhatsApp Business Account ID.',
      'In Business Settings → System users, generate a permanent token with the whatsapp_business_messaging and whatsapp_business_management permissions.',
      'Copy the App secret from App settings → Basic.',
    ],
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    docsLabel: 'WhatsApp Cloud API guide',
    sections: [
      {
        fields: [
          {
            key: 'phoneNumberId',
            label: 'Phone number ID',
            type: 'text',
            placeholder: '106540352242922',
            half: true,
          },
          {
            key: 'businessAccountId',
            label: 'WhatsApp Business Account ID',
            type: 'text',
            placeholder: '102290129340398',
            half: true,
          },
          {
            key: 'accessToken',
            label: 'Permanent access token',
            type: 'password',
            secret: true,
            placeholder: 'EAAG…',
          },
          META_APP_SECRET,
        ],
      },
    ],
  },
  META_INSTAGRAM: {
    intro: 'Answer Instagram Direct messages from a professional (business or creator) account.',
    steps: [
      'Add "Instagram API with Instagram login" to your Meta app and add your Instagram professional account.',
      'Generate an access token for the account with instagram_business_basic and instagram_business_manage_messages.',
      'Copy the Instagram app secret from the same page.',
    ],
    docsUrl:
      'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login',
    docsLabel: 'Instagram messaging guide',
    sections: [
      {
        fields: [
          {
            key: 'accessToken',
            label: 'Instagram access token',
            type: 'password',
            secret: true,
            placeholder: 'IGAA…',
          },
          { ...META_APP_SECRET, label: 'Instagram app secret' },
        ],
      },
    ],
  },
  META_MESSENGER: {
    intro: 'Answer Messenger conversations with your Facebook Page.',
    steps: [
      'Add the Messenger product to your Meta app and connect your Facebook Page.',
      'Generate a Page access token with the pages_messaging permission and copy the Page ID.',
      'Copy the App secret from App settings → Basic.',
    ],
    docsUrl: 'https://developers.facebook.com/docs/messenger-platform/get-started',
    docsLabel: 'Messenger Platform guide',
    sections: [
      {
        fields: [
          { key: 'pageId', label: 'Page ID', type: 'text', placeholder: '112233445566' },
          {
            key: 'pageAccessToken',
            label: 'Page access token',
            type: 'password',
            secret: true,
            placeholder: 'EAA…',
          },
          META_APP_SECRET,
        ],
      },
    ],
  },
  TELEGRAM_BOT: {
    intro: 'Let customers chat with your Telegram bot.',
    steps: [
      'Open @BotFather in Telegram and send /newbot, or /token for an existing bot.',
      'Copy the token it sends you, for example 123456789:AAE…',
    ],
    docsUrl: 'https://core.telegram.org/bots/features#botfather',
    docsLabel: 'Telegram BotFather guide',
    sections: [
      {
        fields: [
          {
            key: 'botToken',
            label: 'Bot token',
            type: 'password',
            secret: true,
            placeholder: '123456789:AAE…',
          },
        ],
      },
    ],
  },
  LINE_MESSAGING: {
    intro: 'Chat with customers who add your LINE Official Account.',
    steps: [
      'In the LINE Developers console, open the Messaging API channel of your Official Account.',
      'Copy the Channel secret from Basic settings, then issue a long-lived Channel access token on the Messaging API tab.',
    ],
    docsUrl: 'https://developers.line.biz/en/docs/messaging-api/getting-started/',
    docsLabel: 'LINE Messaging API guide',
    sections: [
      {
        fields: [
          {
            key: 'channelAccessToken',
            label: 'Channel access token',
            type: 'password',
            secret: true,
          },
          {
            key: 'channelSecret',
            label: 'Channel secret',
            type: 'password',
            secret: true,
            placeholder: '32-character value',
          },
        ],
      },
    ],
  },
  WEBCHAT_EMBED: {
    intro:
      'Add a chat bubble to your website so visitors can reach your team without leaving the page.',
    steps: [
      'Connect, then paste the snippet from the next screen into your site, just before </body>.',
    ],
    sections: [
      {
        fields: [
          {
            key: 'websiteUrl',
            label: 'Website',
            type: 'url',
            optional: true,
            placeholder: 'https://www.example.com',
          },
          {
            key: 'welcomeMessage',
            label: 'Welcome message',
            type: 'textarea',
            optional: true,
            placeholder: 'Hi! How can we help you today?',
          },
          {
            key: 'accentColor',
            label: 'Widget colour',
            type: 'color',
            optional: true,
            defaultValue: '#1F93FF',
          },
        ],
      },
    ],
  },
  EMAIL_SMTP_IMAP: {
    intro: 'Connect a mailbox. VYNOR reads new mail over IMAP and sends your replies over SMTP.',
    steps: [
      'Make sure IMAP is enabled in the mailbox settings.',
      'For Gmail, Outlook and Yahoo, turn on 2-step verification and create an app password; your normal password will be rejected.',
      'Only mail that arrives after connecting is imported.',
    ],
    docsUrl: 'https://support.google.com/mail/answer/185833',
    docsLabel: 'Create a Gmail app password',
    presets: [
      {
        label: 'Gmail',
        values: {
          'imap.host': 'imap.gmail.com',
          'imap.port': '993',
          'imap.secure': true,
          'smtp.host': 'smtp.gmail.com',
          'smtp.port': '465',
          'smtp.secure': true,
        },
      },
      {
        label: 'Outlook / Microsoft 365',
        values: {
          'imap.host': 'outlook.office365.com',
          'imap.port': '993',
          'imap.secure': true,
          'smtp.host': 'smtp.office365.com',
          'smtp.port': '587',
          'smtp.secure': false,
        },
      },
      {
        label: 'Yahoo',
        values: {
          'imap.host': 'imap.mail.yahoo.com',
          'imap.port': '993',
          'imap.secure': true,
          'smtp.host': 'smtp.mail.yahoo.com',
          'smtp.port': '465',
          'smtp.secure': true,
        },
      },
      {
        label: 'Zoho Mail',
        values: {
          'imap.host': 'imap.zoho.com',
          'imap.port': '993',
          'imap.secure': true,
          'smtp.host': 'smtp.zoho.com',
          'smtp.port': '465',
          'smtp.secure': true,
        },
      },
    ],
    sections: [
      {
        fields: [
          {
            key: 'emailAddress',
            label: 'Email address',
            type: 'email',
            placeholder: 'support@example.com',
            half: true,
          },
          {
            key: 'senderName',
            label: 'Sender name',
            type: 'text',
            optional: true,
            placeholder: 'Defaults to the inbox name',
            half: true,
          },
        ],
      },
      { title: 'Incoming mail (IMAP)', fields: mailServer('imap', 993) },
      { title: 'Outgoing mail (SMTP)', fields: mailServer('smtp', 465) },
    ],
  },
  CUSTOM_WEBHOOK: {
    intro:
      'Connect your own system: it posts customer messages to VYNOR and receives agent replies.',
    steps: [
      'Enter the HTTPS endpoint where VYNOR should POST agent replies.',
      'After connecting, send customer messages to the webhook URL shown on the next screen, signed with the signing secret.',
    ],
    sections: [
      {
        fields: [
          {
            key: 'outboundUrl',
            label: 'Reply endpoint',
            type: 'url',
            placeholder: 'https://your-system.example.com/vynor/replies',
          },
        ],
      },
    ],
  },
};

export type FormValues = Record<string, string | boolean>;

function readPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[key];
    return undefined;
  }, source);
}

/** Starting values: field defaults, overlaid with the saved non-secret details when updating. */
export function initialFormValues(
  form: ConnectForm,
  details: Record<string, unknown> = {},
): FormValues {
  const values: FormValues = {};
  for (const field of form.sections.flatMap((s) => s.fields)) {
    const saved = field.secret ? undefined : readPath(details, field.key);
    if (typeof saved === 'boolean') values[field.key] = saved;
    else if (typeof saved === 'string' || typeof saved === 'number')
      values[field.key] = String(saved);
    else if (field.defaultValue !== undefined) values[field.key] = field.defaultValue;
    else values[field.key] = field.type === 'toggle' ? false : '';
  }
  return values;
}

/** Turns flat form values into the nested credential object the API expects. */
export function buildCredentials(form: ConnectForm, values: FormValues): Record<string, unknown> {
  const credentials: Record<string, unknown> = {};
  for (const field of form.sections.flatMap((s) => s.fields)) {
    const raw = values[field.key];
    let value: unknown = raw;
    if (field.type === 'toggle') value = raw === true;
    else if (field.type === 'number') value = raw === '' ? undefined : Number(raw);
    else if (typeof raw === 'string') value = raw.trim() === '' ? undefined : raw.trim();
    if (value === undefined) continue;

    const parts = field.key.split('.');
    let node = credentials;
    for (const part of parts.slice(0, -1)) {
      node[part] = (node[part] as Record<string, unknown> | undefined) ?? {};
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]!] = value;
  }
  return credentials;
}
