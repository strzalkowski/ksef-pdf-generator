import { PDFDocument } from 'pdf-lib';
import { initializeApp } from './init-env';
import type { GeneratorFunctions, GenerateOptions } from './types';

let generators: GeneratorFunctions | null = null;

export async function getGenerators(): Promise<GeneratorFunctions> {
  if (!generators) {
    generators = await initializeApp();
  }
  return generators;
}

export async function generatePdf(options: GenerateOptions): Promise<Buffer> {
  const { type, xmlContent, xmlFileName = 'input.xml' } = options;
  const gens = await getGenerators();

  // Create a File-like object for the generator
  const xmlBlob = new Blob([xmlContent], { type: 'text/xml' });
  const file = new File([xmlBlob], xmlFileName, { type: 'text/xml' });

  let pdfBlob: Blob;

  if (type === 'invoice') {
    const additionalData: any = {};
    if (options.nrKSeF) additionalData.nrKSeF = options.nrKSeF;
    if (options.qrCode1) additionalData.qrCode1 = options.qrCode1;
    if (options.qrCode2) additionalData.qrCode2 = options.qrCode2;
    if (options.simplifiedMode) additionalData.simplifiedMode = true;

    pdfBlob = await gens.generateInvoice(file, additionalData, 'blob');
  } else {
    pdfBlob = await gens.generatePDFUPO(file);
  }

  let buffer = await convertBlobToBuffer(pdfBlob);

  if (options.mergePdfBuffer) {
    buffer = await mergePdfBuffers(options.mergePdfBuffer, buffer);
  }

  return buffer;
}

export async function mergePdfBuffers(first: Buffer, second: Buffer): Promise<Buffer> {
  const mergedPdf = await PDFDocument.create();
  const [firstDoc, secondDoc] = await Promise.all([
    PDFDocument.load(first),
    PDFDocument.load(second)
  ]);

  const firstPages = await mergedPdf.copyPages(firstDoc, firstDoc.getPageIndices());
  for (const page of firstPages) {
    mergedPdf.addPage(page);
  }

  const secondPages = await mergedPdf.copyPages(secondDoc, secondDoc.getPageIndices());
  for (const page of secondPages) {
    mergedPdf.addPage(page);
  }

  const mergedBytes = await mergedPdf.save();
  return Buffer.from(mergedBytes);
}

export async function convertBlobToBuffer(pdfBlob: any): Promise<Buffer> {
  if (Buffer.isBuffer(pdfBlob)) {
    return pdfBlob;
  } else if (pdfBlob instanceof Uint8Array) {
    return Buffer.from(pdfBlob);
  } else if (typeof pdfBlob === 'string') {
    return Buffer.from(pdfBlob, 'binary');
  } else if (pdfBlob && typeof pdfBlob === 'object') {
    if (pdfBlob.arrayBuffer && typeof pdfBlob.arrayBuffer === 'function') {
      const arrayBuffer = await pdfBlob.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  }
  
  // Fallback for jsdom Blob if arrayBuffer is not available
  return new Promise((resolve, reject) => {
    const reader = new (global as any).FileReader();
    reader.onload = () => {
      resolve(Buffer.from(reader.result));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(pdfBlob);
  });
}
