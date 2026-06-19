import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

export async function signUp(
  email: string,
  password: string
) {
  return createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
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