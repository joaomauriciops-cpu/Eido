import { initializeApp } from 'firebase/app';

import {
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';

import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyCJw6mj6uuxI32V0s5PNEcL9Qz5YAvdV-Y',
  authDomain: 'eido-mvp.firebaseapp.com',
  projectId: 'eido-mvp',
  storageBucket: 'eido-mvp.firebasestorage.app',
  messagingSenderId: '659978324733',
  appId: '1:659978324733:web:734471c5dc6318441d8c94',
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(
    ReactNativeAsyncStorage
  ),
});

export const db = getFirestore(app);
export const storage = getStorage(app);

export const functions = getFunctions(
  app,
  'southamerica-east1'
);