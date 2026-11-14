export type RegisteredContact = {
  telegram_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  phone: string | null;
};

export function contactLinks(contact: Pick<RegisteredContact, 'username' | 'phone'>) {
  const username = (contact.username || '').trim().replace(/^@/, '');
  const validUsername = /^[A-Za-z0-9_]{3,32}$/.test(username) ? username : null;
  const digits = (contact.phone || '').replace(/[\s()-]/g, '').replace(/^\+/, '');
  const phone = /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
  return {
    phone,
    username: validUsername,
    telegram: validUsername ? `https://t.me/${validUsername}` : phone ? `https://t.me/${phone}` : null,
  };
}
