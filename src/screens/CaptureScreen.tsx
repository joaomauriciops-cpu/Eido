import { Audio } from 'expo-av';
import { useEffect, useState } from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

import {
  signInAnonymously,
  onAuthStateChanged,
} from 'firebase/auth';

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';

import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

import {
  httpsCallable,
} from 'firebase/functions';

import {
  auth,
  storage,
  db,
  functions,
} from '../lib/firebase';

export default function CaptureScreen() {
  const [recording, setRecording] =
    useState<Audio.Recording | null>(null);

  const [audioUri, setAudioUri] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState('Conectando ao Eido...');

  const [userId, setUserId] =
    useState<string | null>(null);

  const [isUploading, setIsUploading] =
    useState(false);

  const [transcript, setTranscript] =
    useState('');

  const [extraction, setExtraction] =
    useState<any>(null);

  const isRecording = recording !== null;

  useEffect(() => {
    async function connectUser() {
      try {
        if (!auth.currentUser) {
          const result =
            await signInAnonymously(auth);

          setUserId(result.user.uid);
        } else {
          setUserId(auth.currentUser.uid);
        }

        setMessage('Toque para gravar uma ideia.');
      } catch (error: any) {
        setMessage(
          `Erro auth: ${error.message}`
        );
      }
    }

    connectUser();

    const unsubscribe =
      onAuthStateChanged(auth, (user) => {
        if (user) {
          setUserId(user.uid);
        }
      });

    return unsubscribe;
  }, []);

  async function startRecording() {
    try {
      setMessage('Pedindo permissão...');

      const permission =
        await Audio.requestPermissionsAsync();

      if (!permission.granted) {
        setMessage('Permissão negada.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const result =
        await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

      setRecording(result.recording);

      setAudioUri(null);
      setTranscript('');
      setExtraction(null);

      setMessage('Gravando...');
    } catch (error: any) {
      setMessage(
        `Erro gravação: ${error.message}`
      );
    }
  }

  async function stopRecording() {
    try {
      if (!recording) return;

      setMessage('Finalizando...');

      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();

      setRecording(null);

      if (!uri) {
        setMessage('Áudio não encontrado.');
        return;
      }

      setAudioUri(uri);

      setMessage(
        'Gravação concluída.'
      );
    } catch (error: any) {
      setMessage(
        `Erro ao parar: ${error.message}`
      );
    }
  }

  async function uploadRecording() {
    try {
      if (!audioUri) {
        setMessage('Nenhum áudio.');
        return;
      }

      setIsUploading(true);

      let currentUser = auth.currentUser;

      if (!currentUser) {
        const result =
          await signInAnonymously(auth);

        currentUser = result.user;
      }

      const currentUserId =
        currentUser.uid;

      setUserId(currentUserId);

      setMessage('Enviando áudio...');

      const response =
        await fetch(audioUri);

      const blob =
        await response.blob();

      const filePath =
        `users/${currentUserId}/captures/${Date.now()}.m4a`;

      const storageRef =
        ref(storage, filePath);

      await uploadBytes(
        storageRef,
        blob
      );

      const downloadUrl =
        await getDownloadURL(storageRef);

      setMessage('Criando capture...');

      const docRef = await addDoc(
        collection(db, 'captures'),
        {
          userId: currentUserId,
          audioUrl: downloadUrl,
          audioPath: filePath,
          status: 'uploaded',
          createdAt: serverTimestamp(),
        }
      );

      setMessage('Transcrevendo áudio...');

      const transcribeCaptureDev =
        httpsCallable(
          functions,
          'transcribeCaptureDev'
        );

      const transcriptResult: any =
        await transcribeCaptureDev({
          captureId: docRef.id,
        });

      const transcriptText =
        transcriptResult.data.transcript;

      setTranscript(transcriptText);

      setMessage('Extraindo estrutura...');

      const extractCaptureDev =
        httpsCallable(
          functions,
          'extractCaptureDev'
        );

      const extractionResult: any =
        await extractCaptureDev({
          captureId: docRef.id,
        });

      setExtraction(
        extractionResult.data.extraction
      );

      setMessage(
        'Extração concluída.'
      );
    } catch (error: any) {
      console.log(error);

      setMessage(
        `${error.code || 'erro'}\n${error.message || String(error)}`
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
    >
      <Text style={styles.title}>
        Eido
      </Text>

      <Text style={styles.message}>
        {message}
      </Text>

      <TouchableOpacity
        style={[
          styles.button,
          isRecording &&
            styles.buttonRecording,
        ]}
        onPress={
          isRecording
            ? stopRecording
            : startRecording
        }
        disabled={isUploading}
      >
        <Text style={styles.buttonText}>
          {isRecording
            ? 'Parar'
            : 'Gravar'}
        </Text>
      </TouchableOpacity>

      {audioUri && (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={uploadRecording}
          disabled={isUploading}
        >
          <Text style={styles.buttonText}>
            {isUploading
              ? 'Processando...'
              : 'Enviar áudio'}
          </Text>
        </TouchableOpacity>
      )}

      {transcript !== '' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Transcript
          </Text>

          <Text style={styles.cardText}>
            {transcript}
          </Text>
        </View>
      )}

      {extraction && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Summary
          </Text>

          <Text style={styles.cardText}>
            {extraction.summary}
          </Text>

          <Text style={styles.sectionTitle}>
            Tasks
          </Text>

          {extraction.tasks?.map(
            (task: any, index: number) => (
              <Text
                key={index}
                style={styles.cardText}
              >
                • {task.title}
              </Text>
            )
          )}

          <Text style={styles.sectionTitle}>
            Ideas
          </Text>

          {extraction.ideas?.map(
            (idea: any, index: number) => (
              <Text
                key={index}
                style={styles.cardText}
              >
                • {idea.title}
              </Text>
            )
          )}

          <Text style={styles.sectionTitle}>
            Notes
          </Text>

          {extraction.notes?.map(
            (note: string, index: number) => (
              <Text
                key={index}
                style={styles.cardText}
              >
                • {note}
              </Text>
            )
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    padding: 24,
    paddingTop: 80,
  },

  title: {
    fontSize: 42,
    color: 'white',
    marginBottom: 24,
    fontWeight: '600',
  },

  message: {
    color: '#CBD5E1',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },

  button: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 999,
  },

  buttonRecording: {
    backgroundColor: '#DC2626',
  },

  uploadButton: {
    marginTop: 20,
    backgroundColor: '#2563EB',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 999,
  },

  buttonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },

  card: {
    width: '100%',
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 20,
    marginTop: 32,
  },

  sectionTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 16,
  },

  cardText: {
    color: '#CBD5E1',
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 24,
  },
});