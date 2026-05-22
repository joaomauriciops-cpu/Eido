import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import OpenAI, { toFile } from 'openai';

admin.initializeApp();

const openaiApiKey = defineSecret('OPENAI_API_KEY');

export const transcribeCaptureDev = onCall(
  {
    secrets: [openaiApiKey],
    region: 'southamerica-east1',
  },
  async (request) => {
    const captureId = request.data?.captureId;

    if (!captureId) {
      throw new HttpsError('invalid-argument', 'captureId é obrigatório.');
    }

    const db = admin.firestore();

    const captureRef = db.collection('captures').doc(captureId);
    const captureSnap = await captureRef.get();

    if (!captureSnap.exists) {
      throw new HttpsError('not-found', 'Capture não encontrada.');
    }

    const capture = captureSnap.data();
    const audioUrl = capture?.audioUrl;

    if (!audioUrl) {
      throw new HttpsError('failed-precondition', 'Capture não possui audioUrl.');
    }

    await captureRef.update({
      status: 'transcribing',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const audioResponse = await fetch(audioUrl);

    if (!audioResponse.ok) {
      throw new HttpsError('internal', 'Não foi possível baixar o áudio.');
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    const openai = new OpenAI({
      apiKey: openaiApiKey.value(),
    });

    const audioFile = await toFile(audioBuffer, 'capture.m4a', {
      type: 'audio/m4a',
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'pt',
    });

    const transcript = transcription.text;

    await captureRef.update({
      transcript,
      status: 'transcribed',
      transcribedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      captureId,
      transcript,
    };
  }
);

export const extractCaptureDev = onCall(
  {
    secrets: [openaiApiKey],
    region: 'southamerica-east1',
  },
  async (request) => {
    const captureId = request.data?.captureId;

    if (!captureId) {
      throw new HttpsError('invalid-argument', 'captureId é obrigatório.');
    }

    const db = admin.firestore();

    const captureRef = db.collection('captures').doc(captureId);
    const captureSnap = await captureRef.get();

    if (!captureSnap.exists) {
      throw new HttpsError('not-found', 'Capture não encontrada.');
    }

    const capture = captureSnap.data();
    const transcript = capture?.transcript;

    if (!transcript) {
      throw new HttpsError(
        'failed-precondition',
        'Capture ainda não possui transcript.'
      );
    }

    await captureRef.update({
      status: 'extracting',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const openai = new OpenAI({
      apiKey: openaiApiKey.value(),
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: {
        type: 'json_object',
      },
      messages: [
        {
          role: 'system',
          content: `
Você é o motor de extração estruturada do Eido.

O Eido transforma capturas de áudio em continuidade cognitiva executável.

Extraia apenas o que estiver claramente presente no transcript.
Não invente prazos, datas, eventos ou tarefas.
Se algo for incerto, use confidence baixo.
Se não houver itens em uma categoria, retorne array vazio.

Responda somente JSON válido neste formato:

{
  "summary": "resumo curto e claro",
  "tasks": [
    {
      "title": "string",
      "description": "string ou null",
      "dueDate": "ISO string ou null",
      "confidence": 0.0
    }
  ],
  "events": [
    {
      "title": "string",
      "startTime": "ISO string ou null",
      "endTime": "ISO string ou null",
      "confidence": 0.0
    }
  ],
  "ideas": [
    {
      "title": "string",
      "content": "string"
    }
  ],
  "notes": [
    "string"
  ]
}
          `.trim(),
        },
        {
          role: 'user',
          content: transcript,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;

    if (!raw) {
      throw new HttpsError('internal', 'GPT não retornou conteúdo.');
    }

    let extraction;

    try {
      extraction = JSON.parse(raw);
    } catch {
      throw new HttpsError('internal', 'GPT retornou JSON inválido.');
    }

    await captureRef.update({
      summary: extraction.summary ?? '',
      extraction,
      status: 'extracted',
      extractedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      captureId,
      extraction,
    };
  }
);