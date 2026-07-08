import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export async function signUp(
  email: string,
  password: string
) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  
  if (credential.user) {
    await setDoc(doc(db, "users", credential.user.uid), {
      uid: credential.user.uid,
      email: email.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
    });
  }

  return credential;
}

export async function login(
  email: string,
  password: string
) {
  return signInWithEmailAndPassword(
    auth,
    email,
    password
  );
}

export async function logout() {
  return signOut(auth);
}