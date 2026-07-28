import type { Contact } from "@/lib/crisis";

export function CrisisCard({ text, contacts }: { text: string; contacts: Contact[] }) {
  return (
    <div className="crisis-card">
      <div className="ct">{text}</div>
      <div className="cbtns">
        {contacts.map((c) => (
          <a key={c.phone} href={`tel:${c.phone}`}>
            <b>{c.label}</b> <small>{c.note}</small>
          </a>
        ))}
      </div>
    </div>
  );
}
