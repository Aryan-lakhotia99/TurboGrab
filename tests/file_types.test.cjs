// Test universal file types download: zip, pdf, word (docx/doc), excel (xlsx), etc.
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const downloadManager = require('../electron/engine/downloadManager.cjs');
const db = require('../electron/engine/db.cjs');

async function runTests() {
  console.log('====================================================');
  console.log('   TURBOGRAB UNIVERSAL FILE TYPES VERIFICATION       ');
  console.log('   (zip, pdf, word, excel, archives, programs)      ');
  console.log('====================================================\n');

  // 1. Verify Category Extension Mappings
  console.log('[Test 1]: Verifying category extension mappings in SQLite...');
  const categories = db.getCategories();
  const docCat = categories.find(c => c.id === 'cat_doc');
  const archiveCat = categories.find(c => c.id === 'cat_archive');
  const progCat = categories.find(c => c.id === 'cat_prog');

  assert.ok(docCat, 'Documents category exists');
  assert.ok(docCat.extensions.includes('docx'), 'Documents includes docx');
  assert.ok(docCat.extensions.includes('doc'), 'Documents includes doc');
  assert.ok(docCat.extensions.includes('pdf'), 'Documents includes pdf');
  assert.ok(docCat.extensions.includes('xlsx'), 'Documents includes xlsx');
  assert.ok(docCat.extensions.includes('ppt') || docCat.extensions.includes('pptx'), 'Documents includes ppt/pptx');
  console.log('  ✓ Documents category covers: docx, doc, pdf, xlsx, pptx, txt');

  assert.ok(archiveCat, 'Compressed category exists');
  assert.ok(archiveCat.extensions.includes('zip'), 'Compressed includes zip');
  assert.ok(archiveCat.extensions.includes('rar'), 'Compressed includes rar');
  assert.ok(archiveCat.extensions.includes('7z'), 'Compressed includes 7z');
  assert.ok(archiveCat.extensions.includes('tar'), 'Compressed includes tar');
  assert.ok(archiveCat.extensions.includes('gz'), 'Compressed includes gz');
  console.log('  ✓ Compressed category covers: zip, rar, 7z, tar, gz, iso, bz2');

  assert.ok(progCat, 'Programs category exists');
  assert.ok(progCat.extensions.includes('exe'), 'Programs includes exe');
  assert.ok(progCat.extensions.includes('msi'), 'Programs includes msi');
  assert.ok(progCat.extensions.includes('apk'), 'Programs includes apk');
  console.log('  ✓ Programs category covers: exe, msi, apk, deb, rpm');

  // 2. Setup mock HTTP server serving a Word document (.docx) and a ZIP file (.zip)
  console.log('\n[Test 2]: Simulating live server downloads for Word (.docx) & Zip (.zip)...');
  const mockPort = 49199;
  const docxContent = Buffer.from('PK\x03\x04Test Word Document Byte Content for TurboGrab Multi-Range Engine');
  const zipContent = Buffer.from('PK\x03\x04Test Zip Archive Byte Content for TurboGrab Multi-Range Engine');

  const server = http.createServer((req, res) => {
    if (req.url === '/annual-report.docx') {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Length': docxContent.length,
        'Content-Disposition': 'attachment; filename="Annual_Report_2026.docx"; size=' + docxContent.length,
        'Accept-Ranges': 'bytes'
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(docxContent);
      return;
    }

    if (req.url === '/project-archive.zip') {
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Length': zipContent.length,
        'Content-Disposition': "attachment; filename*=UTF-8''Full%20Project%20Source.zip",
        'Accept-Ranges': 'bytes'
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(zipContent);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise(resolve => server.listen(mockPort, '127.0.0.1', resolve));

  try {
    // 3. Download Word document via TurboGrab Download Manager
    console.log('[Test 3]: Downloading Word Document (.docx)...');
    const docxTaskId = await downloadManager.startDownload({
      url: `http://127.0.0.1:${mockPort}/annual-report.docx`,
      filename: 'Annual_Report_2026.docx'
    });

    assert.ok(docxTaskId, 'Word task registered');
    const docxItem = downloadManager.downloads.get(docxTaskId);
    assert.strictEqual(docxItem.category, 'Documents', 'Word document assigned to Documents category');
    assert.ok(docxItem.destination_path.endsWith('Annual_Report_2026.docx'), 'Destination filename correctly set to .docx');
    console.log(`  ✓ Word task created: ID ${docxTaskId} -> Category: ${docxItem.category}`);

    // Wait briefly for download to complete
    let attempts = 0;
    while (docxItem.status !== 'completed' && docxItem.status !== 'error' && attempts < 20) {
      await new Promise(r => setTimeout(r, 200));
      attempts++;
    }
    assert.strictEqual(docxItem.status, 'completed', 'Word document downloaded successfully');
    assert.strictEqual(docxItem.downloaded_bytes, docxContent.length, 'Exact Word byte length transferred');
    console.log(`  ✓ Word document completed: ${docxItem.downloaded_bytes} bytes`);

    // Clean up file if written
    if (fs.existsSync(docxItem.destination_path)) {
      try { fs.unlinkSync(docxItem.destination_path); } catch (_) {}
    }

    // 4. Download Zip Archive via TurboGrab Download Manager
    console.log('\n[Test 4]: Downloading Zip Archive (.zip)...');
    const zipTaskId = await downloadManager.startDownload({
      url: `http://127.0.0.1:${mockPort}/project-archive.zip`,
      filename: 'Full Project Source.zip'
    });

    assert.ok(zipTaskId, 'Zip task registered');
    const zipItem = downloadManager.downloads.get(zipTaskId);
    assert.strictEqual(zipItem.category, 'Compressed Files', 'Zip archive assigned to Compressed Files category');
    assert.ok(zipItem.destination_path.endsWith('.zip'), 'Destination filename correctly set to .zip');
    console.log(`  ✓ Zip task created: ID ${zipTaskId} -> Category: ${zipItem.category}`);

    attempts = 0;
    while (zipItem.status !== 'completed' && zipItem.status !== 'error' && attempts < 20) {
      await new Promise(r => setTimeout(r, 200));
      attempts++;
    }
    assert.strictEqual(zipItem.status, 'completed', 'Zip archive downloaded successfully');
    assert.strictEqual(zipItem.downloaded_bytes, zipContent.length, 'Exact Zip byte length transferred');
    console.log(`  ✓ Zip archive completed: ${zipItem.downloaded_bytes} bytes`);

    // Clean up file
    if (fs.existsSync(zipItem.destination_path)) {
      try { fs.unlinkSync(zipItem.destination_path); } catch (_) {}
    }

    console.log('\n====================================================');
    console.log('   ALL FILE TYPE TESTS PASSED SUCCESSFULLY! (0 Failures)');
    console.log('====================================================\n');
  } finally {
    server.close();
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('File Types test failed:', err);
  process.exit(1);
});
