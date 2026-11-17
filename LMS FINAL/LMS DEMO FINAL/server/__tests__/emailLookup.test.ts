import { normalizeEmailAddress, findUserByEmail } from '../auth';

describe('normalizeEmailAddress', () => {
  test('lowercases and trims', () => {
    expect(normalizeEmailAddress('  Test@Example.COM  ')).toBe('test@example.com');
  });

  test('normalizes gmail dots and tags', () => {
    expect(normalizeEmailAddress('mahalakshmi197.jayakumar@gmail.com')).toBe(
      'mahalakshmi197jayakumar@gmail.com'
    );
    expect(normalizeEmailAddress('mahalakshmi197jayakumar@gmail.com')).toBe(
      'mahalakshmi197jayakumar@gmail.com'
    );
    expect(normalizeEmailAddress('user+tag@gmail.com')).toBe('user@gmail.com');
  });
});

describe('findUserByEmail', () => {
  const users = [{ email: 'mahalakshmi197.jayakumar@gmail.com', id: 'u1' }];

  test('finds user with gmail dot variant', () => {
    expect(findUserByEmail(users, 'mahalakshmi197jayakumar@gmail.com')?.id).toBe('u1');
  });

  test('finds user with exact email', () => {
    expect(findUserByEmail(users, 'mahalakshmi197.jayakumar@gmail.com')?.id).toBe('u1');
  });
});
