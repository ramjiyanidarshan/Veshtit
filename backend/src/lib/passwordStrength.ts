export interface StrengthResult {
  score: number;          // 0–100
  label: "Very Weak" | "Weak" | "Moderate" | "Strong" | "Very Strong";
  tips: string[];
}

const COMMON_PATTERNS = [
  "password", "123456", "qwerty", "abc123", "letmein", "admin",
  "welcome", "monkey", "dragon", "master", "login", "pass",
];

export function analyseStrength(pwd: string): StrengthResult {
  const tips: string[] = [];
  let score = 0;

  // Length
  if (pwd.length >= 20) score += 35;
  else if (pwd.length >= 16) score += 28;
  else if (pwd.length >= 12) score += 20;
  else if (pwd.length >= 8) score += 10;
  else { score += 2; tips.push("Use at least 8 characters"); }

  // Character variety
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pwd);

  if (hasLower) score += 8;
  if (hasUpper) score += 12; else tips.push("Add uppercase letters");
  if (hasDigit) score += 12; else tips.push("Add numbers");
  if (hasSymbol) score += 18; else tips.push("Add special characters (!, @, #…)");

  // Bonus: all 4 character types
  if (hasLower && hasUpper && hasDigit && hasSymbol) score += 10;

  // Unique character ratio
  const uniqueRatio = new Set(pwd).size / pwd.length;
  if (uniqueRatio > 0.7) score += 5;

  // Penalties
  if (/(.)\1{2,}/.test(pwd)) { score -= 8; tips.push("Avoid repeated characters (aaa, 111)"); }
  if (/^[0-9]+$/.test(pwd)) { score -= 15; tips.push("Don't use numbers only"); }
  if (/^[a-zA-Z]+$/.test(pwd)) { score -= 8; tips.push("Mix in numbers & symbols"); }
  if (pwd.length < 6) { score -= 10; }

  const low = pwd.toLowerCase();
  for (const p of COMMON_PATTERNS) {
    if (low.includes(p)) { score -= 20; tips.push("Avoid common words (password, admin…)"); break; }
  }
  // Sequential keyboard patterns
  if (/qwer|asdf|zxcv|1234|4321/.test(low)) { score -= 10; tips.push("Avoid keyboard sequences"); }

  score = Math.max(0, Math.min(100, score));

  let label: StrengthResult["label"];
  if (score >= 80) label = "Very Strong";
  else if (score >= 60) label = "Strong";
  else if (score >= 40) label = "Moderate";
  else if (score >= 20) label = "Weak";
  else label = "Very Weak";

  return { score, label, tips: [...new Set(tips)] };
}
