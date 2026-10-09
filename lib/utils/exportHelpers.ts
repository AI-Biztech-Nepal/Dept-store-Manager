// lib/utils/exportHelpers.ts
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Hands the finished file to the person: the share sheet on a phone, a
 * download in a browser. Web has no share sheet and expo-sharing is a
 * no-op there, so the two platforms genuinely need different endings. */
export async function deliver(base64: string, filename: string, mimeType: string) {
  if (Platform.OS === 'web') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0)));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : 'com.microsoft.excel.xlsx' });
  }
}

/** Prints a finished HTML document: the browser's print dialog on web, a PDF
 * handed to the share sheet on a phone. */
export async function printHtml(html: string) {
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (!win) throw new Error('Your browser blocked the window - allow pop-ups for this site and try again.');
    // Printing is triggered from inside the document: a handler attached
    // from here can miss a load that fires during document.close().
    win.document.write(`${html.replace('</body>', '<script>window.onload=function(){window.focus();window.print();};</script></body>')}`);
    win.document.close();
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }
}

