/** Dagens datum som "2026-10-06", för filnamn. */
export const todayIsoDate = () => new Date().toISOString().slice(0, 10);

/** Låter webbläsaren ladda ner `content` som en fil. */
export function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Frigör URL:en först efter att nedladdningen hunnit starta.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
