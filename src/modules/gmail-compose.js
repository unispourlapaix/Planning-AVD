// Keep the calendar out of the URL: monthly schedules can exceed URL limits.
export function gmailComposeUrl(email, subject) {
  const address = String(email || "").trim();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address) || address.length > 254) throw new Error("Email invalide.");
  const url = new URL("https://mail.google.com/mail/");
  for (const [key, value] of Object.entries({ view: "cm", fs: "1", to: address, su: String(subject || "").slice(0, 160) })) url.searchParams.set(key, value);
  return url.href;
}
