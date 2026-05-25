import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";

import { Audio } from "expo-av";

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { httpsCallable } from "firebase/functions";

import { auth, db, storage, functions } from "../lib/firebase";

type ExtractedTask = {
  title?: string;
  description?: string;
  due_date?: string | null;
  confidence?: number;
};

type ExtractedEvent = {
  title?: string;
  start_time?: string | null;
  end_time?: string | null;
  confidence?: number;
};

type ExtractedIdea = {
  title?: string;
  content?: string;
};

type ExtractionResult = {
  summary?: string;
  tasks?: ExtractedTask[];
  events?: ExtractedEvent[];
  ideas?: ExtractedIdea[];
  notes?: string[];
};

export default function CaptureScreen() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [transcript, setTranscript] = useState("");

  const [captureId, setCaptureId] = useState<string | null>(null);

  const [extraction, setExtraction] =
    useState<ExtractionResult | null>(null);

  const [saved, setSaved] = useState(false);

  async function startRecording() {
    try {
      setSaved(false);
      setTranscript("");
      setExtraction(null);
      setCaptureId(null);

      const permission = await Audio.requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permissão necessária",
          "O Eido precisa acessar o microfone."
        );

        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
    } catch (error) {
      console.error(error);

      Alert.alert("Erro", "Não foi possível iniciar a gravação.");
    }
  }

  async function stopRecording() {
    try {
      if (!recording) return;

      setLoading(true);

      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();

      setRecording(null);

      if (!uri) {
        Alert.alert("Erro", "Áudio não encontrado.");

        setLoading(false);

        return;
      }

      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Erro", "Usuário não autenticado.");

        setLoading(false);

        return;
      }

      const response = await fetch(uri);

      const blob = await response.blob();

      const fileName = `${Date.now()}.m4a`;

      const storageRef = ref(
        storage,
        `captures/${user.uid}/${fileName}`
      );

      await uploadBytes(storageRef, blob);

      const audioUrl = await getDownloadURL(storageRef);

      const captureRef = await addDoc(collection(db, "captures"), {
        user_id: user.uid,

        audioUrl: audioUrl,

        audio_url: audioUrl,

        transcript: "",

        summary: "",

        status: "uploaded",

        created_at: serverTimestamp(),
      });

      setCaptureId(captureRef.id);

      const transcribeCaptureDev = httpsCallable(
        functions,
        "transcribeCaptureDev"
      );

      const transcriptionResult: any =
        await transcribeCaptureDev({
          captureId: captureRef.id,
        });

      const transcriptText =
        transcriptionResult?.data?.transcript ||
        transcriptionResult?.data?.text ||
        "";

      setTranscript(transcriptText);

      const extractCaptureDev = httpsCallable(
        functions,
        "extractCaptureDev"
      );

      const extractionResult: any =
        await extractCaptureDev({
          captureId: captureRef.id,
        });

      const extractionData =
        extractionResult?.data?.extraction ||
        extractionResult?.data?.structured ||
        extractionResult?.data ||
        {};

      const normalizedExtraction: ExtractionResult = {
        summary: extractionData.summary || "",

        tasks: Array.isArray(extractionData.tasks)
          ? extractionData.tasks
          : [],

        events: Array.isArray(extractionData.events)
          ? extractionData.events
          : [],

        ideas: Array.isArray(extractionData.ideas)
          ? extractionData.ideas
          : [],

        notes: Array.isArray(extractionData.notes)
          ? extractionData.notes
          : [],
      };

      setExtraction(normalizedExtraction);

      await updateDoc(doc(db, "captures", captureRef.id), {
        transcript: transcriptText,

        summary: normalizedExtraction.summary || "",

        extraction: normalizedExtraction,

        status: "review_ready",

        updated_at: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);

      Alert.alert(
        "Erro",
        "Algo deu errado ao processar a captura."
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmAndSave() {
    try {
      if (!captureId || !extraction) {
        Alert.alert(
          "Nada para salvar",
          "Faça uma captura primeiro."
        );

        return;
      }

      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Erro", "Usuário não autenticado.");

        return;
      }

      setSaving(true);

      for (const task of extraction.tasks || []) {
        if (!task.title) continue;

        await addDoc(collection(db, "tasks"), {
          user_id: user.uid,

          capture_id: captureId,

          title: task.title,

          description: task.description || "",

          due_date: task.due_date || null,

          status: "open",

          confidence: task.confidence || null,

          created_at: serverTimestamp(),
        });
      }

      for (const event of extraction.events || []) {
        if (!event.title) continue;

        await addDoc(collection(db, "events"), {
          user_id: user.uid,

          capture_id: captureId,

          title: event.title,

          start_time: event.start_time || null,

          end_time: event.end_time || null,

          confidence: event.confidence || null,

          created_at: serverTimestamp(),
        });
      }

      for (const idea of extraction.ideas || []) {
        await addDoc(collection(db, "ideas"), {
          user_id: user.uid,

          capture_id: captureId,

          title: idea.title || "Ideia",

          content: idea.content || "",

          created_at: serverTimestamp(),
        });
      }

      await updateDoc(doc(db, "captures", captureId), {
        status: "saved",

        saved_at: serverTimestamp(),
      });

      setSaved(true);

      Alert.alert(
        "Tudo salvo",
        "O Eido organizou sua captura."
      );
    } catch (error) {
      console.error(error);

      Alert.alert(
        "Erro",
        "Não foi possível salvar os itens."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.logo}>Eido</Text>

      <Text style={styles.subtitle}>
        Capture agora. Organize depois.
      </Text>

      <TouchableOpacity
        style={[
          styles.recordButton,
          recording && styles.recordingButton,
        ]}
        onPress={
          recording ? stopRecording : startRecording
        }
      >
        <Text style={styles.recordButtonText}>
          {recording
            ? "Parar gravação"
            : "Gravar áudio"}
        </Text>
      </TouchableOpacity>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>
            Processando captura...
          </Text>
        </View>
      )}

      {transcript ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Transcrição
          </Text>

          <Text style={styles.bodyText}>
            {transcript}
          </Text>
        </View>
      ) : null}

      {extraction ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Resumo
          </Text>

          <Text style={styles.bodyText}>
            {extraction.summary || "Sem resumo."}
          </Text>

          {(extraction.tasks || []).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Tarefas
              </Text>

              {extraction.tasks?.map(
                (task, index) => (
                  <View
                    key={index}
                    style={styles.itemCard}
                  >
                    <Text style={styles.itemTitle}>
                      {task.title}
                    </Text>

                    {task.description ? (
                      <Text style={styles.bodyText}>
                        {task.description}
                      </Text>
                    ) : null}
                  </View>
                )
              )}
            </>
          )}

          {(extraction.events || []).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Eventos
              </Text>

              {extraction.events?.map(
                (event, index) => (
                  <View
                    key={index}
                    style={styles.itemCard}
                  >
                    <Text style={styles.itemTitle}>
                      {event.title}
                    </Text>
                  </View>
                )
              )}
            </>
          )}

          {(extraction.ideas || []).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Ideias
              </Text>

              {extraction.ideas?.map(
                (idea, index) => (
                  <View
                    key={index}
                    style={styles.itemCard}
                  >
                    <Text style={styles.itemTitle}>
                      {idea.title || "Ideia"}
                    </Text>

                    <Text style={styles.bodyText}>
                      {idea.content}
                    </Text>
                  </View>
                )
              )}
            </>
          )}

          <TouchableOpacity
            style={[
              styles.confirmButton,
              saved && styles.savedButton,
            ]}
            disabled={saving || saved}
            onPress={confirmAndSave}
          >
            <Text style={styles.confirmButtonText}>
              {saved
                ? "Salvo"
                : saving
                ? "Salvando..."
                : "Confirmar e salvar"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,

    backgroundColor: "#F5F4EF",

    paddingHorizontal: 24,

    paddingTop: 72,

    paddingBottom: 48,
  },

  logo: {
    fontSize: 48,

    fontWeight: "700",

    color: "#111827",
  },

  subtitle: {
    fontSize: 20,

    color: "#6B7280",

    marginTop: 12,

    marginBottom: 40,

    lineHeight: 28,
  },

  recordButton: {
    backgroundColor: "#111827",

    borderRadius: 24,

    paddingVertical: 22,

    alignItems: "center",

    marginBottom: 28,
  },

  recordingButton: {
    backgroundColor: "#7F1D1D",
  },

  recordButtonText: {
    color: "#FFFFFF",

    fontSize: 18,

    fontWeight: "600",
  },

  loadingContainer: {
    alignItems: "center",

    marginTop: 24,
  },

  loadingText: {
    marginTop: 12,

    color: "#6B7280",
  },

  card: {
    backgroundColor: "#FFFFFF",

    borderRadius: 28,

    padding: 24,

    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 20,

    fontWeight: "700",

    marginBottom: 12,

    marginTop: 16,

    color: "#111827",
  },

  bodyText: {
    fontSize: 16,

    lineHeight: 26,

    color: "#374151",
  },

  itemCard: {
    backgroundColor: "#F3F4F6",

    borderRadius: 18,

    padding: 16,

    marginBottom: 12,
  },

  itemTitle: {
    fontSize: 16,

    fontWeight: "600",

    color: "#111827",

    marginBottom: 4,
  },

  confirmButton: {
    backgroundColor: "#111827",

    borderRadius: 20,

    paddingVertical: 18,

    alignItems: "center",

    marginTop: 28,
  },

  savedButton: {
    backgroundColor: "#166534",
  },

  confirmButtonText: {
    color: "#FFFFFF",

    fontSize: 17,

    fontWeight: "600",
  },
});