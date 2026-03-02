declare module "pdf-parse" {
  export interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
    text: string;
  }

  export interface PdfParseOptions {
    pagerender?: (pageData: any) => Promise<string>;
    max?: number;
    version?: string;
  }

  // pdf-parse accepts Buffer/Uint8Array/ArrayBuffer-ish; we keep it broad.
  export default function pdfParse(
    data: any,
    options?: PdfParseOptions
  ): Promise<PdfParseResult>;
}
