export default function formatDate(date: string | number | Date): string {
  const d = new Date(date);

  const hours = d.getHours() % 12 || 12;
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = d.getHours() >= 12 ? "PM" : "AM";

  const weekday = d.toLocaleString("en-US", { weekday: "long" });
  const month = d.toLocaleString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  return `${hours}:${minutes} ${ampm} ${weekday} ${month} ${day}${ordinal(day)}, ${year}`;
}
