import { timingSafeEqual } from "node:crypto";

export function verifyPassword(input: string): boolean {
  const expected = process.env.AUTH_PASSWORD;
  if (!expected) return false;

  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  if (inputBuffer.length !== expectedBuffer.length) {
    // タイミング攻撃対策として、長さが違う場合もexpectedと同じ長さの比較を行う
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }
  return timingSafeEqual(inputBuffer, expectedBuffer);
}
