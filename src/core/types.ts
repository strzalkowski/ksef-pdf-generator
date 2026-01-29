export interface GeneratorFunctions {
  generateInvoice: any;
  generatePDFUPO: any;
}

export interface GenerateOptions {
  type: 'invoice' | 'upo';
  xmlContent: string;
  xmlFileName?: string;
  nrKSeF?: string;
  qrCode1?: string;
  qrCode2?: string;
  simplifiedMode?: boolean;
  mergePdfBuffer?: Buffer;
}
