import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

async function testServer() {
  console.log('Starting HTTP Server Test...');
  
  const serverPath = path.resolve('dist/server.cjs');
  if (!existsSync(serverPath)) {
    console.error('FAIL: Server bundle not found. Run npm run build first.');
    process.exit(1);
  }

  const PORT = 3001;
  const serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, PORT: PORT.toString() }
  });

  // Wait for server to start
  await new Promise((resolve) => {
    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('listening')) {
        resolve(true);
      }
    });
  });

  console.log('Server started, testing endpoints...');

  try {
    // 1. Test Health Check
    console.log('Testing /health...');
    const healthResponse = await fetch(`http://localhost:${PORT}/health`);
    if (healthResponse.ok) {
      console.log('PASS: /health');
    } else {
      throw new Error('/health failed');
    }

    // 2. Test Invoice Generation
    console.log('Testing /generate/invoice...');
    const invoiceXmlPath = 'assets/invoice.xml';
    if (!existsSync(invoiceXmlPath)) {
      console.log('SKIP: assets/invoice.xml not found');
    } else {
      const xmlBuffer = readFileSync(invoiceXmlPath);
      const formData = new FormData();
      formData.append('xml', new Blob([xmlBuffer]), 'invoice.xml');
      formData.append('nrKSeF', '1234567890');

      const invoiceResponse = await fetch(`http://localhost:${PORT}/generate/invoice`, {
        method: 'POST',
        body: formData
      });

      if (invoiceResponse.ok && invoiceResponse.headers.get('content-type') === 'application/pdf') {
        const pdfBuffer = await invoiceResponse.arrayBuffer();
        console.log(`PASS: /generate/invoice (${pdfBuffer.byteLength} bytes)`);
      } else {
        const errorText = await invoiceResponse.text();
        throw new Error(`/generate/invoice failed: ${invoiceResponse.status} ${errorText}`);
      }
    }

    // 3. Test UPO Generation
    console.log('Testing /generate/upo...');
    const upoXmlPath = 'assets/upo.xml';
    if (!existsSync(upoXmlPath)) {
      console.log('SKIP: assets/upo.xml not found');
    } else {
      const xmlBuffer = readFileSync(upoXmlPath);
      const formData = new FormData();
      formData.append('xml', new Blob([xmlBuffer]), 'upo.xml');

      const upoResponse = await fetch(`http://localhost:${PORT}/generate/upo`, {
        method: 'POST',
        body: formData
      });

      if (upoResponse.ok && upoResponse.headers.get('content-type') === 'application/pdf') {
        const pdfBuffer = await upoResponse.arrayBuffer();
        console.log(`PASS: /generate/upo (${pdfBuffer.byteLength} bytes)`);
      } else {
        const errorText = await upoResponse.text();
        throw new Error(`/generate/upo failed: ${upoResponse.status} ${errorText}`);
      }
    }

    console.log('ALL SERVER TESTS PASSED!');
  } catch (error) {
    console.error(`FAIL: Server Test - ${error.message}`);
    process.exitCode = 1;
  } finally {
    serverProcess.kill();
  }
}

testServer();
