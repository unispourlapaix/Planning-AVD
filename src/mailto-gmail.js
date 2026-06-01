const nativeClick = HTMLAnchorElement.prototype.click;

HTMLAnchorElement.prototype.click = function openEmailInGmail() {
  const href = this.getAttribute("href") || "";
  if (!href.startsWith("mailto:")) return nativeClick.call(this);

  const query = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  const source = new URLSearchParams(query);
  const gmail = new URL("https://mail.google.com/mail/");
  gmail.searchParams.set("view", "cm");
  gmail.searchParams.set("fs", "1");
  if (source.get("to")) gmail.searchParams.set("to", source.get("to"));
  if (source.get("bcc")) gmail.searchParams.set("bcc", source.get("bcc"));
  if (source.get("subject")) gmail.searchParams.set("su", source.get("subject"));
  if (source.get("body")) gmail.searchParams.set("body", source.get("body"));
  window.location.href = gmail.toString();
};
