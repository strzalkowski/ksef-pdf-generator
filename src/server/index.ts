import express from 'express';
import multer from 'multer';
import { generatePdf } from '../core/pdf-generator';
import type { GenerateOptions } from '../core/types';
import { log, logError } from '../cli/logger';

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

app.use(express.json());

// Common generation handler
async function handleGenerate(req: express.Request, res: express.Response, type: 'invoice' | 'upo') {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const xmlFile = files?.xml?.[0] || (req.file?.fieldname === 'xml' ? req.file : null);
    
    if (!xmlFile) {
      return res.status(400).json({ error: 'Missing XML file (use "xml" field name)' });
    }

    const xmlContent = xmlFile.buffer.toString('utf-8');
    const mergePdfFile = files?.mergePdf?.[0];

    const options: GenerateOptions = {
      type,
      xmlContent,
      xmlFileName: xmlFile.originalname,
      nrKSeF: req.body.nrKSeF,
      qrCode1: req.body.qrCode1,
      qrCode2: req.body.qrCode2,
      simplifiedMode: req.body.simplified === 'true' || req.body.simplified === true,
      mergePdfBuffer: mergePdfFile?.buffer
    };

    log(`HTTP Request: Generating ${type} for ${xmlFile.originalname}`, 'info');
    const pdfBuffer = await generatePdf(options);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${xmlFile.originalname.replace('.xml', '.pdf')}"`);
    res.send(pdfBuffer);
    
    log(`HTTP Response: ${type} generated successfully`, 'info');
  } catch (error) {
    logError('HTTP Error generating PDF', error);
    res.status(500).json({ 
      error: 'Error generating PDF', 
      message: error instanceof Error ? error.message : String(error) 
    });
  }
}

// Routes

app.post('/generate/invoice', upload.fields([{ name: 'xml', maxCount: 1 }, { name: 'mergePdf', maxCount: 1 }]), (req, res) => {
  handleGenerate(req, res, 'invoice');
});

app.post('/generate/upo', upload.single('xml'), (req, res) => {
  handleGenerate(req, res, 'upo');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: process.env.npm_package_version });
});

app.listen(port, () => {
  console.log(`KSeF PDF Generator Server listening at http://localhost:${port}`);
  log(`Server started on port ${port}`, 'info');
});
