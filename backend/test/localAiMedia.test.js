import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { describeCropImage, extractDocumentText } from "../src/services/localAiMedia.js";

function createTextPdf(text) {
  const stream = `BT /F1 12 Tf 30 100 Td (${text}) Tj ET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test("extracts text from local text and PDF attachments", async () => {
  const text = await extractDocumentText({
    mimetype: "text/plain",
    buffer: Buffer.from("Tomato leaves have yellow spots.")
  });
  assert.equal(text.text, "Tomato leaves have yellow spots.");
  assert.equal(text.truncated, false);

  const pdf = await extractDocumentText({
    mimetype: "application/pdf",
    buffer: createTextPdf("Tomato soil report")
  });
  assert.match(pdf.text, /Tomato soil report/);
  assert.equal(pdf.truncated, false);
});

test("extracts text from a local DOCX attachment", async () => {
  const archive = new JSZip();
  archive.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`);
  archive.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`);
  archive.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Tomato &amp; soil report</w:t></w:r></w:p>
        <w:p><w:r><w:t>Measured pH 6.2</w:t></w:r></w:p>
      </w:body>
    </w:document>`);
  const buffer = await archive.generateAsync({ type: "nodebuffer" });
  const document = await extractDocumentText({
    mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer
  });

  assert.match(document.text, /Tomato & soil report/);
  assert.match(document.text, /Tomato & soil report\nMeasured pH 6.2/);
  assert.equal(document.truncated, false);
});

test("limits extracted attachment text to 20,000 characters", async () => {
  const result = await extractDocumentText({
    mimetype: "text/plain",
    buffer: Buffer.from("x".repeat(20001))
  });
  assert.equal(result.text.length, 20000);
  assert.equal(result.truncated, true);
});

test("sends crop images to the configured vision model and returns visible evidence", async () => {
  let request;
  const description = await describeCropImage({
    baseUrl: "http://localhost:11434/v1",
    fetcher: async (url, options) => {
      request = { url, ...options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({ message: { content: "Visible yellowing is present on several leaves." } })
      };
    },
    model: "vision-test",
    image: { mimetype: "image/png", buffer: Buffer.from("image-bytes") },
    question: "What do you see?",
    cropName: "Tomato"
  });

  assert.match(description, /^Visible yellowing is present on several leaves\./);
  assert.match(description, /cannot confirm disease or measure soil pH or nutrients/i);
  assert.equal(request.url, "http://localhost:11434/api/chat");
  assert.equal(request.body.model, "vision-test");
  assert.equal(request.body.messages[1].images[0], Buffer.from("image-bytes").toString("base64"));
});

test("reports empty vision responses as errors", async () => {
  await assert.rejects(
    describeCropImage({
      fetcher: async () => ({ ok: true, json: async () => ({ message: { content: "" } }) }),
      model: "vision-test",
      image: { mimetype: "image/jpeg", buffer: Buffer.from("image-bytes") },
      question: "",
      cropName: "Tomato"
    }),
    /empty image analysis/
  );
});

test("reports Ollama vision request failures clearly", async () => {
  await assert.rejects(
    describeCropImage({
      fetcher: async () => ({ ok: false, status: 400, text: async () => "vision model unavailable" }),
      model: "vision-test",
      image: { mimetype: "image/jpeg", buffer: Buffer.from("image-bytes") },
      question: "",
      cropName: "Tomato"
    }),
    /local vision model returned status 400: vision model unavailable/
  );
});
