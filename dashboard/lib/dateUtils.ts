type DateInput = string | number | Date;

const wibFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const wibShortFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const normalize = (value: string) => value.replace(/\./g, ":");

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

export const formatWIB = (value: DateInput): string => {
  return `${normalize(wibFormatter.format(toDate(value)))} WIB`;
};

export const formatWIBShort = (value: DateInput): string => {
  return `${normalize(wibShortFormatter.format(toDate(value)))} WIB`;
};
