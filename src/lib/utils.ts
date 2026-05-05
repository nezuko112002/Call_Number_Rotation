export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function extractAreaCode(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.length >= 11 && digits.startsWith("1")) {
    return digits.slice(1, 4);
  }

  if (digits.length >= 10) {
    return digits.slice(0, 3);
  }

  return digits.slice(0, 3);
}

export function toFixedNum(value: number, places = 2): number {
  return Number(value.toFixed(places));
}

export function statusColorClass(value: "good" | "warn" | "bad"): string {
  if (value === "good") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (value === "warn") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-rose-100 text-rose-800";
}
