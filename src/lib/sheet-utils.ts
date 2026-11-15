/**
 * Extracts a Google Spreadsheet ID from either a full Google Sheets URL or a raw ID.
 */
export function parseSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  return trimmed;
}
