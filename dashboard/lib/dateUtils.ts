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

export const formatRelativeTime = (value: DateInput): string => {
  const date = toDate(value);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "baru saja";
  }

  const minutes = Math.floor(diffInSeconds / 60);
  if (minutes < 60) {
    return `${minutes} menit yang lalu`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} jam yang lalu`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return "kemarin";
  }
  if (days < 7) {
    return `${days} hari lalu`;
  }

  return formatWIBShort(value);
};
